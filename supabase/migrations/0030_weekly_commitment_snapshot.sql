-- Extend future snapshots only. Existing finalized JSON is never updated.
begin;
alter function public.delivery_source(uuid) rename to delivery_source_before_commitments;
create function public.delivery_source(p_workspace_id uuid) returns jsonb language sql stable set search_path='' as $$select public.delivery_source_before_commitments(p_workspace_id)||jsonb_build_object('commitments',coalesce((select jsonb_agg(data order by id) from public.actions where workspace_id=p_workspace_id),'[]'::jsonb))$$;
revoke all on function public.delivery_source(uuid),public.delivery_source_before_commitments(uuid) from public,anon,authenticated;
grant execute on function public.delivery_source(uuid),public.delivery_source_before_commitments(uuid) to service_role;
do $$declare definition text;needle text:='if public.delivery_meaningful(v_item#>''{input,snapshots}'')';begin
 select pg_get_functiondef('public.delivery_commit_workspace(uuid,uuid,jsonb,jsonb,jsonb)'::regprocedure) into definition;
 if position(needle in definition)=0 then raise exception 'COMMITMENT_SNAPSHOT_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,needle,'if coalesce(v_item#>''{input,commitments}'',''[]''::jsonb) is distinct from coalesce(v_live_input->''commitments'',''[]''::jsonb) then raise exception ''STALE_COMMITMENTS'';end if; '||needle);
 execute definition;
end$$;
commit;
