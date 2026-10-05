-- Explicit per-source background grants. Service role only; no browser credentials.
begin;
alter table public.connector_connections add column sync_lease_token uuid;
alter table public.connector_connections add column sync_lease_until timestamptz;
alter table public.connector_connections add constraint connector_sync_lease_pair
 check ((sync_lease_token is null) = (sync_lease_until is null));

create table public.jira_sync_jobs (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 organization_id uuid not null references public.organizations(id),
 initiative_id uuid not null references public.initiatives(id),
 item_id uuid not null references public.source_items(id),
 user_id uuid not null references public.users(id),
 owner_label text not null,
 connection_id uuid not null references public.connector_connections(id),
 connection_granted_at timestamptz not null,
 status text not null check(status in ('ACTIVE','PAUSED','ATTENTION')),
 next_run_at timestamptz not null default clock_timestamp(),
 last_attempt_at timestamptz, last_success_at timestamptz,
 last_error text check(last_error is null or last_error ~ '^[A-Z_]{1,60}$'),
 failures integer not null default 0 check(failures >= 0),
 lease_token uuid, lease_until timestamptz,
 revision integer not null default 1 check(revision > 0),
 unique(workspace_id,initiative_id,item_id),
 foreign key(workspace_id,initiative_id,item_id) references public.source_item_syncs(workspace_id,initiative_id,item_id),
 check ((lease_token is null) = (lease_until is null))
);
create index jira_sync_due on public.jira_sync_jobs(next_run_at,id) where status='ACTIVE';
create index jira_sync_connection on public.jira_sync_jobs(connection_id);
alter table public.jira_sync_jobs enable row level security;
revoke all on public.jira_sync_jobs from public,anon,authenticated;
grant select,insert,update on public.jira_sync_jobs to service_role;

-- Locks organization/workspace lifecycle before membership, matching administration writes.
create function public.jira_sync_actor(w uuid, principal uuid) returns public.organization_memberships
language plpgsql set search_path='' as $$
declare oid uuid; actor public.organization_memberships;
begin
 select organization_id into oid from public.workspaces where id=w;
 perform 1 from public.organizations where id=oid and status='ACTIVE' for share;
 if not found then raise exception 'ACCESS_DENIED'; end if;
 perform 1 from public.workspaces where id=w and organization_id=oid and status='ACTIVE' for share;
 if not found then raise exception 'ACCESS_DENIED'; end if;
 if exists(select 1 from public.demo_scenarios where workspace_id=w) then raise exception 'DEMO_ORGANIZATION'; end if;
 actor:=public.require_workspace_member(w,principal,false,true);
 if actor.organization_id<>oid then raise exception 'ACCESS_DENIED'; end if;
 return actor;
end$$;

create function public.configure_jira_sync(p_workspace_id uuid,p_member_id uuid,p_initiative_id uuid,p_item_id uuid,p_enabled boolean,p_revision integer)
returns void language plpgsql set search_path='' as $$
declare actor public.organization_memberships; i public.initiatives; c public.connector_connections; j public.jira_sync_jobs; label text;
begin
 actor:=public.jira_sync_actor(p_workspace_id,p_member_id);
 if p_enabled is null or p_revision is null or p_revision<0 then raise exception 'INVALID_REQUEST'; end if;
 select * into i from public.initiatives where id=p_initiative_id and workspace_id=p_workspace_id for update;
 if not found then raise exception 'SOURCE_ACCESS'; end if;
 -- Pause is allowed even after unlink/archive; enabling requires a current mapped Jira snapshot.
 if p_enabled then
  if i.archived_at is not null then raise exception 'ARCHIVED'; end if;
  perform 1 from public.source_mappings where workspace_id=p_workspace_id and initiative_id=i.id and item_id=p_item_id and unlinked_at is null for share;
  if not found then raise exception 'SOURCE_ACCESS'; end if;
  perform 1 from public.source_item_syncs where workspace_id=p_workspace_id and initiative_id=i.id and item_id=p_item_id and connector='JIRA' for share;
  if not found then raise exception 'SOURCE_ACCESS'; end if;
  select * into c from public.connector_connections where organization_id=actor.organization_id and user_id=actor.user_id and provider='JIRA' and status='CONNECTED' and connected_at is not null and sealed_tokens is not null for share;
  if not found then raise exception 'NOT_CONNECTED'; end if;
 end if;
 select * into j from public.jira_sync_jobs where workspace_id=p_workspace_id and initiative_id=i.id and item_id=p_item_id for update;
 if coalesce(j.revision,0)<>p_revision then raise exception 'STALE_REVISION'; end if;
 if not p_enabled then
  update public.jira_sync_jobs set status='PAUSED',lease_token=null,lease_until=null,revision=revision+1 where id=j.id;
  return;
 end if;
 if j.id is not null and j.status='ACTIVE' and j.user_id<>actor.user_id then raise exception 'SYNC_OWNER_CHANGE_REQUIRES_PAUSE'; end if;
 select display_name into label from public.users where id=actor.user_id;
 insert into public.jira_sync_jobs(workspace_id,organization_id,initiative_id,item_id,user_id,owner_label,connection_id,connection_granted_at,status)
 values(p_workspace_id,actor.organization_id,i.id,p_item_id,actor.user_id,label,c.id,c.connected_at,'ACTIVE')
 on conflict(workspace_id,initiative_id,item_id) do update set user_id=excluded.user_id,owner_label=excluded.owner_label,connection_id=excluded.connection_id,
 connection_granted_at=excluded.connection_granted_at,status='ACTIVE',next_run_at=clock_timestamp(),last_error=null,failures=0,lease_token=null,lease_until=null,revision=public.jira_sync_jobs.revision+1;
