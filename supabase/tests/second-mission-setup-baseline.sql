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
