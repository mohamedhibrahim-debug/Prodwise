begin;
create function public.read_executive_part(p_workspace_id uuid,p_organization_id uuid,p_member_id uuid,p_offset integer,p_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare snapshot jsonb; rev integer;
begin
  perform public.require_workspace_member(p_workspace_id,p_member_id,false,false);
  if p_offset is null or p_offset < -1 or p_offset > 300000 or (p_offset >= 0 and p_revision is null)
    then raise exception 'INVALID_REPORTING_PAGE'; end if;
  select data,revision into snapshot,rev from public.executive_workspaces
    where workspace_id=p_workspace_id and organization_id=p_organization_id;
  if not found then return null; end if;
  if p_offset=-1 then
    return jsonb_build_object('state',(snapshot-'rows')||'{"rows":[]}'::jsonb,'rowCount',jsonb_array_length(snapshot->'rows'),'revision',rev);
  end if;
  if rev<>p_revision then raise exception 'STALE_REPORTING_READ'; end if;
  return jsonb_build_object('revision',rev,'rows',jsonb_path_query_array(snapshot,format('$.rows[%s to %s]',p_offset,p_offset+4999)::jsonpath));
end $$;
revoke all on function public.read_executive_part(uuid,uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.read_executive_part(uuid,uuid,uuid,integer,integer) to service_role;
notify pgrst,'reload schema';
commit;
