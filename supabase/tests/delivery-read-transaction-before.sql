-- Mimic the actual PostgREST STABLE POST transaction under service_role.
\set ON_ERROR_STOP on
do $$ begin
 if current_database() !~ '^prodwise_platform_preflight_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_PREFLIGHT_DATABASE_REQUIRED';end if;
end $$;
select preflight.assert((select provolatile='s' from pg_proc where oid='public.delivery_read_workspace(uuid,uuid)'::regprocedure),'negative control requires the released STABLE RPC');
create table preflight.rpc_properties_before as
 select oid,prosrc,proacl,proowner,prolang,prosecdef,proconfig,proargtypes,prorettype from pg_proc where oid='public.delivery_read_workspace(uuid,uuid)'::regprocedure;
create table preflight.rpc_tables_before(table_name text primary key,rows jsonb not null);
do $$ declare name text; captured jsonb;begin
 for name in select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from public.%I t',name) into captured;
  insert into preflight.rpc_tables_before values(name,captured);
 end loop;
end $$;
create function preflight.expect_readonly_rpc_failure() returns void language plpgsql security invoker set search_path='' as $$begin
 begin
  perform public.delivery_read_workspace(preflight.id('workspace-a'),preflight.id('platform'));
 exception when sqlstate '25006' then return;
 end;
 raise exception 'EXPECTED_25006_READ_ONLY_LOCK_REFUSAL';
end $$;
grant execute on function preflight.expect_readonly_rpc_failure() to service_role;
begin read only;
set local role service_role;
select preflight.expect_readonly_rpc_failure();
commit;
\echo PASS: released STABLE service-role RPC reproduces actual PostgREST SQLSTATE 25006 in READ ONLY.