end$$;

-- A connection lease serializes background token usage across all of its initiatives.
-- The transaction ends before any network I/O. Crashed workers recover after five minutes.
create function public.claim_jira_sync() returns jsonb language plpgsql set search_path='' as $$
declare c public.connector_connections; j public.jira_sync_jobs; token uuid:=gen_random_uuid(); at_time timestamptz:=clock_timestamp();
begin
 select * into c from public.connector_connections c0 where c0.provider='JIRA'
  and (c0.sync_lease_until is null or c0.sync_lease_until<=at_time)
  and exists(select 1 from public.jira_sync_jobs j0 where j0.connection_id=c0.id and j0.status='ACTIVE' and j0.next_run_at<=at_time and (j0.lease_until is null or j0.lease_until<=at_time))
  order by (select min(j1.next_run_at) from public.jira_sync_jobs j1 where j1.connection_id=c0.id and j1.status='ACTIVE'),c0.id
  for update of c0 skip locked limit 1;
 if not found then return null; end if;
 select * into j from public.jira_sync_jobs where connection_id=c.id and status='ACTIVE' and next_run_at<=at_time and (lease_until is null or lease_until<=at_time)
  order by next_run_at,id for update skip locked limit 1;
 if not found then return null; end if;
 update public.connector_connections set sync_lease_token=token,sync_lease_until=at_time+interval '5 minutes' where id=c.id;
 update public.jira_sync_jobs set lease_token=token,lease_until=at_time+interval '5 minutes',last_attempt_at=at_time,revision=revision+1 where id=j.id returning * into j;
 return to_jsonb(j);
end$$;

-- Scope/lease bound publication, with a single transaction for evidence and completion.
-- Failure completion needs no user grant: it can stop an already-revoked job, never save evidence.
create function public.finish_jira_sync(p_job_id uuid,p_token uuid,p_revision integer,p_sync_revision integer,p_snapshot jsonb,p_error text default null)
returns jsonb language plpgsql set search_path='' as $$
declare prior public.jira_sync_jobs; j public.jira_sync_jobs; c public.connector_connections; actor public.organization_memberships;
 i public.initiatives; item public.source_items; container public.source_containers; sync public.source_item_syncs;
 result jsonb; code text:=p_error; permanent boolean:=false; at_time timestamptz; principal uuid; failure_count integer;
