-- Test-only plan builder against the known MFF seed. The expected digest was
-- calculated independently with the TypeScript Review fingerprint function.
create function public.stage22_test_plan(p_outcome text,p_chosen uuid,p_corrected text,
  p_domain text default null) returns jsonb language sql as $$
  select jsonb_build_object(
    'initiativeId','11111111-1111-4111-8111-111111111111',
    'fingerprint','f2f628a25ea8bcf38ef8db92896bbcc1f61b20e159c3d7635ed85c98dd84f5ca',
    'ruleId','CONFLICT_SAME_ATTRIBUTE_V1',
    'contentDigest','ac062aa621ec041c27cf73bf7163dce35eb2ad8aae276acf1ce73733c65d654d',
    'subject','Daily Repayment','attribute','Calculation Divisor','phase','Phase 1',
    'valuesRecorded','27 | 30',
    'members',jsonb_agg(jsonb_build_object('id',id,'expectedUpdatedAt',updated_at,
      'keep',p_outcome='CHOSE_EXISTING' and
        public.decision_normalise(value)=(select public.decision_normalise(value)
          from public.claims where id=p_chosen)) order by id),
    'outcome',p_outcome,'chosenClaimId',p_chosen,'correctedValue',p_corrected,
    'decisionDomain',p_domain,
    'rationale','Confirmed divisor from direct knowledge',
    'actor',jsonb_build_object('id',null,'label','Demo reviewer'))
  from public.claims where id in
    ('cccc0001-0000-4000-8000-000000000003',
     'cccc0001-0000-4000-8000-000000000004');
$$;
