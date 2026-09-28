-- Run only against the disposable Second Mission replay. All fixture changes roll back.
\set ON_ERROR_STOP on
do $$begin if current_database() !~ '^prodwise_second_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_LOCAL_DATABASE_REQUIRED';end if;end$$;
begin;
set local role service_role;
insert into public.initiatives(id,workspace_id,slug,name,business_line,stage) values('e4100000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000002','synthetic-baseline-test','Synthetic baseline test','FS','DISCOVERY');
set constraints all immediate;
do $$declare i uuid:='e4100000-0000-4000-8000-000000000001';r record;begin
 select * into r from public.activity_log where initiative_id=i and event_type in ('READINESS_REACHED','READINESS_LOST');
 if not found then raise exception 'TEST_NO_BASELINE';end if;
 if r.event_type<>'READINESS_LOST' or (r.payload->>'baseline')::boolean is not true or r.actor_id is not null or r.actor_label is not null then raise exception 'TEST_BASELINE_SHAPE %',row_to_json(r);end if;
 update public.initiatives set description='Still incomplete' where id=i;
 set constraints all immediate;
 if (select count(*) from public.activity_log where initiative_id=i and event_type in ('READINESS_REACHED','READINESS_LOST'))<>1 then raise exception 'TEST_REPEATED_BASELINE';end if;
 raise notice 'PASS: the first setup observation is one actorless baseline; unchanged setup adds nothing';
end$$;
reset role;
rollback;
-- Public functions are not invocable by the anonymous or signed-in database roles.
do $$begin
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE')))
 then raise exception 'TEST_PUBLIC_FUNCTION_EXECUTE';end if;
 raise notice 'PASS: no public function is executable by anon or authenticated';
end$$;
-- A confirmed entry's content cannot be changed in place; its status can.
begin;
set local role service_role;
do $$declare c public.claims;begin
 select * into c from public.claims where status='ACTIVE' limit 1;
 if not found then raise exception 'TEST_NO_ACTIVE_CLAIM';end if;
 begin update public.claims set value=value||' changed' where id=c.id;raise exception 'TEST_CONFIRMED_CONTENT_CHANGED';
 exception when others then if sqlerrm<>'CONFIRMED_CLAIM_CONTENT_IMMUTABLE' then raise;end if;end;
 raise notice 'PASS: confirmed entry content is immutable';
end$$;
reset role;
rollback;
