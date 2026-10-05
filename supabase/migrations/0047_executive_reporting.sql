-- Initial scoped reporting store; no client-side table or RPC access.
create table if not exists public.executive_workspaces (
  workspace_id uuid primary key references public.workspaces(id),
  organization_id uuid not null references public.organizations(id),
  revision integer not null default 0,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(data) = 'object' and data->>'schema' = '1')
);
alter table public.executive_workspaces enable row level security;
revoke all on public.executive_workspaces from anon, authenticated;
grant all on public.executive_workspaces to service_role;

create or replace function public.commit_executive_workspace(
  p_workspace_id uuid, p_member_id uuid, p_expected_revision integer, p_data jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare org uuid; current_revision integer;
begin
  perform public.require_workspace_member(p_workspace_id, p_member_id, false, true);
  select organization_id into org from public.workspaces where id = p_workspace_id;
  perform pg_advisory_xact_lock(hashtextextended('executive:' || p_workspace_id::text, 0));
  select revision into current_revision from public.executive_workspaces where workspace_id = p_workspace_id for update;
  if coalesce(current_revision, 0) <> p_expected_revision then raise exception 'STALE_EXECUTIVE'; end if;
  if p_data is null or p_data->>'schema' is distinct from '1' or (p_data->>'revision')::integer is distinct from p_expected_revision + 1
    or jsonb_typeof(p_data->'rows') is distinct from 'array' or jsonb_typeof(p_data->'plans') is distinct from 'array'
    or jsonb_typeof(p_data->'imports') is distinct from 'array' or jsonb_typeof(p_data->'aggregates') is distinct from 'array'
    or jsonb_typeof(p_data->'targets') is distinct from 'array' or jsonb_typeof(p_data->'planEvents') is distinct from 'array'
    then raise exception 'INVALID_EXECUTIVE'; end if;
  insert into public.executive_workspaces(workspace_id, organization_id, revision, data)
  values(p_workspace_id, org, p_expected_revision + 1, p_data)
  on conflict(workspace_id) do update set revision = excluded.revision, data = excluded.data, updated_at = now();
end $$;
revoke all on function public.commit_executive_workspace(uuid, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.commit_executive_workspace(uuid, uuid, integer, jsonb) to service_role;
