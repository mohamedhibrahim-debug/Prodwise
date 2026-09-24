begin;
do $$
declare v_plan jsonb;
begin
  v_plan := public.stage22_test_plan('CHOSE_EXISTING',
    'cccc0001-0000-4000-8000-000000000003',null);
  begin
    perform public.resolve_conflict(jsonb_set(v_plan,'{contentDigest}','"stale"'::jsonb));
    raise exception 'Stale digest accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'FINDING_STALE' then raise; end if;
  end;
  update public.claims set updated_at=updated_at+interval '1 second'
    where id='cccc0001-0000-4000-8000-000000000004';
  begin
    perform public.resolve_conflict(v_plan);
    raise exception 'Member changed after render accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'CLAIM_STALE' then raise; end if;
  end;
  if (select count(*) from public.activity_log where event_type='FINDING_DECIDED') <> 0 then
    raise exception 'Stale attempts produced audit';
  end if;
end $$;
rollback;

create function public.stage22_fail_state() returns trigger
language plpgsql as $$ begin raise exception 'TEST_STATE_FAILURE'; end $$;
create trigger stage22_fail_state before insert or update on public.finding_states
  for each row execute function public.stage22_fail_state();
do $$
begin
  begin
    perform public.resolve_conflict(public.stage22_test_plan('CORRECTED_VALUE',null,'28','FINANCE'));
    raise exception 'Injected finding-state failure did not fail';
  exception when others then
    if sqlerrm <> 'TEST_STATE_FAILURE' then raise; end if;
  end;
  if (select count(*) from public.claims where origin='HUMAN_DECISION') <> 0
    or (select status from public.claims where id='cccc0001-0000-4000-8000-000000000003') <> 'ACTIVE'
    or (select count(*) from public.activity_log where event_type='FINDING_DECIDED') <> 0 then
    raise exception 'Claim mutation survived failed state write';
  end if;
end $$;
drop trigger stage22_fail_state on public.finding_states;
drop function public.stage22_fail_state();

create function public.stage22_fail_audit() returns trigger
language plpgsql as $$
begin
  if new.event_type='FINDING_DECIDED' then raise exception 'TEST_AUDIT_FAILURE'; end if;
  return new;
end $$;
create trigger stage22_fail_audit before insert on public.activity_log
  for each row execute function public.stage22_fail_audit();
do $$
begin
  begin
    perform public.resolve_conflict(public.stage22_test_plan('CORRECTED_VALUE',null,'28','FINANCE'));
    raise exception 'Injected audit failure did not fail';
  exception when others then
    if sqlerrm <> 'TEST_AUDIT_FAILURE' then raise; end if;
  end;
  if (select count(*) from public.claims where origin='HUMAN_DECISION') <> 0
    or (select status from public.claims where id='cccc0001-0000-4000-8000-000000000004') <> 'ACTIVE'
    or (select count(*) from public.finding_states where outcome is not null) <> 0 then
    raise exception 'Claim or state mutation survived failed audit';
  end if;
end $$;
drop trigger stage22_fail_audit on public.activity_log;
drop function public.stage22_fail_audit();
