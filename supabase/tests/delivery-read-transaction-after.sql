\set ON_ERROR_STOP on
select preflight.assert((select provolatile='v' from pg_proc where oid='public.delivery_read_workspace(uuid,uuid)'::regprocedure),'RPC metadata now chooses READ WRITE for POST');
select preflight.assert((select to_jsonb(p) from preflight.rpc_properties_before p)=(select to_jsonb(p) from (select oid,prosrc,proacl,proowner,prolang,prosecdef,proconfig,proargtypes,prorettype from pg_proc where oid='public.delivery_read_workspace(uuid,uuid)'::regprocedure) p),'body, OID, grants, owner, language, security, config, arguments and return type unchanged');
-- VOLATILE does not bypass a READ ONLY transaction; its lock is still refused.
begin read only;
set local role service_role;
select preflight.expect_readonly_rpc_failure();
commit;
-- The POST transaction selected by VOLATILE can now run the fresh membership
-- guard. Both a platform principal and ordinary scoped Member/Viewer can read.
begin read write;
set local role service_role;
select preflight.assert(jsonb_array_length(public.delivery_read_workspace(preflight.id('workspace-a'),preflight.id('platform'))#>'{source,snapshots}')=1,'platform service-role read returns only selected workspace');
select preflight.assert(jsonb_array_length(public.delivery_read_workspace(preflight.id('workspace-a'),preflight.id('member-shared'))#>'{source,snapshots}')=1,'ordinary Member service-role read works');
select preflight.assert(jsonb_array_length(public.delivery_read_workspace(preflight.id('workspace-a'),preflight.id('member-viewer'))#>'{source,snapshots}')=1,'Viewer retains permitted read access');
select preflight.refused(format('select public.delivery_read_workspace(%L,%L)',preflight.id('workspace-b'),preflight.id('member-viewer')),'ACCESS_DENIED');
commit;
begin;
set local role anon;
select preflight.refused(format('select public.delivery_read_workspace(%L,%L)',preflight.id('workspace-a'),preflight.id('platform')),'permission denied');
commit;
begin;
set local role authenticated;
select preflight.refused(format('select public.delivery_read_workspace(%L,%L)',preflight.id('workspace-a'),preflight.id('platform')),'permission denied');
commit;
do $$ declare snapshot record; current_rows jsonb;begin
 for snapshot in select * from preflight.rpc_tables_before loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from public.%I t',snapshot.table_name) into current_rows;
  if current_rows is distinct from snapshot.rows then raise exception 'RPC_METADATA_OR_READ_CHANGED_ROWS: %',snapshot.table_name;end if;
 end loop;
 raise notice 'PASS: every original field/ID/timestamp/JSON/Final and authorization record unchanged in % public tables', (select count(*) from preflight.rpc_tables_before);
end $$;
\echo PASS: service-role POST transaction reads work; foreign membership/public access denied; schema metadata-only fix preserves all rows.
