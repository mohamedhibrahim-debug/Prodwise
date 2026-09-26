-- Auth + Users. Apply only to an explicitly approved environment.
-- No public data grants; all session/tenant access remains server-only.
begin;
grant usage on schema public to service_role;
grant select,insert,update on public.users to service_role;
grant select,insert,update,delete on public.initiatives,public.initiative_sources,public.evidence,public.claims,public.claim_evidence,public.finding_states,public.activity_log to service_role;
alter table public.users add column auth_user_id uuid unique references auth.users(id) on delete restrict;
alter table public.users add column is_system boolean not null default false;
update public.users set is_system=true where email='demo.pm@prodwise.local';
create unique index users_email_lower on public.users(lower(email));
create table public.workspaces(
  id uuid primary key default gen_random_uuid(), name text not null check(length(btrim(name)) between 1 and 120),
  status text not null default 'BOOTSTRAPPING' check(status in ('BOOTSTRAPPING','ACTIVE')), created_at timestamptz not null default now()
);
-- Explicit single-workspace backfill; no defaults allow old unscoped app writes.
insert into public.workspaces(id,name) values('10000000-0000-4000-8000-000000000001','Prodwise');
create table public.memberships(
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  user_id uuid not null references public.users(id), role text not null check(role in ('Admin','Member','Viewer')),
  is_product_lead boolean not null default false, active boolean not null default true,
  created_at timestamptz not null default now(), unique(workspace_id,user_id),
  check(not is_product_lead or role in ('Admin','Member'))
);
create table public.workspace_invitations(
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  email text not null check(email=lower(btrim(email))), role text not null check(role in ('Admin','Member','Viewer')),
  token_hash text not null unique check(length(token_hash)=64), expires_at timestamptz not null,
  revoked_at timestamptz, used_at timestamptz, invited_by uuid references public.users(id),
  created_at timestamptz not null default now()
);
create unique index one_pending_workspace_invite on public.workspace_invitations(workspace_id,email) where revoked_at is null and used_at is null;
create table public.membership_events(
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  actor_id uuid references public.users(id), actor_label text not null, target_id text not null, action text not null,
  before_state jsonb, after_state jsonb, occurred_at timestamptz not null default now()
);
create function public.membership_event_actor_snapshot() returns trigger language plpgsql set search_path='' as $$ begin
  select display_name into new.actor_label from public.users where id=new.actor_id;
  if new.actor_label is null then new.actor_label:='Recorded operator'; end if;
  return new;
end $$;
create trigger membership_event_actor before insert on public.membership_events for each row execute function public.membership_event_actor_snapshot();
create table public.workspace_sessions(
  token_hash text primary key check(length(token_hash)=64), workspace_id uuid not null references public.workspaces(id),
  user_id uuid not null references public.users(id), auth_user_id uuid not null references auth.users(id),
  access_token text not null, refresh_token text not null, expires_at timestamptz not null
);
do $$ declare t text; begin
  foreach t in array array['initiatives','initiative_sources','evidence','claims','claim_evidence','finding_states','activity_log'] loop
    execute format('alter table public.%I add column workspace_id uuid references public.workspaces(id)',t);
    execute format('update public.%I set workspace_id=$1',t) using '10000000-0000-4000-8000-000000000001'::uuid;
    execute format('alter table public.%I alter column workspace_id set not null',t);
  end loop;
end $$;
alter table public.initiatives add constraint initiatives_workspace_key unique(id,workspace_id);
alter table public.claims add constraint claims_workspace_key unique(id,workspace_id);
alter table public.evidence add constraint evidence_workspace_key unique(id,workspace_id);
alter table public.initiative_sources add constraint sources_workspace_key unique(id,workspace_id);
do $$ declare t text; begin
  foreach t in array array['initiative_sources','evidence','claims','finding_states','activity_log'] loop
    execute format('alter table public.%I add constraint %I foreign key(initiative_id,workspace_id) references public.initiatives(id,workspace_id)',t,t||'_workspace_owner');
  end loop;
end $$;
alter table public.claim_evidence add constraint links_claim_workspace foreign key(claim_id,workspace_id) references public.claims(id,workspace_id);
alter table public.claim_evidence add constraint links_evidence_workspace foreign key(evidence_id,workspace_id) references public.evidence(id,workspace_id);
alter table public.evidence add constraint evidence_source_workspace foreign key(source_id,workspace_id) references public.initiative_sources(id,workspace_id);
alter table public.claims add constraint replacement_workspace foreign key(superseded_by_claim_id,workspace_id) references public.claims(id,workspace_id);

