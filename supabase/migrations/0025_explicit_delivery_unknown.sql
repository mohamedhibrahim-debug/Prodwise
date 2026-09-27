begin;
do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.delivery_facts'::regclass and contype='c' and pg_get_constraintdef(oid) like '%SOLUTION_DEFINED%' and pg_get_constraintdef(oid) like '%value_date IS NOT NULL%' loop
  execute format('alter table public.delivery_facts drop constraint %I',c.conname);
 end loop;
end$$;
alter table public.delivery_facts add constraint delivery_explicit_unknown_shape check(
 (not (data->'value' ? 'unknown') or jsonb_typeof(data#>'{value,unknown}')='boolean') and
 (not (data->'value' ? 'dateUnknown') or jsonb_typeof(data#>'{value,dateUnknown}')='boolean') and
 (data->>'state'='RETRACTED' or (
  (coalesce(data#>'{value,unknown}','false'::jsonb)<>'true'::jsonb or
   (kind in ('TARGET_LIVE','DEV_STARTED','NEXT_MILESTONE') and value_date is null and value_text is null and owner_member_id is null and data#>>'{value,extent}' is null and coalesce(data#>'{value,dateUnknown}','false'::jsonb)<>'true'::jsonb)) and
  (coalesce(data#>'{value,dateUnknown}','false'::jsonb)<>'true'::jsonb or
   (kind='NEXT_MILESTONE' and value_date is null and coalesce(length(btrim(value_text)),0)>0 and coalesce(data#>'{value,unknown}','false'::jsonb)<>'true'::jsonb)) and
  (kind not in ('SOLUTION_DEFINED','DEV_STARTED','TARGET_LIVE','ACTUAL_LIVE') or value_date is not null or (kind in ('DEV_STARTED','TARGET_LIVE') and coalesce(data#>'{value,unknown}','false'::jsonb)='true'::jsonb))
 )));
commit;
