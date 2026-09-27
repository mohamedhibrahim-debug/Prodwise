\set ON_ERROR_STOP on
do $$begin if current_database() !~ '^prodwise_second_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_LOCAL_DATABASE_REQUIRED';end if;end$$;
begin;
-- Synthetic Viewer and non-owner Member in the fictional Demo organization.
insert into auth.users(id,email,email_confirmed_at) values('e7100000-0000-4000-8000-000000000001','meeting-viewer@synthetic.test',now()),('e7100000-0000-4000-8000-000000000011','meeting-member@synthetic.test',now());
insert into public.users(id,email,display_name,auth_user_id,active,is_system) values('e7100000-0000-4000-8000-000000000002','meeting-viewer@synthetic.test','Synthetic meeting Viewer','e7100000-0000-4000-8000-000000000001',true,false),('e7100000-0000-4000-8000-000000000012','meeting-member@synthetic.test','Synthetic meeting Member','e7100000-0000-4000-8000-000000000011',true,false);
insert into public.organization_memberships(id,organization_id,user_id,role,active,is_product_lead,policy_override,policy_override_reason) values
 ('e7100000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001','e7100000-0000-4000-8000-000000000002','VIEWER',true,false,true,'Disposable synthetic negative-test fixture'),
 ('e7100000-0000-4000-8000-000000000013','d2000000-0000-4000-8000-000000000001','e7100000-0000-4000-8000-000000000012','MEMBER',true,false,true,'Disposable synthetic negative-test fixture');
set local role service_role;
do $$declare w uuid:='d2000000-0000-4000-8000-000000000002';m uuid:='d2000000-0000-4000-8000-000000000003';viewer uuid:='e7100000-0000-4000-8000-000000000003';member uuid:='e7100000-0000-4000-8000-000000000013';
 new_slug text;iid uuid;sid uuid;aid uuid;pid uuid;qid uuid;cid uuid;cid2 uuid;payload jsonb;response jsonb;
 notes text:='Steering sync. Decided: pilot limited to 50 merchants. Owner to publish the rollout checklist. Risk: settlement file may arrive late. Open: who signs off the fee table? Requirement change: settlement cutoff 18:00.';
 decision_q text:='pilot limited to 50 merchants';action_q text:='publish the rollout checklist';risk_q text:='settlement file may arrive late';question_q text:='who signs off the fee table?';change_q text:='settlement cutoff 18:00';
 function_start integer;
 procedure_candidate jsonb;
