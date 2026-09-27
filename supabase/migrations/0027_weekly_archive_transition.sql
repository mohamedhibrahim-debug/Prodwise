begin;
create function public.weekly_section_ids(p_input jsonb,p_baseline jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(s#>>'{initiative,id}' order by s#>>'{initiative,id}'),'[]'::jsonb)
 from jsonb_array_elements(p_input->'snapshots') s
 where s#>>'{initiative,archivedAt}' is null or not exists(select 1 from jsonb_array_elements(coalesce(p_baseline->'snapshots','[]'::jsonb)) b where b#>>'{initiative,id}'=s#>>'{initiative,id}' and b#>>'{initiative,archivedAt}'=s#>>'{initiative,archivedAt}');
$$;
do $$declare body text;old_guard text;new_guard text;begin
 select pg_get_functiondef('public.delivery_commit_workspace(uuid,uuid,jsonb,jsonb,jsonb)'::regprocedure) into body;
 old_guard:='if jsonb_array_length(v_item->''sections'')<>jsonb_array_length(v_item#>''{input,snapshots}'') or exists(select 1 from jsonb_array_elements(v_item->''sections'') s where not exists(select 1 from jsonb_array_elements(v_item#>''{input,snapshots}'') snap where snap#>>''{initiative,id}''=s->>''initiativeId'')) or exists(select 1 from jsonb_array_elements(v_item->''sections'') s group by s->>''initiativeId'' having count(*)<>1) then raise exception ''SECTION_INVENTORY''; end if;';
 new_guard:='if coalesce((select jsonb_agg(s->>''initiativeId'' order by s->>''initiativeId'') from jsonb_array_elements(v_item->''sections'') s),''[]''::jsonb) is distinct from public.weekly_section_ids(v_item->''input'',(select r.data->''input'' from public.weekly_reviews r where r.id::text=v_baseline and r.workspace_id=p_workspace_id)) then raise exception ''SECTION_INVENTORY'';end if;';
 if position(old_guard in body)=0 then raise exception 'WEEKLY_INVENTORY_GUARD_VERSION';end if;
 execute replace(body,old_guard,new_guard);
end$$;
revoke all on function public.weekly_section_ids(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.weekly_section_ids(jsonb,jsonb) to service_role;
commit;
