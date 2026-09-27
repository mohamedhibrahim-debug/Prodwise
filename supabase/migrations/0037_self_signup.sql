-- Organization-aware self sign-up. Eligibility is each organization's own access
-- policy (allowed domains + exact-email exceptions) AND an explicit per-organization
-- opt-in. Ownership of the address is proven by the provider's email verification
-- before any membership is created. Self sign-up always creates a MEMBER; it never
-- grants ORG_OWNER, ADMIN, Product Lead or any platform role, and never changes an
-- existing identity or membership.
begin;
alter table public.organizations add column self_signup_enabled boolean not null default false;
alter table public.organization_memberships add column joined_via text check(joined_via is null or joined_via in ('INVITATION','SELF_SIGNUP','PLATFORM'));
comment on column public.organization_memberships.joined_via is 'How the membership began, when known. Null for memberships created before this was recorded.';
-- AMAN (fixed id since 0012) allows self sign-up for its approved corporate domains.
update public.organizations set self_signup_enabled=true where id='90000000-0000-4000-8000-000000000001' and name='AMAN';

-- Append-only attempt log for rate limiting; addresses are stored hashed.
create table public.signup_attempts(id uuid primary key default gen_random_uuid(),email_hash text not null,client_hash text,eligible boolean not null,at timestamptz not null default clock_timestamp());
create index signup_attempts_email on public.signup_attempts(email_hash,at);create index signup_attempts_client on public.signup_attempts(client_hash,at);
alter table public.signup_attempts enable row level security;revoke all on public.signup_attempts from public,anon,authenticated;grant select,insert on public.signup_attempts to service_role;

create function public.self_signup_eligible(p_email text) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.organizations o where o.status='ACTIVE' and o.self_signup_enabled and public.organization_email_allowed(o.id,p_email))$$;

-- Step 1: eligibility, rate limited. Reveals only yes/no for the typed address; never an organization.
create function public.check_self_signup(p_email text,p_client_hash text) returns boolean language plpgsql set search_path='' as $$
declare e text:=lower(btrim(p_email));h text;ok boolean;begin
 if e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(e)>254 then raise exception 'EMAIL_INVALID';end if;
 h:=encode(sha256(convert_to(e,'UTF8')),'hex');
 if (select count(*) from public.signup_attempts where email_hash=h and at>clock_timestamp()-interval '1 hour')>=5 or (p_client_hash is not null and (select count(*) from public.signup_attempts where client_hash=p_client_hash and at>clock_timestamp()-interval '1 hour')>=20) then raise exception 'RATE_LIMITED';end if;
 ok:=public.self_signup_eligible(e);insert into public.signup_attempts(email_hash,client_hash,eligible) values(h,p_client_hash,ok);return ok;end$$;

