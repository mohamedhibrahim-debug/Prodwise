begin;
do $$
declare v_result jsonb; v_plan jsonb; v_chosen_before jsonb;
begin
  select to_jsonb(c) into v_chosen_before from public.claims c
    where id='cccc0001-0000-4000-8000-000000000003';
  select jsonb_build_object(
    'initiativeId','11111111-1111-4111-8111-111111111111',
    'fingerprint','f2f628a25ea8bcf38ef8db92896bbcc1f61b20e159c3d7635ed85c98dd84f5ca',
    'ruleId','CONFLICT_SAME_ATTRIBUTE_V1',
    'contentDigest','ac062aa621ec041c27cf73bf7163dce35eb2ad8aae276acf1ce73733c65d654d',
    'subject','Daily Repayment','attribute','Calculation Divisor','phase','Phase 1',
    'valuesRecorded','27 | 30',
    'members',jsonb_agg(jsonb_build_object('id',id,'expectedUpdatedAt',updated_at,
      'keep',value='27') order by id),
    'outcome','CHOSE_EXISTING',
    'chosenClaimId','cccc0001-0000-4000-8000-000000000003',
    'correctedValue',null,'decisionDomain',null,
    'rationale','Confirmed divisor from direct knowledge',
    'actor',jsonb_build_object('id',null,'label','Demo reviewer'))
    into v_plan from public.claims
    where id in ('cccc0001-0000-4000-8000-000000000003',
                 'cccc0001-0000-4000-8000-000000000004');
  v_result := public.resolve_conflict(v_plan);
  if v_result->>'outcome' <> 'CHOSE_EXISTING' then
    raise exception 'Unexpected resolution result: %',v_result;
  end if;
  if (select status from public.claims where id='cccc0001-0000-4000-8000-000000000003') <> 'ACTIVE'
    or (select to_jsonb(c) from public.claims c where id='cccc0001-0000-4000-8000-000000000003')
       is distinct from v_chosen_before
    or (select decided_value from public.finding_states where fingerprint=v_plan->>'fingerprint')
       is distinct from '27'
    or (select status from public.claims where id='cccc0001-0000-4000-8000-000000000004') <> 'SUPERSEDED'
    or (select superseded_by_claim_id from public.claims where id='cccc0001-0000-4000-8000-000000000004')
       is distinct from 'cccc0001-0000-4000-8000-000000000003'::uuid
    or (select count(*) from public.activity_log where event_type='FINDING_DECIDED') <> 1
    or exists (select 1 from public.activity_log where event_type='FINDING_DECIDED'
       and (payload ? 'occurredAt' or payload->>'confirmedWith' is not null
         or jsonb_array_length(payload->'members') <> 2)) then
    raise exception 'Choose 27 effects wrong';
  end if;
end $$;
rollback;
