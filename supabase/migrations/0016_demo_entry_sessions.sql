-- Additive passwordless entry for one explicitly registered synthetic workspace.
-- No identity, membership, permission, business fact or existing session is changed.
begin;
create table public.demo_entry_config (
 singleton boolean primary key default true check(singleton),
 workspace_id uuid not null references public.demo_scenarios(workspace_id),
 user_id uuid not null references public.users(id),
 enabled boolean not null default false
);
create table public.demo_sessions (
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
 workspace_id uuid not null references public.demo_scenarios(workspace_id),
 organization_id uuid not null references public.organizations(id),
 user_id uuid not null references public.users(id),
 request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 check(expires_at > created_at and expires_at <= created_at + interval '2 hours'),
 foreign key(workspace_id,organization_id) references public.workspaces(id,organization_id)
);
create index demo_sessions_request_window on public.demo_sessions(request_hash,created_at);
create index demo_sessions_creation_window on public.demo_sessions(created_at);
alter table public.demo_entry_config enable row level security;
alter table public.demo_sessions enable row level security;
revoke all on public.demo_entry_config,public.demo_sessions from public,anon,authenticated,service_role;
grant select on public.demo_entry_config,public.demo_sessions to service_role;
grant update(revoked_at) on public.demo_sessions to service_role;

create function public.require_demo_entry() returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.demo_entry_config; w public.workspaces; o public.organizations;
 u public.users; m public.organization_memberships;
begin
 select * into c from public.demo_entry_config where singleton and enabled for share;
 if not found then raise exception 'DEMO_UNAVAILABLE';end if;
 select * into w from public.workspaces where id=c.workspace_id;
 if not found or w.status<>'ACTIVE' then raise exception 'DEMO_UNAVAILABLE';end if;
 select * into o from public.organizations where id=w.organization_id for share;
 if not found or o.status<>'ACTIVE' or not exists(select 1 from public.demo_scenarios d where d.workspace_id=w.id and d.organization_id=o.id) then raise exception 'DEMO_UNAVAILABLE';end if;
 -- Match operator reset ordering: organization before workspace, then membership.
 select * into w from public.workspaces where id=c.workspace_id and organization_id=o.id for share;
 if not found or w.status<>'ACTIVE' then raise exception 'DEMO_UNAVAILABLE';end if;
 select * into m from public.organization_memberships where user_id=c.user_id and organization_id=o.id for share;
 if not found or not m.active or m.role<>'ORG_OWNER' or m.policy_override then raise exception 'DEMO_UNAVAILABLE';end if;
 select * into u from public.users where id=c.user_id for share;
 if not found or not u.active or u.is_system or u.platform_role is not null or u.auth_user_id is null then raise exception 'DEMO_UNAVAILABLE';end if;
 if exists(select 1 from public.organization_memberships other where other.user_id=u.id and other.active and other.organization_id<>o.id) then raise exception 'DEMO_UNAVAILABLE';end if;
 perform public.require_workspace_member(w.id,m.id,false,true);
 return jsonb_build_object('workspaceId',w.id,'organizationId',o.id,'memberId',m.id,
  'userId',u.id,'authUserId',u.auth_user_id,'email',u.email,'displayName',u.display_name,
  'platformRole',u.platform_role,'role',m.role,'isProductLead',m.is_product_lead);
end;$$;

create function public.create_demo_session(p_token_hash text,p_request_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ctx jsonb; created timestamptz;
begin
 if p_token_hash !~ '^[a-f0-9]{64}$' or p_request_hash !~ '^[a-f0-9]{64}$' or p_token_hash is null or p_request_hash is null then raise exception 'DEMO_UNAVAILABLE';end if;
 -- Serializes the small public-entry budget across processes, not in browser memory.
 perform pg_advisory_xact_lock(160016);
 ctx:=public.require_demo_entry();
 if (select count(*) from public.demo_sessions where request_hash=p_request_hash and created_at>clock_timestamp()-interval '1 minute')>=10
 or (select count(*) from public.demo_sessions where created_at>clock_timestamp()-interval '1 minute')>=200 then raise exception 'DEMO_RATE_LIMIT';end if;
 created:=clock_timestamp();
 insert into public.demo_sessions(token_hash,workspace_id,organization_id,user_id,request_hash,created_at,expires_at)
 values(p_token_hash,(ctx->>'workspaceId')::uuid,(ctx->>'organizationId')::uuid,(ctx->>'userId')::uuid,p_request_hash,created,created+interval '2 hours');
 return ctx;
end;$$;

create function public.read_demo_session(p_token_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare session public.demo_sessions; ctx jsonb;
begin
 select * into session from public.demo_sessions where token_hash=p_token_hash and expires_at>clock_timestamp() and revoked_at is null;
 if not found then raise exception 'DEMO_SESSION_EXPIRED';end if;
 ctx:=public.require_demo_entry();
 if session.workspace_id<>(ctx->>'workspaceId')::uuid or session.organization_id<>(ctx->>'organizationId')::uuid or session.user_id<>(ctx->>'userId')::uuid then raise exception 'DEMO_UNAVAILABLE';end if;
 return ctx;
end;$$;
revoke all on function public.require_demo_entry(),public.create_demo_session(text,text),public.read_demo_session(text) from public,anon,authenticated;
grant execute on function public.require_demo_entry(),public.create_demo_session(text,text),public.read_demo_session(text) to service_role;
comment on table public.demo_entry_config is 'Operator-only pointer to an existing synthetic scenario and identity. No email/password or public configuration path. Disabled or invalid configuration fails closed.';
comment on table public.demo_sessions is 'App-owned, revocable, two-hour guest sessions. Hashes only; no provider credentials, tokens, signup or anonymous provider identity. Operational scope is revalidated on every request.';
commit;
