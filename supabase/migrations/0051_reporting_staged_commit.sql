begin;
create table public.reporting_save_parts (
  batch_id uuid not null,
  part integer not null check(part>=0 and part<512),
  workspace_id uuid not null references public.workspaces(id),
  member_id uuid not null,
  expected_revision integer not null check(expected_revision>=0),
  rows jsonb not null check(jsonb_typeof(rows)='array' and jsonb_array_length(rows) between 1 and 5000),
  expires_at timestamptz not null default (now()+interval '30 minutes'),
  primary key(batch_id,part)
);
create index reporting_save_parts_expiry on public.reporting_save_parts(expires_at);
alter table public.reporting_save_parts enable row level security;
revoke all on public.reporting_save_parts from public,anon,authenticated;
grant select,insert,delete on public.reporting_save_parts to service_role;

create function public.commit_executive_parts(p_workspace_id uuid,p_member_id uuid,p_expected_revision integer,p_batch_id uuid,p_part_count integer,p_data jsonb)
returns void language plpgsql security definer set search_path='' set statement_timeout='60s' as $$
declare assembled jsonb; actual_count integer; total_rows bigint;
begin
  perform public.require_workspace_member(p_workspace_id,p_member_id,false,true);
  if p_batch_id is null or p_part_count is null or p_part_count<0 or p_part_count>512
    or p_data is null or p_data->'rows' is distinct from '[]'::jsonb
    or octet_length(p_data::text)>2000000 then raise exception 'INVALID_REPORTING_PARTS'; end if;
  perform pg_advisory_xact_lock(hashtextextended('reporting-parts:'||p_batch_id::text,0));
  -- Lock every part until the canonical, revision-checked publication commits.
  perform 1 from public.reporting_save_parts where batch_id=p_batch_id for update;
  if exists(select 1 from public.reporting_save_parts where batch_id=p_batch_id and
    (workspace_id<>p_workspace_id or member_id<>p_member_id or expected_revision<>p_expected_revision or expires_at<=clock_timestamp()))
    then raise exception 'INVALID_REPORTING_PARTS'; end if;
  select count(*),coalesce(sum(jsonb_array_length(rows)),0) into actual_count,total_rows
    from public.reporting_save_parts where batch_id=p_batch_id;
  if actual_count<>p_part_count or total_rows>300000 or exists(select 1 from public.reporting_save_parts where batch_id=p_batch_id and part>=p_part_count)
    then raise exception 'INCOMPLETE_REPORTING_PARTS'; end if;
  select coalesce(jsonb_agg(r.value order by s.part,r.ordinality),'[]'::jsonb) into assembled
    from public.reporting_save_parts s cross join lateral jsonb_array_elements(s.rows) with ordinality r(value,ordinality)
    where s.batch_id=p_batch_id;
  perform public.commit_executive_workspace(p_workspace_id,p_member_id,p_expected_revision,jsonb_set(p_data,'{rows}',assembled));
  delete from public.reporting_save_parts where batch_id=p_batch_id;
end $$;
revoke all on function public.commit_executive_parts(uuid,uuid,integer,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.commit_executive_parts(uuid,uuid,integer,uuid,integer,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