-- Existing atomic decision/trust functions derive child workspace from their
-- already-validated parent. This is not an unscoped default tenant selection.
create function public.attach_parent_workspace() returns trigger language plpgsql set search_path='' as $$
declare parent_id uuid; begin
  if tg_table_name='claim_evidence' then select workspace_id into parent_id from public.claims where id=new.claim_id;
  else select workspace_id into parent_id from public.initiatives where id=new.initiative_id; end if;
  if new.workspace_id is null then new.workspace_id:=parent_id; end if;
  if parent_id is null or new.workspace_id<>parent_id then raise exception 'WORKSPACE_MISMATCH'; end if;
  if nullif(current_setting('prodwise.actor_id',true),'') is not null then
    if tg_table_name='activity_log' then
      if new.actor_id is null then new.actor_id:=current_setting('prodwise.actor_id')::uuid; end if;
    elsif tg_table_name in ('claims','evidence') then
      if new.created_by is null then new.created_by:=current_setting('prodwise.actor_id')::uuid; end if;
    end if;
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['initiative_sources','evidence','claims','claim_evidence','finding_states','activity_log'] loop
    execute format('create trigger attach_workspace before insert or update on public.%I for each row execute function public.attach_parent_workspace()',t);
  end loop;
end $$;

create function public.require_workspace_member(p_workspace_id uuid,p_member_id uuid,p_admin boolean default false,p_write boolean default false)
returns public.memberships language plpgsql security invoker set search_path='' as $$
declare m public.memberships; begin
  select * into m from public.memberships where id=p_member_id and workspace_id=p_workspace_id and active for share;
  if not found then raise exception 'ACCESS_DENIED'; end if;
  if p_admin and m.role<>'Admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if p_write and m.role='Viewer' then raise exception 'VIEW_ONLY'; end if;
  if exists(select 1 from public.users where id=m.user_id and is_system) then raise exception 'ACCESS_DENIED'; end if;
  return m;
end $$;
create function public.workspace_admin_invariant() returns trigger language plpgsql set search_path='' as $$
declare wid uuid; begin
  if tg_table_name='workspaces' then wid:=new.id;
  elsif tg_op='DELETE' then wid:=old.workspace_id;
  else wid:=new.workspace_id; end if;
  perform 1 from public.workspaces where id=wid for update;
  if exists(select 1 from public.workspaces where id=wid and status='ACTIVE')
    and not exists(select 1 from public.memberships where workspace_id=wid and active and role='Admin') then raise exception 'LAST_ADMIN'; end if;
  return null;
end $$;
create constraint trigger membership_admin_backstop after insert or update or delete on public.memberships deferrable initially deferred for each row execute function public.workspace_admin_invariant();
create constraint trigger workspace_admin_backstop after insert or update on public.workspaces deferrable initially deferred for each row execute function public.workspace_admin_invariant();
create function public.membership_not_system() returns trigger language plpgsql set search_path='' as $$ begin
  if exists(select 1 from public.users where id=new.user_id and is_system) then raise exception 'SYSTEM_USER_NOT_SIGNABLE'; end if; return new;
end $$;
create trigger membership_system_guard before insert or update on public.memberships for each row execute function public.membership_not_system();

