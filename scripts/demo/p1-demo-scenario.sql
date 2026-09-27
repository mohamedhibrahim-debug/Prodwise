-- P1 Demo scenario (Prodwise Demo ONLY; fictional content). Operator step, idempotent.
-- Everything is created through the same product commands a person uses, as the
-- Demo reviewer, so provenance, revisions and history rules hold. The reading is
-- labelled model 'synthetic-demo-fixture' and the UI says it is not Claude.
-- Refuses to run unless the target is the single registered Demo workspace.
begin;
set local role service_role;
do $$declare w uuid;o uuid;m uuid;mff uuid;isp uuid;crr uuid;sid uuid;aid uuid;pid uuid;response jsonb;cid uuid;stamp timestamptz;rc uuid;
 notes text:=$n$Merchant Flex Finance — steering sync (synthetic demo notes)
Present: Demo Reviewer (PM), Finance lead, Lending operations lead, Engineering lead

1. Pilot scope
Agreed: the pilot is limited to 40 merchants in the first month.
Merchant eligibility change: minimum trading history lowered to 4 months of continuous settlement activity.

2. Delivery
Engineering needs Finance sign-off before release. Target Live moves to 2026-10-15 to allow Finance sign-off.
Lending operations will publish the merchant communication pack before pilot start.

3. Risks
Raised: acquirer settlement files can arrive after the 06:00 deduction run, which would delay same-day repayment.

4. Open
Who signs off the early-settlement fee table? Nobody present could confirm.
Settlement files come from Instant Settlement Payout, so the pilot depends on its release.$n$;
 function_quote text;
 procedure_candidates jsonb;