-- Step 3: organizations the VERIFIED address may join. Only after provider verification.
create function public.self_signup_options(p_auth_user_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e text;verified timestamptz;begin
 select lower(btrim(email)),email_confirmed_at into e,verified from auth.users where id=p_auth_user_id;if e is null or verified is null then raise exception 'EMAIL_NOT_VERIFIED';end if;
 return jsonb_build_object('email',e,'existingIdentity',exists(select 1 from public.users where lower(email)=e or auth_user_id=p_auth_user_id),
  'organizations',coalesce((select jsonb_agg(jsonb_build_object('organizationId',o.id,'name',o.name,'workspaceId',w.id,'member',exists(select 1 from public.organization_memberships m join public.users u on u.id=m.user_id where m.organization_id=o.id and (u.auth_user_id=p_auth_user_id or lower(u.email)=e))) order by o.name)
   from public.organizations o join public.workspaces w on w.organization_id=o.id and w.status='ACTIVE' where o.status='ACTIVE' and o.self_signup_enabled and public.organization_email_allowed(o.id,e)),'[]'::jsonb));end$$;

create function public.complete_self_signup(p_auth_user_id uuid,p_organization_id uuid,p_display_name text) returns jsonb language plpgsql security definer set search_path='' as $$
declare e text;verified timestamptz;o public.organizations;w public.workspaces;uid uuid;mid uuid;name text:=btrim(p_display_name);existing public.users;begin
 select lower(btrim(email)),email_confirmed_at into e,verified from auth.users where id=p_auth_user_id;if e is null or verified is null then raise exception 'EMAIL_NOT_VERIFIED';end if;
 select * into o from public.organizations where id=p_organization_id for update;
 if not found or o.status<>'ACTIVE' or not o.self_signup_enabled or not public.organization_email_allowed(o.id,e) then raise exception 'SIGNUP_NOT_ALLOWED';end if;
 select * into w from public.workspaces where organization_id=o.id and status='ACTIVE' order by id limit 1;if w.id is null then raise exception 'SIGNUP_NOT_ALLOWED';end if;
 if coalesce(length(name),0) not between 1 and 120 then raise exception 'NAME_REQUIRED';end if;
 select * into existing from public.users where auth_user_id=p_auth_user_id or lower(email)=e limit 1;
 if existing.id is not null then
  -- An existing identity is never modified by sign-up (no name, role or platform change).
  if existing.auth_user_id is distinct from p_auth_user_id or not existing.active or existing.is_system then raise exception 'ACCOUNT_EXISTS';end if;
  if exists(select 1 from public.organization_memberships where organization_id=o.id and user_id=existing.id) then raise exception 'ACCOUNT_EXISTS';end if;uid:=existing.id;
 else insert into public.users(email,display_name,auth_user_id) values(e,name,p_auth_user_id) returning id into uid;end if;
 insert into public.organization_memberships(organization_id,user_id,role,is_product_lead,policy_override,policy_override_reason,joined_via) values(o.id,uid,'MEMBER',false,false,null,'SELF_SIGNUP') returning id into mid;
 insert into public.membership_events(workspace_id,organization_id,actor_id,target_id,action,after_state) values(w.id,o.id,uid,mid::text,'SELF_SIGNUP',jsonb_build_object('role','MEMBER','email',e));
 return jsonb_build_object('workspaceId',w.id,'organizationId',o.id,'memberId',mid);end$$;
-- Existing invitation acceptance now records how the membership began.
do $$declare def text;begin select pg_get_functiondef('public.accept_workspace_invitation(uuid,text,uuid,text)'::regprocedure) into def;
 def:=replace(def,'insert into public.organization_memberships(organization_id,user_id,role,policy_override,policy_override_reason) values(oid,uid,item.role,item.policy_override,item.policy_override_reason)','insert into public.organization_memberships(organization_id,user_id,role,policy_override,policy_override_reason,joined_via) values(oid,uid,item.role,item.policy_override,item.policy_override_reason,''INVITATION'')');
 if position('joined_via' in def)=0 then raise exception 'PATCH_TARGET_MISSING accept_workspace_invitation';end if;execute def;end$$;
create function public.platform_set_self_signup(p_actor_id uuid,p_organization_id uuid,p_enabled boolean,p_reason text) returns void language plpgsql set search_path='' as $$declare previous public.organizations;begin
 perform public.require_platform_owner(p_actor_id);if coalesce(length(btrim(p_reason)),0) not between 1 and 500 or p_enabled is null then raise exception 'REASON_REQUIRED';end if;
 select * into previous from public.organizations where id=p_organization_id for update;if not found then raise exception 'ACCESS_DENIED';end if;
 update public.organizations set self_signup_enabled=p_enabled where id=p_organization_id;
 perform public.platform_audit(p_actor_id,p_organization_id,null,p_organization_id::text,'ORGANIZATION_SELF_SIGNUP_CHANGED',jsonb_build_object('selfSignup',previous.self_signup_enabled),jsonb_build_object('selfSignup',p_enabled),btrim(p_reason),false);end$$;
revoke all on function public.platform_set_self_signup(uuid,uuid,boolean,text) from public,anon,authenticated;grant execute on function public.platform_set_self_signup(uuid,uuid,boolean,text) to service_role;
revoke all on function public.self_signup_eligible(text),public.check_self_signup(text,text),public.self_signup_options(uuid),public.complete_self_signup(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.self_signup_eligible(text),public.check_self_signup(text,text),public.self_signup_options(uuid),public.complete_self_signup(uuid,uuid,text) to service_role;
commit;
