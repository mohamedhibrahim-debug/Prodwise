begin;
do $$
declare v_plan jsonb; v_fp text; v_note jsonb;
begin
  v_plan := public.stage22_test_plan('CHOSE_EXISTING',
    'cccc0001-0000-4000-8000-000000000003',null);
  v_fp := v_plan->>'fingerprint';
  perform public.resolve_conflict(v_plan);
  v_note := jsonb_build_object('ruleId','CONFLICT_SAME_ATTRIBUTE_V1',
    'contentDigest',v_plan->>'contentDigest','subject','Daily Repayment',
    'attribute','Calculation Divisor','phase','Phase 1',
    'valuesRecorded','27 | 30','resolution','This is only a note');

  begin
    perform public.set_finding_note('11111111-1111-4111-8111-111111111111',v_fp,v_note);
    raise exception 'Note path cleared decision';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'DECISION_IMMUTABLE' then raise; end if;
  end;
  begin
    perform public.reopen_finding_state('11111111-1111-4111-8111-111111111111',
      v_fp,null,'Demo reviewer');
    raise exception 'Reopen accepted decision';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'DECISION_NOT_REOPENABLE' then raise; end if;
  end;
  begin
    update public.finding_states set outcome=null where fingerprint=v_fp;
    raise exception 'Direct update cleared decision';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'DECISION_IMMUTABLE' then raise; end if;
  end;
  begin
    update public.finding_states set decided_value='31' where fingerprint=v_fp;
    raise exception 'Decision changed without fresh timestamp';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'DECISION_IMMUTABLE' then raise; end if;
  end;
end $$;
rollback;

begin;
do $$
declare v_note jsonb; v_fp text := 'f2f628a25ea8bcf38ef8db92896bbcc1f61b20e159c3d7635ed85c98dd84f5ca';
begin
  v_note := jsonb_build_object('ruleId','CONFLICT_SAME_ATTRIBUTE_V1',
    'contentDigest','ac062aa621ec041c27cf73bf7163dce35eb2ad8aae276acf1ce73733c65d654d',
    'subject','Daily Repayment','attribute','Calculation Divisor','phase','Phase 1',
    'valuesRecorded','27 | 30','resolution','Legacy review note');
  perform public.set_finding_note('11111111-1111-4111-8111-111111111111',v_fp,v_note);
  if (select outcome from public.finding_states where fingerprint=v_fp) is not null
     or (select count(*) from public.claims where status='SUPERSEDED'
         and id in ('cccc0001-0000-4000-8000-000000000003',
                    'cccc0001-0000-4000-8000-000000000004')) <> 0 then
    raise exception 'Legacy note changed Knowledge';
  end if;
  if not public.reopen_finding_state('11111111-1111-4111-8111-111111111111',
      v_fp,null,'Demo reviewer') then
    raise exception 'Legacy note could not reopen';
  end if;
end $$;
rollback;

-- Invalid HUMAN_DECISION inserts must fail without weakening Stage 2.1.
do $$
declare v_base jsonb; v_case jsonb; v_inserted boolean;
begin
  for v_case in select value from jsonb_array_elements(jsonb_build_array(
    jsonb_build_object('type','DECISION','status','ACTIVE','basis','DIRECT_KNOWLEDGE',
      'verified',false,'note','Reason','actor','Reviewer'),
    jsonb_build_object('type','DECISION','status','ACTIVE','basis','EVIDENCE',
      'verified',true,'note','Reason','actor','Reviewer'),
    jsonb_build_object('type','REQUIREMENT','status','ACTIVE','basis','DIRECT_KNOWLEDGE',
      'verified',true,'note','Reason','actor','Reviewer'),
    jsonb_build_object('type','DECISION','status','ACTIVE','basis','DIRECT_KNOWLEDGE',
      'verified',true,'note',' ','actor','Reviewer'),
    jsonb_build_object('type','DECISION','status','ACTIVE','basis','DIRECT_KNOWLEDGE',
      'verified',true,'note','Reason','actor',' ')
  )) loop
    v_inserted := false;
    begin
      insert into public.claims(initiative_id,type,status,subject,attribute,value,domain,
        origin,verified_at,verified_actor_label,verification_basis,verification_note)
      values('11111111-1111-4111-8111-111111111111',
        (v_case->>'type')::public.claim_type,(v_case->>'status')::public.claim_status,
        'Test decision','Test attribute','28','FINANCE','HUMAN_DECISION',
        case when (v_case->>'verified')::boolean then clock_timestamp() else null end,
        v_case->>'actor',(v_case->>'basis')::public.verification_basis,v_case->>'note');
      v_inserted := true;
    exception when check_violation then null;
    end;
    if v_inserted then raise exception 'Invalid HUMAN_DECISION insert succeeded: %',v_case; end if;
  end loop;
end $$;

begin;
do $$
declare v_plan jsonb; v_id uuid;
begin
  v_plan := public.stage22_test_plan('CORRECTED_VALUE',null,'28','FINANCE');
  v_id := (public.resolve_conflict(v_plan)->>'decisionClaimId')::uuid;
  begin
    update public.claims set origin='HUMAN_ENTRY' where id=v_id;
    raise exception 'Origin changed';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'CLAIM_ORIGIN_IMMUTABLE' then raise; end if;
  end;
  begin
    update public.claims set verification_note='New note' where id=v_id;
    raise exception 'Verification changed';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'CLAIM_VERIFICATION_IMMUTABLE' then raise; end if;
  end;
  update public.claims set status='UNVERIFIED' where id=v_id;
  begin
    update public.claims set status='ACTIVE' where id=v_id;
    raise exception 'Plain reactivation succeeded';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'CLAIM_ACTIVATION_REQUIRES_VERIFICATION' then raise; end if;
  end;
end $$;
rollback;
