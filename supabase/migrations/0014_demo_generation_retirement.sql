-- Additive retirement state only. Applying this migration archives nothing.
-- A trusted operator must pin demo_scenarios organization/workspace IDs and
-- review a generation-reset plan. No generic public archival RPC is added.
-- Business rows and immutable Final review history must remain unchanged.
begin;
alter table public.organizations drop constraint organizations_status_check;
alter table public.organizations add constraint organizations_status_check
 check(status in ('BOOTSTRAPPING','ACTIVE','ARCHIVED'));
alter table public.workspaces drop constraint workspaces_status_check;
alter table public.workspaces add constraint workspaces_status_check
 check(status in ('BOOTSTRAPPING','ACTIVE','ARCHIVED'));
comment on column public.organizations.status is
 'BOOTSTRAPPING awaits an owner; ACTIVE requires at least one active organization owner; ARCHIVED retains recorded history and is unavailable to normal operational access.';
comment on column public.workspaces.status is
 'BOOTSTRAPPING, ACTIVE or ARCHIVED. Demo resets retire an explicitly registered generation without deleting business records or Final reviews.';

-- Preserve the current authority validator; add only retirement checks. Global
-- platform settings APIs remain separate recovery paths, but archived business
-- workspaces/organizations cannot be opened through ordinary workspace access.
do $$ declare body text; old_scope text; old_ready text; begin
 select pg_get_functiondef('public.require_workspace_member(uuid,uuid,boolean,boolean)'::regprocedure) into body;
 old_scope='select organization_id into oid from public.workspaces where id=p_workspace_id;if oid is null then raise exception ''ACCESS_DENIED'';end if;';
 old_ready='if not exists(select 1 from public.organizations where id=oid and status=''ACTIVE'') or not exists';
 if position(old_scope in body)=0 or position(old_ready in body)=0 then raise exception 'ARCHIVAL_VALIDATOR_VERSION';end if;
 body=replace(body,old_scope,'select organization_id into oid from public.workspaces where id=p_workspace_id;if oid is null or exists(select 1 from public.workspaces where id=p_workspace_id and status=''ARCHIVED'') or exists(select 1 from public.organizations where id=oid and status=''ARCHIVED'') then raise exception ''ACCESS_DENIED'';end if;');
 body=replace(body,old_ready,'if not exists(select 1 from public.workspaces where id=p_workspace_id and status=''ACTIVE'') or not exists(select 1 from public.organizations where id=oid and status=''ACTIVE'') or not exists');
 execute body;
end $$;

-- An old link must not reactivate an archived generation via acceptance. This
-- applies to normal and platform-origin invitations; management recovery is
-- an explicit platform action from an active scope instead.
do $$ declare body text; old_guard text; begin
 select pg_get_functiondef('public.inspect_workspace_invitation(uuid,text)'::regprocedure) into body;
 old_guard='if not found or item.revoked_at is not null or item.used_at is not null or item.expires_at<=clock_timestamp() then raise exception ''INVITE_INVALID'';end if;';
 if position(old_guard in body)=0 then raise exception 'ARCHIVAL_INVITATION_VALIDATOR_VERSION';end if;
 body=replace(body,old_guard,'if not found or item.revoked_at is not null or item.used_at is not null or item.expires_at<=clock_timestamp() or exists(select 1 from public.workspaces where id=item.workspace_id and status=''ARCHIVED'') or exists(select 1 from public.organizations where id=item.organization_id and status=''ARCHIVED'') then raise exception ''INVITE_INVALID'';end if;');
 execute body;
end $$;
commit;