begin
 new_slug:=public.create_managed_initiative(w,m,jsonb_build_object('requestId',gen_random_uuid(),'name','Synthetic meeting intelligence SQL','businessLine','FS','stage','DELIVERY','ownerMemberId',m));
 select id into iid from public.initiatives where workspace_id=w and initiatives.slug=new_slug;
 payload:=jsonb_build_object('initiativeId',iid,'requestId',gen_random_uuid(),'title','Steering sync','text',notes,'textSha256',encode(sha256(convert_to(notes,'UTF8')),'hex'),'charLength',length(notes),'meeting',jsonb_build_object('date','2026-10-06','attendees','Synthetic PM, Synthetic Finance'));
 begin perform public.submit_meeting_notes(w,viewer,payload);raise exception 'VIEWER_WRITE_ACCEPTED';exception when others then if sqlerrm='VIEWER_WRITE_ACCEPTED' then raise;end if;end;
 begin perform public.submit_meeting_notes(w,m,payload||jsonb_build_object('requestId',gen_random_uuid(),'meeting',jsonb_build_object('date','2026-13-40')));raise exception 'BAD_DATE_ACCEPTED';exception when others then if sqlerrm='BAD_DATE_ACCEPTED' then raise;end if;end;
 sid:=public.submit_meeting_notes(w,m,payload);if public.submit_meeting_notes(w,m,payload)<>sid then raise exception 'MEETING_RETRY_DUPLICATED';end if;
 if (select data->>'kind' from public.evidence_submissions where id=sid)<>'MEETING_NOTES' or (select data->>'meetingDate' from public.meeting_notes where submission_id=sid)<>'2026-10-06' then raise exception 'MEETING_METADATA_MISSING';end if;
 if not exists(select 1 from public.source_items si join public.source_mappings sm on sm.item_id=si.id where sm.initiative_id=iid and si.kind='MEETING_NOTES' and si.reference like 'meeting:2026-10-06:steering-sync:%' and sm.unlinked_at is null) then raise exception 'MEETING_SOURCE_NOT_LINKED';end if;
 if exists(select 1 from public.claims where initiative_id=iid) or exists(select 1 from public.actions where initiative_id=iid) or exists(select 1 from public.open_questions where initiative_id=iid) then raise exception 'AUTONOMOUS_WRITE_ON_SAVE';end if;

 -- Reading: one candidate per type, each anchored to an exact quote.
 response:=public.start_evidence_attempt(w,m,sid,gen_random_uuid());aid:=(response->>'attemptId')::uuid;
 perform public.finish_evidence_attempt(w,m,aid,jsonb_build_object('model','synthetic-provider-fixture','discardedCount',0,'errorCode',null,'candidates',jsonb_build_array(
  jsonb_build_object('type','DECISION','payload',jsonb_build_object('subject','Pilot','attribute','merchant limit','value','50 merchants','domain','PRODUCT','phase',null),'anchor',jsonb_build_object('start',position(decision_q in notes)-1,'end',position(decision_q in notes)-1+length(decision_q),'quote',decision_q),'baseRevision',0),
  jsonb_build_object('type','ACTION','payload',jsonb_build_object('subject','Rollout','attribute','checklist','value','publish the rollout checklist','domain','OPERATIONS','phase',null),'anchor',jsonb_build_object('start',position(action_q in notes)-1,'end',position(action_q in notes)-1+length(action_q),'quote',action_q),'baseRevision',0),
  jsonb_build_object('type','RISK','payload',jsonb_build_object('subject','Settlement file','attribute','timeliness','value','settlement file may arrive late','domain','OPERATIONS','phase',null),'anchor',jsonb_build_object('start',position(risk_q in notes)-1,'end',position(risk_q in notes)-1+length(risk_q),'quote',risk_q),'baseRevision',0),
  jsonb_build_object('type','OPEN_QUESTION','payload',jsonb_build_object('subject','Fee table','attribute','question','value','who signs off the fee table?','domain','FINANCE','phase',null),'anchor',jsonb_build_object('start',position(question_q in notes)-1,'end',position(question_q in notes)-1+length(question_q),'quote',question_q),'baseRevision',0),
  jsonb_build_object('type','REQUIREMENT','payload',jsonb_build_object('subject','Settlement','attribute','cutoff','value','settlement cutoff 18:00','domain','OPERATIONS','phase',null),'anchor',jsonb_build_object('start',position(change_q in notes)-1,'end',position(change_q in notes)-1+length(change_q),'quote',change_q),'baseRevision',0))));
 if (select count(*) from public.evidence_proposals where attempt_id=aid)<>5 then raise exception 'PROPOSALS_NOT_SAVED';end if;
 if exists(select 1 from public.claims where initiative_id=iid) or exists(select 1 from public.open_questions where initiative_id=iid) then raise exception 'AUTONOMOUS_WRITE_ON_READ';end if;

 -- M-1 Action from a meeting keeps MEETING origin and links back to the proposal span.
 select id into pid from public.evidence_proposals where attempt_id=aid and data->>'type'='ACTION';
 response:=public.decide_evidence_proposal(w,m,jsonb_build_object('id',pid,'version',1,'operation','CONFIRM','requestId',gen_random_uuid(),'reason','Agreed in steering'));
 if (select data->>'origin' from public.actions where id=(response->>'id')::uuid)<>'MEETING' or (select data->>'originHref' from public.actions where id=(response->>'id')::uuid) not like '%#proposal-'||pid::text or (select data->>'assigneeMemberId' from public.actions where id=(response->>'id')::uuid) is not null then raise exception 'MEETING_ACTION_PROVENANCE';end if;

 -- Q-1 Open question: canonical question with MEETING origin, never a claim.
 select id into pid from public.evidence_proposals where attempt_id=aid and data->>'type'='OPEN_QUESTION';
 response:=public.decide_evidence_proposal(w,m,jsonb_build_object('id',pid,'version',1,'operation','CONFIRM','requestId',gen_random_uuid(),'reason','','assigneeMemberId',member,'dueDate','2026-10-09'));
 qid:=(response->>'id')::uuid;
 if response->>'type'<>'QUESTION' or (select data->>'origin' from public.open_questions where id=qid)<>'MEETING' or (select data->>'status' from public.open_questions where id=qid)<>'OPEN' or (select data->>'ownerMemberId' from public.open_questions where id=qid)<>member::text or exists(select 1 from public.claims where initiative_id=iid) then raise exception 'QUESTION_CONFIRMATION';end if;
 if (select count(*) from public.question_events where question_id=qid)<>1 then raise exception 'QUESTION_EVENT_MISSING';end if;
 begin perform public.save_open_question(w,m,iid,jsonb_build_object('operation','CREATE','requestId',gen_random_uuid(),'expectedRevision',0,'question','Forged meeting origin?','origin','MEETING','originRefId',gen_random_uuid()));raise exception 'FORGED_ORIGIN_ACCEPTED';exception when others then if sqlerrm<>'ORIGIN_CONFIRMATION_REQUIRED' then raise;end if;end;

 -- Risk becomes unverified Knowledge; decision likewise; rejection writes nothing canonical.
 select id into pid from public.evidence_proposals where attempt_id=aid and data->>'type'='RISK';
 response:=public.decide_evidence_proposal(w,m,jsonb_build_object('id',pid,'version',1,'operation','CONFIRM','requestId',gen_random_uuid(),'reason',''));
 if (select type::text||':'||status::text from public.claims where id=(response->>'id')::uuid)<>'RISK:UNVERIFIED' then raise exception 'RISK_CLAIM';end if;
 select id into pid from public.evidence_proposals where attempt_id=aid and data->>'type'='DECISION';
 perform public.decide_evidence_proposal(w,m,jsonb_build_object('id',pid,'version',1,'operation','REJECT','requestId',gen_random_uuid(),'reason','Only discussed'));
 if exists(select 1 from public.claims where initiative_id=iid and type='DECISION') then raise exception 'REJECTED_DECISION_WRITTEN';end if;
 select id into pid from public.evidence_proposals where attempt_id=aid and data->>'type'='REQUIREMENT';
 response:=public.decide_evidence_proposal(w,m,jsonb_build_object('id',pid,'version',1,'operation','CONFIRM','requestId',gen_random_uuid(),'reason',''));cid:=(response->>'id')::uuid;

 -- M-3 A changed requirement against an edited target becomes Outdated and writes nothing.
 response:=public.start_evidence_attempt(w,m,sid,gen_random_uuid());aid:=(response->>'attemptId')::uuid;
 perform public.finish_evidence_attempt(w,m,aid,jsonb_build_object('model','synthetic-provider-fixture','discardedCount',0,'errorCode',null,'candidates',jsonb_build_array(
  jsonb_build_object('type','CHANGED_REQUIREMENT','payload',jsonb_build_object('subject','Settlement','attribute','cutoff','value','18:00','domain','OPERATIONS','phase',null,'targetClaimId',cid,'targetClaimUpdatedAt',(select updated_at-interval '1 minute' from public.claims where id=cid)),'anchor',jsonb_build_object('start',position(change_q in notes)-1,'end',position(change_q in notes)-1+length(change_q),'quote',change_q),'baseRevision',0))));
 select id into pid from public.evidence_proposals where attempt_id=aid;
 -- (updated_at is transaction-pinned here, so the proposal carries the earlier revision a separate edit would have left behind.)
 response:=public.decide_evidence_proposal(w,m,jsonb_build_object('id',pid,'version',1,'operation','CONFIRM','requestId',gen_random_uuid(),'reason',''));
 if (response->>'outdated')::boolean is distinct from true or (select data->>'status' from public.evidence_proposals where id=pid)<>'OUTDATED' or (select status::text from public.claims where id=cid)<>'UNVERIFIED' or (select count(*) from public.claims where initiative_id=iid)<>2 then raise exception 'STALE_SUPERSEDE_WROTE';end if;

 -- A current changed requirement supersedes atomically and preserves the old entry.
 response:=public.start_evidence_attempt(w,m,sid,gen_random_uuid());aid:=(response->>'attemptId')::uuid;
 perform public.finish_evidence_attempt(w,m,aid,jsonb_build_object('model','synthetic-provider-fixture','discardedCount',0,'errorCode',null,'candidates',jsonb_build_array(
  jsonb_build_object('type','CHANGED_REQUIREMENT','payload',jsonb_build_object('subject','Settlement','attribute','cutoff','value','18:00','domain','OPERATIONS','phase',null,'targetClaimId',cid,'targetClaimUpdatedAt',(select updated_at from public.claims where id=cid)),'anchor',jsonb_build_object('start',position(change_q in notes)-1,'end',position(change_q in notes)-1+length(change_q),'quote',change_q),'baseRevision',0))));
 select id into pid from public.evidence_proposals where attempt_id=aid;
 response:=public.decide_evidence_proposal(w,m,jsonb_build_object('id',pid,'version',1,'operation','CONFIRM','requestId',gen_random_uuid(),'reason',''));cid2:=(response->>'id')::uuid;
 if (select status::text||':'||superseded_by_claim_id::text from public.claims where id=cid)<>'SUPERSEDED:'||cid2::text or (select status::text||':'||type::text||':'||value from public.claims where id=cid2)<>'UNVERIFIED:REQUIREMENT:18:00' or not exists(select 1 from public.claim_evidence where claim_id=cid2) then raise exception 'SUPERSEDE_INCORRECT';end if;

 -- Question lifecycle: authority, unverified-answer denial, stale revision, append-only events.
 begin perform public.save_open_question(w,viewer,iid,jsonb_build_object('operation','CREATE','requestId',gen_random_uuid(),'expectedRevision',0,'question','Viewer question?'));raise exception 'VIEWER_QUESTION_ACCEPTED';exception when others then if sqlerrm='VIEWER_QUESTION_ACCEPTED' then raise;end if;end;
 begin perform public.save_open_question(w,m,iid,jsonb_build_object('operation','ANSWER','id',qid,'requestId',gen_random_uuid(),'expectedRevision',1,'answerClaimId',cid2));raise exception 'UNVERIFIED_ANSWER_ACCEPTED';exception when others then if sqlerrm<>'ANSWER_CLAIM_NOT_CONFIRMED' then raise;end if;end;
 begin perform public.save_open_question(w,m,iid,jsonb_build_object('operation','ANSWER','id',qid,'requestId',gen_random_uuid(),'expectedRevision',0,'answerNote','x'));raise exception 'STALE_ANSWER_ACCEPTED';exception when others then if sqlerrm<>'STALE_QUESTION' then raise;end if;end;
 begin perform public.save_open_question(w,m,iid,jsonb_build_object('operation','WITHDRAW','id',qid,'requestId',gen_random_uuid(),'expectedRevision',1,'reason',''));raise exception 'REASONLESS_WITHDRAW';exception when others then if sqlerrm<>'REASON_REQUIRED' then raise;end if;end;
 -- The question owner (a Member) may answer it.
 perform public.save_open_question(w,member,iid,jsonb_build_object('operation','ANSWER','id',qid,'requestId',gen_random_uuid(),'expectedRevision',1,'answerNote','Finance lead signs off the fee table.'));
 if (select data->>'status'||':'||(data->>'answerNote') from public.open_questions where id=qid)<>'ANSWERED:Finance lead signs off the fee table.' or (select count(*) from public.question_events where question_id=qid)<>2 then raise exception 'ANSWER_NOT_RECORDED';end if;
 begin update public.question_events set data='{}' where question_id=qid;raise exception 'EVENT_MUTABLE';exception when insufficient_privilege then null;end;
 begin delete from public.question_events where question_id=qid;raise exception 'EVENT_DELETABLE';exception when insufficient_privilege then null;end;

 -- Metadata correction is revision-checked; relationship proposals cannot confirm through the generic path.
 perform public.correct_meeting_notes(w,m,jsonb_build_object('submissionId',sid,'expectedRevision',1,'title','Steering sync','meetingDate','2026-10-07','attendeesText',null));
 begin perform public.correct_meeting_notes(w,m,jsonb_build_object('submissionId',sid,'expectedRevision',1,'title','Steering sync (stale)','meetingDate','2026-10-06','attendeesText',null));raise exception 'STALE_MEETING_ACCEPTED';exception when others then if sqlerrm<>'STALE_MEETING' then raise;end if;end;
 begin perform public.correct_meeting_notes(w,member,jsonb_build_object('submissionId',sid,'expectedRevision',2,'title','Hijack','meetingDate','2026-10-06','attendeesText',null));raise exception 'MEMBER_CORRECTION_ACCEPTED';exception when others then if sqlerrm<>'MEETING_PERMISSION' then raise;end if;end;
 if (select data->>'text' from public.evidence_submissions where id=sid)<>notes then raise exception 'MEETING_TEXT_CHANGED';end if;
 if jsonb_array_length(public.read_anchored_evidence(w,m,iid)->'meetings')<>1 then raise exception 'READ_MEETINGS';end if;
 raise notice 'PASS: meeting notes saved as evidence and a MEETING_NOTES source; no autonomous writes; MEETING-origin action; canonical open question (no claim); unverified risk; rejection writes nothing; stale supersede Outdated; atomic supersede keeps history; question authority, unverified-answer denial, stale revision, append-only events; revision-checked meeting correction with immutable text';
end$$;set constraints all immediate;reset role;rollback;
