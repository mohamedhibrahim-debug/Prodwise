do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='finding_states' and column_name='outcome')
    or to_regprocedure('public.resolve_conflict(jsonb)') is not null
    or to_regprocedure('public.set_finding_note(uuid,text,jsonb)') is not null
    or to_regtype('public.finding_outcome') is not null then
    raise exception 'Committed rollback left Stage 2.2 schema';
  end if;
  if not exists(select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
    where t.typname='claim_origin' and e.enumlabel='HUMAN_DECISION') then
    raise exception 'Expected retained enum label';
  end if;
end $$;
