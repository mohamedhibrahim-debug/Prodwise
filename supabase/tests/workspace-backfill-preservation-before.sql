-- Disposable local fixture only; captures every original column before 0010.
\set ON_ERROR_STOP on
do $$ begin
 if current_database() !~ '^prodwise_platform_preflight_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_PREFLIGHT_DATABASE_REQUIRED';end if;
end $$;
create schema preflight;
-- Exercise both an open state and an immutable recorded decision; neither
-- should become a new product change merely because tenant scope was added.
insert into public.finding_states(initiative_id,fingerprint,rule_id,subject,attribute,status,created_at,updated_at)
values('11111111-1111-4111-8111-111111111111','backfill-open-proof','LOCAL_PRESERVATION_PROOF','Synthetic preservation fixture',null,'OPEN','2020-02-03T04:05:06.123456Z','2021-03-04T05:06:07.234567Z');
insert into public.finding_states(initiative_id,fingerprint,rule_id,subject,status,resolution,resolved_at,outcome,chosen_claim_id,decided_value,actor_id,actor_label,created_at,updated_at)
select initiative_id,'backfill-decision-proof','LOCAL_PRESERVATION_PROOF','Synthetic immutable decision','RESOLVED','Retain recorded decision','2021-03-04T05:06:07.234567Z','CHOSE_EXISTING',id,value,'fictional-preservation-actor','Fictional preservation actor','2020-02-03T04:05:06.123456Z','2021-03-04T05:06:07.234567Z'
from public.claims where initiative_id='11111111-1111-4111-8111-111111111111' order by id limit 1;
create table preflight.original_business(table_name text primary key,rows jsonb not null);
do $$ declare name text; captured jsonb;begin
 foreach name in array array['users','initiatives','initiative_sources','evidence','claims','claim_evidence','finding_states','activity_log'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from public.%I t',name) into captured;
  if jsonb_array_length(captured)=0 then raise exception 'PRESERVATION_FIXTURE_MUST_BE_NONEMPTY: %',name;end if;
  insert into preflight.original_business values(name,captured);
 end loop;
end $$;