begin
 select d.workspace_id,d.organization_id into w,o from public.demo_scenarios d join public.organizations g on g.id=d.organization_id where g.name='Prodwise Demo' and g.status='ACTIVE' order by d.scenario_at desc limit 1;
 if w is null then raise exception 'NO_REGISTERED_DEMO';end if;
 if exists(select 1 from public.organizations where id=o and name<>'Prodwise Demo') then raise exception 'NOT_DEMO';end if;
 select mm.id into m from public.organization_memberships mm join public.users u on u.id=mm.user_id where mm.organization_id=o and mm.active and mm.role='ORG_OWNER' and u.platform_role is null order by mm.id limit 1;
 if m is null then raise exception 'NO_DEMO_REVIEWER';end if;
 select id into mff from public.initiatives where workspace_id=w and slug='merchant-flex-finance';select id into isp from public.initiatives where workspace_id=w and slug='instant-settlement-payout';select id into crr from public.initiatives where workspace_id=w and slug='collections-reporting-rebuild';
 if mff is null or isp is null or crr is null then raise exception 'DEMO_INITIATIVES_MISSING';end if;
 if exists(select 1 from public.meeting_notes where workspace_id=w and data->>'title'='Steering sync (synthetic)') then raise notice 'P1 Demo scenario already present; nothing changed.';return;end if;

 -- Meeting notes → reading (synthetic fixture) → human decisions.
 sid:=public.submit_meeting_notes(w,m,jsonb_build_object('initiativeId',mff,'requestId',gen_random_uuid(),'title','Steering sync (synthetic)','text',notes,'textSha256',encode(sha256(convert_to(notes,'UTF8')),'hex'),'charLength',length(notes),'meeting',jsonb_build_object('date','2026-09-25','attendees','Demo Reviewer, Finance lead, Lending operations lead, Engineering lead')));
 response:=public.start_evidence_attempt(w,m,sid,gen_random_uuid());aid:=(response->>'attemptId')::uuid;
 select id,updated_at into cid,stamp from public.claims where workspace_id=w and initiative_id=mff and subject='Merchant Eligibility' and attribute='Minimum Trading History' and status='ACTIVE' limit 1;
 procedure_candidates:=jsonb_build_array(
  jsonb_build_object('type','DECISION','q','the pilot is limited to 40 merchants in the first month','payload',jsonb_build_object('subject','Pilot scope','attribute','Merchant cap','value','limited to 40 merchants in the first month','domain','PRODUCT','phase','Phase 1')),
  jsonb_build_object('type','ACTION','q','Lending operations will publish the merchant communication pack before pilot start','payload',jsonb_build_object('subject','Merchant communication','attribute','pack','value','publish the merchant communication pack before pilot start','domain','OPERATIONS','phase',null)),
  jsonb_build_object('type','RISK','q','acquirer settlement files can arrive after the 06:00 deduction run, which would delay same-day repayment','payload',jsonb_build_object('subject','Settlement file timing','attribute','Late arrival','value','acquirer settlement files can arrive after the 06:00 deduction run','domain','OPERATIONS','phase','Phase 1')),
  jsonb_build_object('type','OPEN_QUESTION','q','Who signs off the early-settlement fee table?','payload',jsonb_build_object('subject','Early-settlement fee table','attribute','question','value','Who signs off the early-settlement fee table?','domain','FINANCE','phase',null)),
  jsonb_build_object('type','DELIVERY','q','Target Live moves to 2026-10-15 to allow Finance sign-off','payload',jsonb_build_object('subject','Target Live','attribute','date','value','2026-10-15','domain','DELIVERY','phase',null,'factKind','TARGET_LIVE','date','2026-10-15')),
  jsonb_build_object('type','RELATIONSHIP','q','Instant Settlement Payout','payload',jsonb_build_object('subject','Instant Settlement Payout','attribute','relationship','value','Instant Settlement Payout','domain','PRODUCT','phase',null,'targetInitiativeId',isp)))
  ||case when cid is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('type','CHANGED_REQUIREMENT','q','minimum trading history lowered to 4 months of continuous settlement activity','payload',jsonb_build_object('subject','Merchant Eligibility','attribute','Minimum Trading History','value','4 months of continuous settlement activity','domain','PRODUCT','phase','Phase 1','targetClaimId',cid,'targetClaimUpdatedAt',stamp))) end;
 perform public.finish_evidence_attempt(w,m,aid,jsonb_build_object('model','synthetic-demo-fixture','discardedCount',0,'errorCode',null,'candidates',(select jsonb_agg(c-'q'||jsonb_build_object('anchor',jsonb_build_object('start',position(c->>'q' in notes)-1,'end',position(c->>'q' in notes)-1+length(c->>'q'),'quote',c->>'q'),'baseRevision',case when c->>'type'='DELIVERY' then coalesce((select revision from public.delivery_facts where workspace_id=w and initiative_id=mff and kind='TARGET_LIVE'),0) else 0 end)) from jsonb_array_elements(procedure_candidates) c)));
 -- Confirmed: decision, commitment (owner + due), risk, open question. Left pending on purpose: date change, changed requirement, relationship proposal.
 select id into pid from public.evidence_proposals where attempt_id=aid and data->>'type'='DECISION';perform public.decide_evidence_proposal(w,m,jsonb_build_object('id',pid,'version',1,'operation','CONFIRM','requestId',gen_random_uuid(),'reason','Agreed in the steering sync'));
 select id into pid from public.evidence_proposals where attempt_id=aid and data->>'type'='ACTION';perform public.decide_evidence_proposal(w,m,jsonb_build_object('id',pid,'version',1,'operation','CONFIRM','requestId',gen_random_uuid(),'reason','','assigneeMemberId',m,'dueDate','2026-10-02'));
 select id into pid from public.evidence_proposals where attempt_id=aid and data->>'type'='RISK';rc:=(public.decide_evidence_proposal(w,m,jsonb_build_object('id',pid,'version',1,'operation','CONFIRM','requestId',gen_random_uuid(),'reason',''))->>'id')::uuid;
 select id into pid from public.evidence_proposals where attempt_id=aid and data->>'type'='OPEN_QUESTION';perform public.decide_evidence_proposal(w,m,jsonb_build_object('id',pid,'version',1,'operation','CONFIRM','requestId',gen_random_uuid(),'reason','','assigneeMemberId',m,'dueDate','2026-09-30'));
 -- Relationships: CRR needs MFF live before its 2 Oct milestone; MFF's recorded Target Live (8 Oct) is later → a supported impact.
 perform public.save_relationship(w,m,jsonb_build_object('operation','CREATE','requestId',gen_random_uuid(),'expectedRevision',0,'fromInitiativeId',crr,'toInitiativeId',mff,'type','DEPENDS_ON','rationale','The daily collections pack must include financing repayments, which start only when Merchant Flex Finance is live.','providerFactKind','TARGET_LIVE','neededByFactKind','NEXT_MILESTONE'));
 -- Existing ACTIVE risk tracked with a mitigation; a second, human-asked question.
 select id into cid from public.claims where workspace_id=w and initiative_id=mff and type='RISK' and status='ACTIVE' and subject='Repayment Reconciliation' limit 1;
 if cid is not null then perform public.save_risk_tracking(w,m,mff,jsonb_build_object('operation','START','claimId',cid,'requestId',gen_random_uuid(),'expectedRevision',0,'ownerMemberId',m,'mitigationText','Hold divisor-dependent build until Finance confirms 27 vs 30.'));end if;
 perform public.save_open_question(w,m,mff,jsonb_build_object('operation','CREATE','requestId',gen_random_uuid(),'expectedRevision',0,'question','Does Compliance need to approve the early-settlement fee?','expectedConfirmerText','Compliance lead','dueDate','2026-10-06'));
 raise notice 'PASS: P1 Demo scenario applied to the registered Demo workspace %',w;
end$$;
commit;
