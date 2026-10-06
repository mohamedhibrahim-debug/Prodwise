\set ON_ERROR_STOP on
do $$begin if current_database() !~ '^prodwise_sync_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_LOCAL_DATABASE_REQUIRED';end if;end$$;
begin;
set local role service_role;
do $$declare
 w uuid:='e4000000-0000-4000-8000-000000000011';m uuid:='e4000000-0000-4000-8000-000000000021';v uuid:='e4000000-0000-4000-8000-000000000023';
 value jsonb:='{"schema":1,"revision":1,"rows":[],"imports":[],"aggregates":[],"targets":[],"plans":[],"planEvents":[]}';
begin
 begin perform public.commit_executive_workspace(w,v,0,value);raise exception 'TEST_VIEWER';exception when others then if sqlerrm<>'VIEW_ONLY' then raise;end if;end;
 begin perform public.commit_executive_workspace('10000000-0000-4000-8000-000000000001',m,0,value);raise exception 'TEST_FOREIGN';exception when others then if sqlerrm<>'ACCESS_DENIED' then raise;end if;end;
 perform public.commit_executive_workspace(w,m,0,value);
 if (select data from public.executive_workspaces where workspace_id=w)<>value then raise exception 'TEST_ROUNDTRIP';end if;
 begin perform public.commit_executive_workspace(w,m,0,value);raise exception 'TEST_STALE';exception when others then if sqlerrm<>'STALE_EXECUTIVE' then raise;end if;end;
 begin perform public.commit_executive_workspace(w,m,1,value||'{"revision":2,"rows":null}'::jsonb);raise exception 'TEST_SHAPE';exception when others then if sqlerrm<>'INVALID_EXECUTIVE' then raise;end if;end;
 if (select revision from public.executive_workspaces where workspace_id=w)<>1 then raise exception 'TEST_FAILED_WRITE_CHANGED_DATA';end if;
 update public.organization_memberships set active=false where id=m;
 begin perform public.commit_executive_workspace(w,m,1,value||'{"revision":2}'::jsonb);raise exception 'TEST_REVOKED';exception when others then if sqlerrm<>'ACCESS_DENIED' then raise;end if;end;
 update public.organization_memberships set active=true where id=m;
 perform public.commit_executive_workspace(w,m,1,value||'{"revision":2}'::jsonb);
 if (select revision from public.executive_workspaces where workspace_id=w)<>2 then raise exception 'TEST_REVISION';end if;
 if has_function_privilege('authenticated','public.commit_executive_workspace(uuid,uuid,integer,jsonb)','EXECUTE')
 or has_table_privilege('anon','public.executive_workspaces','SELECT')
 or has_table_privilege('authenticated','public.reporting_uploads','SELECT') then raise exception 'TEST_PUBLIC_ACCESS';end if;
 raise notice 'PASS: executive storage round-trip, workspace isolation, Viewer denial, revoked actor, stale revision, invalid payload rollback, service-only access';
end$$;
rollback;
