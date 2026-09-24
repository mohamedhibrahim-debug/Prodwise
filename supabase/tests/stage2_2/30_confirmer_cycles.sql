begin;
do $$
declare
  v_fp text := 'f2f628a25ea8bcf38ef8db92896bbcc1f61b20e159c3d7635ed85c98dd84f5ca';
  v_assign jsonb;
  v_plan jsonb;
  v_state public.finding_states%rowtype;
  v_digest text;
  v_new uuid := 'dddd0001-0000-4000-8000-000000000022';
  v_first_audit jsonb;
begin
  v_assign := jsonb_build_object('initiativeId','11111111-1111-4111-8111-111111111111',
    'fingerprint',v_fp,'label','Finance owner','actor',jsonb_build_object('id',null,'label','Demo reviewer'),
    'cycle','FIRST','subject','Daily Repayment','attribute','Calculation Divisor','phase','Phase 1');
  perform public.assign_finding_confirmer(v_assign);
  select * into v_state from public.finding_states where fingerprint=v_fp;
  if v_state.status <> 'OPEN' or v_state.confirmer_label <> 'Finance owner'
     or (select payload->>'cycle' from public.activity_log
         where event_type='FINDING_CONFIRMER_ASSIGNED') <> 'FIRST' then
    raise exception 'First confirmer assignment failed';
  end if;

  v_plan := public.stage22_test_plan('CHOSE_EXISTING',
    'cccc0001-0000-4000-8000-000000000003',null);
  perform public.resolve_conflict(v_plan);
  select * into v_state from public.finding_states where fingerprint=v_fp;
  if v_state.confirmed_with <> 'Finance owner' or v_state.confirmer_label is not null
      or v_state.confirmer_set_at is not null or v_state.confirmer_set_by_label is not null then
    raise exception 'Decision did not snapshot and clear confirmer';
  end if;
  select payload into v_first_audit from public.activity_log
    where event_type='FINDING_DECIDED' order by occurred_at limit 1;

  begin
    perform public.assign_finding_confirmer(v_assign);
    raise exception 'Standing decision assignment unexpectedly succeeded';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'DECISION_STANDING' then raise; end if;
  end;

  -- A new claim reintroduces the original 27/30 mismatch and fingerprint.
  insert into public.claims(id,initiative_id,type,status,subject,attribute,value,domain,phase,
    origin,verified_at,verified_actor_label,verification_basis,verification_note)
  values(v_new,'11111111-1111-4111-8111-111111111111','REQUIREMENT','ACTIVE',
    'Daily Repayment','Calculation Divisor','30','FINANCE','Phase 1',
    'HUMAN_ENTRY',clock_timestamp(),'Demo reviewer','DIRECT_KNOWLEDGE','New direct observation');
  v_assign := jsonb_set(v_assign,'{cycle}','"REEMERGED"'::jsonb);
  v_assign := jsonb_set(v_assign,'{label}','"Second owner"'::jsonb);
  perform public.assign_finding_confirmer(v_assign);
  select * into v_state from public.finding_states where fingerprint=v_fp;
  if v_state.confirmed_with <> 'Finance owner' or v_state.confirmer_label <> 'Second owner'
     or v_state.decided_value <> '27' or v_state.outcome <> 'CHOSE_EXISTING'
     or not exists (select 1 from public.activity_log
         where event_type='FINDING_CONFIRMER_ASSIGNED'
           and payload->>'cycle'='REEMERGED') then
    raise exception 'Re-emerged confirmer altered decision history';
  end if;

  -- The prior audit remains a separate immutable event after a new decision.
  v_digest := public.decision_hash(array[v_fp,
    'cccc0001-0000-4000-8000-000000000003','27','ACTIVE','Phase 1',
    'bbbb0001-0000-4000-8000-000000000002','CURRENT_SCOPE','MFF-118',null,
    v_new::text,'30','ACTIVE','Phase 1',null]);
  v_plan := jsonb_set(v_plan,'{contentDigest}',to_jsonb(v_digest));
  v_plan := jsonb_set(v_plan,'{members}',(
    select jsonb_agg(jsonb_build_object('id',id,'expectedUpdatedAt',updated_at,
      'keep',value='27') order by id)
    from public.claims where id in ('cccc0001-0000-4000-8000-000000000003',v_new)));
  perform public.resolve_conflict(v_plan);
  select * into v_state from public.finding_states where fingerprint=v_fp;
  if v_state.confirmed_with <> 'Second owner' or v_state.confirmer_label is not null
    or (select count(*) from public.activity_log where event_type='FINDING_DECIDED') <> 2
    or not exists (select 1 from public.activity_log
      where event_type='FINDING_DECIDED' and payload=v_first_audit) then
    raise exception 'Second decision cycle lost its history';
  end if;
end $$;
rollback;
