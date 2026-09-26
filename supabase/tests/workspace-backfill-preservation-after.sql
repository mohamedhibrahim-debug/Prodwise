-- Read-only comparison plus a rolled-back NULL-scope rejection probe.
\set ON_ERROR_STOP on
do $$ declare snapshot record;current_rows jsonb;total integer=0;name text;begin
 if current_database() !~ '^prodwise_platform_preflight_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_PREFLIGHT_DATABASE_REQUIRED';end if;
 for snapshot in select * from preflight.original_business order by table_name loop
  if snapshot.table_name='users' then
   select coalesce(jsonb_agg(to_jsonb(t)-array['auth_user_id','is_system','platform_role','active'] order by (to_jsonb(t)-array['auth_user_id','is_system','platform_role','active'])::text),'[]'::jsonb) into current_rows from public.users t;
  else
   execute format('select coalesce(jsonb_agg(to_jsonb(t)-''workspace_id'' order by (to_jsonb(t)-''workspace_id'')::text),''[]''::jsonb) from public.%I t',snapshot.table_name) into current_rows;
   execute format('select count(*) from public.%I where workspace_id is distinct from %L::uuid',snapshot.table_name,'10000000-0000-4000-8000-000000000001') into total;
   if total<>0 then raise exception 'WRONG_BACKFILLED_SCOPE: %',snapshot.table_name;end if;
  end if;
  if current_rows is distinct from snapshot.rows then raise exception 'ORIGINAL_COLUMN_OR_ROW_CHANGED: %',snapshot.table_name;end if;
 end loop;
 foreach name in array array['initiatives','initiative_sources','evidence','claims','claim_evidence','finding_states','activity_log'] loop
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=name and column_name='workspace_id' and column_default is null and is_nullable='NO') then raise exception 'SCOPE_DEFAULT_OR_NULLABILITY_UNSAFE: %',name;end if;
 end loop;
 if (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and t.tgname like '%set_updated_at' and t.tgenabled='O')<>5 then raise exception 'HISTORY_TIMESTAMPS_TRIGGER_NOT_PRESERVED';end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.finding_states'::regclass and tgname='finding_states_guard_decision' and tgenabled='O') then raise exception 'DECISION_GUARD_NOT_PRESERVED';end if;
 begin
  insert into public.initiatives select (jsonb_populate_record(null::public.initiatives,to_jsonb(t)||jsonb_build_object('id','a1100000-0000-4000-8000-000000000001','slug','unscoped-preservation-probe','workspace_id',null))).* from public.initiatives t order by id limit 1;
  raise exception 'UNSCOPED_INSERT_ACCEPTED';
 exception when not_null_violation then null;
 end;
 raise notice 'PASS: all original columns/IDs/NULLs/enums/timestamps preserved for % rows across 8 populated tables; 7 scope defaults absent; timestamp and immutable decision guards enabled', (select sum(jsonb_array_length(rows)) from preflight.original_business);
end $$;