create function public.change_workspace_membership(p_workspace_id uuid,p_member_id uuid,p_target_id uuid,p_role text,p_active boolean,p_is_product_lead boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare actor public.memberships; previous public.memberships; begin
  perform 1 from public.workspaces where id=p_workspace_id for update;
  actor:=public.require_workspace_member(p_workspace_id,p_member_id,true,false);
  select * into previous from public.memberships where id=p_target_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'ACCESS_DENIED'; end if;
  if p_role not in ('Admin','Member','Viewer') or p_role is null or p_active is null or p_is_product_lead is null then raise exception 'INVALID_MEMBERSHIP'; end if;
  if p_is_product_lead and p_role='Viewer' then raise exception 'VIEWER_CANNOT_LEAD'; end if;
  if previous.active and previous.role='Admin' and (not p_active or p_role<>'Admin') and
    (select count(*) from public.memberships where workspace_id=p_workspace_id and active and role='Admin')<=1 then raise exception 'LAST_ADMIN'; end if;
  update public.memberships set role=p_role,active=p_active,is_product_lead=p_is_product_lead where id=p_target_id;
  if not p_active then delete from public.workspace_sessions where workspace_id=p_workspace_id and user_id=previous.user_id; end if;
  insert into public.membership_events(workspace_id,actor_id,target_id,action,before_state,after_state)
    values(p_workspace_id,actor.user_id,p_target_id::text,'MEMBERSHIP_CHANGED',to_jsonb(previous),jsonb_build_object('role',p_role,'active',p_active,'isProductLead',p_is_product_lead));
end $$;
create function public.manage_workspace_invitation(p_workspace_id uuid,p_member_id uuid,p_action text,p_invitation_id uuid,p_email text,p_role text,p_token_hash text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare actor public.memberships; item public.workspace_invitations; begin
  perform 1 from public.workspaces where id=p_workspace_id for update;
  actor:=public.require_workspace_member(p_workspace_id,p_member_id,true,false);
  if p_action='INVITE' then
    if p_email is null or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_role is null or p_role not in ('Admin','Member','Viewer') then raise exception 'INVALID_INVITATION'; end if;
    if exists(select 1 from public.users where lower(email)=lower(btrim(p_email))) then raise exception 'ACCOUNT_ALREADY_EXISTS'; end if;
    update public.workspace_invitations set revoked_at=clock_timestamp() where workspace_id=p_workspace_id and email=lower(btrim(p_email)) and used_at is null and revoked_at is null and expires_at<=clock_timestamp();
    insert into public.workspace_invitations(workspace_id,email,role,token_hash,expires_at,invited_by)
      values(p_workspace_id,lower(btrim(p_email)),p_role,p_token_hash,clock_timestamp()+interval '7 days',actor.user_id) returning * into item;
  else
    select * into item from public.workspace_invitations where id=p_invitation_id and workspace_id=p_workspace_id for update;
    if not found or item.used_at is not null or item.revoked_at is not null then raise exception 'INVITE_INVALID'; end if;
    if p_action='RESEND' then update public.workspace_invitations set token_hash=p_token_hash,expires_at=clock_timestamp()+interval '7 days' where id=item.id;
    elsif p_action='REVOKE' then update public.workspace_invitations set revoked_at=clock_timestamp() where id=item.id;
    else raise exception 'INVALID_ACTION'; end if;
  end if;
  insert into public.membership_events(workspace_id,actor_id,target_id,action,after_state)
    values(p_workspace_id,actor.user_id,item.id::text,'INVITATION_'||p_action,jsonb_build_object('email',item.email,'role',item.role));
  return item.id;
end $$;
create function public.accept_workspace_invitation(p_workspace_id uuid,p_token_hash text,p_auth_user_id uuid,p_display_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare item public.workspace_invitations; uid uuid; mid uuid; provider_email text; workspace_status text; begin
  select status into workspace_status from public.workspaces where id=p_workspace_id for update;
  select * into item from public.workspace_invitations where workspace_id=p_workspace_id and token_hash=p_token_hash for update;
  if not found or item.revoked_at is not null or item.used_at is not null or item.expires_at<=clock_timestamp() then raise exception 'INVITE_INVALID'; end if;
  if nullif(btrim(p_display_name),'') is null or length(btrim(p_display_name))>120 then raise exception 'NAME_REQUIRED'; end if;
  if workspace_status='BOOTSTRAPPING' and item.role<>'Admin' then raise exception 'ADMIN_BOOTSTRAP_REQUIRED'; end if;
  select lower(email) into provider_email from auth.users where id=p_auth_user_id;
  if provider_email is distinct from item.email then raise exception 'INVITATION_IDENTITY_MISMATCH'; end if;
  insert into public.users(email,display_name,auth_user_id) values(item.email,btrim(p_display_name),p_auth_user_id)
    on conflict(auth_user_id) do update set display_name=excluded.display_name returning id into uid;
  insert into public.memberships(workspace_id,user_id,role,active) values(p_workspace_id,uid,item.role,true) returning id into mid;
  update public.workspace_invitations set used_at=clock_timestamp() where id=item.id;
  update public.workspaces set status='ACTIVE' where id=p_workspace_id and status='BOOTSTRAPPING';
  insert into public.membership_events(workspace_id,actor_id,target_id,action,after_state)
    values(p_workspace_id,uid,mid::text,'INVITATION_ACCEPTED',jsonb_build_object('role',item.role));
  return mid;
end $$;
create function public.bootstrap_workspace_admin(p_workspace_id uuid,p_email text,p_token_hash text)
returns uuid language plpgsql security invoker set search_path='' as $$ declare iid uuid; begin
  perform 1 from public.workspaces where id=p_workspace_id and status='BOOTSTRAPPING' for update;
  if not found or exists(select 1 from public.memberships where workspace_id=p_workspace_id) or
    exists(select 1 from public.workspace_invitations where workspace_id=p_workspace_id and used_at is null and revoked_at is null) then raise exception 'BOOTSTRAP_ALREADY_STARTED'; end if;
  insert into public.workspace_invitations(workspace_id,email,role,token_hash,expires_at)
    values(p_workspace_id,lower(btrim(p_email)),'Admin',p_token_hash,clock_timestamp()+interval '7 days') returning id into iid;
  return iid;
end $$;

-- Existing pure decision semantics remain unchanged. Scope, fresh membership
-- and server-resolved actor are checked in the same atomic RPC transaction.
create function public.auth_business_rpc(p_workspace_id uuid,p_member_id uuid,p_operation text,p_args jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare m public.memberships; aid uuid; label text; iid uuid; cid uuid; plan jsonb; result jsonb; begin
  m:=public.require_workspace_member(p_workspace_id,p_member_id,false,true);
  select display_name into label from public.users where id=m.user_id;
  if p_operation='verify_claim' then
    cid:=(p_args->>'p_claim_id')::uuid;
    select initiative_id into iid from public.claims where id=cid and workspace_id=p_workspace_id;
  elsif p_operation in ('resolve_conflict','assign_finding_confirmer') then iid:=(p_args->'p_plan'->>'initiativeId')::uuid;
  elsif p_operation in ('reopen_finding_state','set_finding_note') then iid:=(p_args->>'p_initiative_id')::uuid;
  else raise exception 'UNKNOWN_CAPABILITY'; end if;
  if iid is null or not exists(select 1 from public.initiatives where id=iid and workspace_id=p_workspace_id) then raise exception 'ACCESS_DENIED'; end if;
  aid:=m.user_id;
  perform set_config('prodwise.actor_id',aid::text,true);
  if p_operation='verify_claim' then
    select to_jsonb(v) into result from public.verify_claim(cid,(p_args->>'p_expected_updated_at')::timestamptz,(p_args->>'p_basis')::public.verification_basis,p_args->>'p_note',aid::text,label) v;
  elsif p_operation='resolve_conflict' then
    plan:=jsonb_set(p_args->'p_plan','{actor}',jsonb_build_object('id',aid::text,'label',label));
    result:=public.resolve_conflict(plan);
  elsif p_operation='assign_finding_confirmer' then
    plan:=jsonb_set(p_args->'p_plan','{actor}',jsonb_build_object('id',aid::text,'label',label));
    perform public.assign_finding_confirmer(plan); result:='null'::jsonb;
  elsif p_operation='reopen_finding_state' then
    result:=to_jsonb(public.reopen_finding_state(iid,p_args->>'p_fingerprint',aid::text,label));
  elsif p_operation='set_finding_note' then
    perform public.set_finding_note(iid,p_args->>'p_fingerprint',p_args->'p_input'); result:='null'::jsonb;
  end if;
  return result;
end $$;
do $$ declare t text; begin
  foreach t in array array['workspaces','memberships','workspace_invitations','membership_events','workspace_sessions'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon,authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;
revoke all on function public.require_workspace_member(uuid,uuid,boolean,boolean),public.change_workspace_membership(uuid,uuid,uuid,text,boolean,boolean),
 public.manage_workspace_invitation(uuid,uuid,text,uuid,text,text,text),public.accept_workspace_invitation(uuid,text,uuid,text),
 public.bootstrap_workspace_admin(uuid,text,text),public.auth_business_rpc(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.require_workspace_member(uuid,uuid,boolean,boolean),public.change_workspace_membership(uuid,uuid,uuid,text,boolean,boolean),
 public.manage_workspace_invitation(uuid,uuid,text,uuid,text,text,text),public.accept_workspace_invitation(uuid,text,uuid,text),
 public.bootstrap_workspace_admin(uuid,text,text),public.auth_business_rpc(uuid,uuid,text,jsonb) to service_role;
commit;
