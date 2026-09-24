begin;
do $$
declare v_plan jsonb; v_result jsonb; v_state public.finding_states%rowtype;
begin
  v_plan := public.stage22_test_plan('CHOSE_EXISTING',
    'cccc0001-0000-4000-8000-000000000004',null);
  v_result := public.resolve_conflict(v_plan);
  select * into v_state from public.finding_states
    where fingerprint=v_plan->>'fingerprint';
  if v_result->>'chosenClaimId' <> 'cccc0001-0000-4000-8000-000000000004'
     or v_state.outcome <> 'CHOSE_EXISTING' or v_state.decided_value <> '30'
     or (select status from public.claims where id='cccc0001-0000-4000-8000-000000000004') <> 'ACTIVE'
     or (select superseded_by_claim_id from public.claims
         where id='cccc0001-0000-4000-8000-000000000003') <>
        'cccc0001-0000-4000-8000-000000000004' then
    raise exception 'Choose 30 failed';
  end if;
end $$;
rollback;

begin;
do $$
declare v_plan jsonb; v_result jsonb; v_claim public.claims%rowtype;
begin
  v_plan := public.stage22_test_plan('CORRECTED_VALUE',null,' 28 ', 'FINANCE');
  v_result := public.resolve_conflict(v_plan);
  select * into v_claim from public.claims where id=(v_result->>'decisionClaimId')::uuid;
  if v_claim.origin <> 'HUMAN_DECISION' or v_claim.type <> 'DECISION'
     or v_claim.status <> 'ACTIVE' or v_claim.value <> '28'
     or v_claim.verification_basis <> 'DIRECT_KNOWLEDGE'
     or v_claim.verification_note <> 'Confirmed divisor from direct knowledge'
     or v_claim.verified_at is null or v_claim.verified_actor_label <> 'Demo reviewer'
     or (select count(*) from public.claim_evidence where claim_id=v_claim.id) <> 0
     or (select count(*) from public.claims where id in
       ('cccc0001-0000-4000-8000-000000000003',
        'cccc0001-0000-4000-8000-000000000004')
       and status='SUPERSEDED' and superseded_by_claim_id=v_claim.id) <> 2 then
    raise exception 'Corrected value failed';
  end if;
end $$;
rollback;

begin;
do $$
begin
  begin
    perform public.resolve_conflict(public.stage22_test_plan('CORRECTED_VALUE',null,'27','FINANCE'));
    raise exception 'Corrected existing value unexpectedly succeeded';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'CHOOSE_EXISTING_VALUE' then raise; end if;
  end;
  if (select count(*) from public.activity_log where event_type='FINDING_DECIDED') <> 0
    or (select count(*) from public.claims where origin='HUMAN_DECISION') <> 0 then
    raise exception 'Refused decision had side effects';
  end if;
end $$;
rollback;