begin
 if p_token is null or p_revision is null or (p_snapshot is null)=(p_error is null) then raise exception 'INVALID_COMPLETION'; end if;
 if p_error is not null and p_error not in ('NOT_CONNECTED','NEEDS_RECONNECT','NO_ACCESS','NOT_FOUND','DEMO_ORGANIZATION','NOT_CONFIGURED','INVALID_REQUEST','ACCESS_REVOKED','PROVIDER_UNAVAILABLE','RATE_LIMITED','SYNC_FAILED','UNSUPPORTED','VIEW_ONLY','SCOPE_REFUSED') then raise exception 'INVALID_COMPLETION'; end if;
 select * into prior from public.jira_sync_jobs where id=p_job_id;
 if not found then return jsonb_build_object('outcome','STALE'); end if;
 if p_snapshot is not null then
  -- Keep errors caught here limited to expected access loss. Database failures must roll back.
  begin
   select id into principal from public.organization_memberships where organization_id=prior.organization_id and user_id=prior.user_id;
   actor:=public.jira_sync_actor(prior.workspace_id,coalesce(principal,prior.user_id));
   if actor.user_id<>prior.user_id or actor.organization_id<>prior.organization_id then raise exception 'ACCESS_DENIED'; end if;
   select * into i from public.initiatives where id=prior.initiative_id and workspace_id=prior.workspace_id for update;
   if not found or i.archived_at is not null then raise exception 'SOURCE_ACCESS'; end if;
   perform 1 from public.source_mappings where workspace_id=prior.workspace_id and initiative_id=prior.initiative_id and item_id=prior.item_id and unlinked_at is null for share;
   if not found then raise exception 'SOURCE_ACCESS'; end if;
   select * into sync from public.source_item_syncs where workspace_id=prior.workspace_id and initiative_id=prior.initiative_id and item_id=prior.item_id and connector='JIRA' for update;
   if not found then raise exception 'SOURCE_ACCESS'; end if;
   select * into item from public.source_items where id=prior.item_id and workspace_id=prior.workspace_id for share;
   select * into container from public.source_containers where id=item.container_id and workspace_id=prior.workspace_id for share;
   if container.provider is distinct from 'JIRA' then raise exception 'SOURCE_ACCESS'; end if;
  exception when raise_exception then
   if sqlerrm in ('ACCESS_DENIED','EMAIL_NOT_ALLOWED','OWNER_BOOTSTRAP_REQUIRED','VIEW_ONLY','DEMO_ORGANIZATION','SOURCE_ACCESS') then code:='ACCESS_REVOKED'; else raise; end if;
  end;
 end if;
 -- Connection before job: same lock order as claim/configuration.
 select * into c from public.connector_connections where id=prior.connection_id for update;
 select * into j from public.jira_sync_jobs where id=p_job_id for update;
 at_time:=clock_timestamp();
 if j.status<>'ACTIVE' or j.lease_token is distinct from p_token or j.revision<>p_revision or j.lease_until<=at_time
  or c.sync_lease_token is distinct from p_token or c.sync_lease_until<=at_time then
  update public.connector_connections set sync_lease_token=null,sync_lease_until=null where id=prior.connection_id and sync_lease_token=p_token;
  return jsonb_build_object('outcome','STALE');
 end if;
 if code is null and (c.status<>'CONNECTED' or c.organization_id<>j.organization_id or c.user_id<>j.user_id or c.provider<>'JIRA' or c.connected_at is distinct from j.connection_granted_at or c.sealed_tokens is null) then code:='NOT_CONNECTED'; end if;
 if code is null and sync.revision is distinct from p_sync_revision then code:='CHECK_SUPERSEDED'; end if;
 if code is null then
  if p_snapshot->>'connector' is distinct from 'JIRA' or p_snapshot->>'provider' is distinct from 'JIRA'
   or p_snapshot->>'providerWorkspace' is distinct from container.provider_workspace
   or p_snapshot->>'containerReference' is distinct from container.reference
   or p_snapshot#>>'{item,reference}' is distinct from item.reference then raise exception 'SNAPSHOT_SCOPE'; end if;
  result:=public.import_connector_snapshot(j.workspace_id,coalesce(actor.id,actor.user_id),p_snapshot||jsonb_build_object('initiativeId',j.initiative_id,'mode','REFRESH','role','GENERAL','requestId',gen_random_uuid()));
 end if;
 permanent:=code in ('NOT_CONNECTED','NEEDS_RECONNECT','NO_ACCESS','NOT_FOUND','DEMO_ORGANIZATION','NOT_CONFIGURED','INVALID_REQUEST','ACCESS_REVOKED','UNSUPPORTED','VIEW_ONLY','SCOPE_REFUSED');
 failure_count:=case when code is null then 0 else j.failures+1 end;
 update public.jira_sync_jobs set status=case when coalesce(permanent,false) then 'ATTENTION' else 'ACTIVE' end,
  failures=failure_count,last_error=code,last_success_at=case when code is null then at_time else last_success_at end,
  next_run_at=at_time+make_interval(secs=>case when code is null then 900 else least(21600,900*power(2,least(failure_count-1,5)))::integer end),
  lease_token=null,lease_until=null,revision=revision+1 where id=j.id;
 update public.connector_connections set sync_lease_token=null,sync_lease_until=null where id=c.id and sync_lease_token=p_token;
 return jsonb_build_object('outcome',case when code='CHECK_SUPERSEDED' then 'STALE' when code is not null then 'FAILED' when (result->>'changed')::boolean then 'SAVED' else 'UNCHANGED' end,'code',code);
end$$;

revoke all on function public.jira_sync_actor(uuid,uuid),public.configure_jira_sync(uuid,uuid,uuid,uuid,boolean,integer),public.claim_jira_sync(),public.finish_jira_sync(uuid,uuid,integer,integer,jsonb,text) from public,anon,authenticated;
grant execute on function public.jira_sync_actor(uuid,uuid),public.configure_jira_sync(uuid,uuid,uuid,uuid,boolean,integer),public.claim_jira_sync(),public.finish_jira_sync(uuid,uuid,integer,integer,jsonb,text) to service_role;
commit;
