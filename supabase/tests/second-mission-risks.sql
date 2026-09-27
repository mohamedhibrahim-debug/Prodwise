\set ON_ERROR_STOP on
do $$begin if current_database() !~ '^prodwise_second_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_LOCAL_DATABASE_REQUIRED';end if;end$$;
begin;
insert into auth.users(id,email,email_confirmed_at) values('e9100000-0000-4000-8000-000000000001','risk-viewer@synthetic.test',now()),('e9100000-0000-4000-8000-000000000011','risk-member@synthetic.test',now());
insert into public.users(id,email,display_name,auth_user_id,active,is_system) values('e9100000-0000-4000-8000-000000000002','risk-viewer@synthetic.test','Synthetic risk Viewer','e9100000-0000-4000-8000-000000000001',true,false),('e9100000-0000-4000-8000-000000000012','risk-member@synthetic.test','Synthetic risk Member','e9100000-0000-4000-8000-000000000011',true,false);
insert into public.organization_memberships(id,organization_id,user_id,role,active,is_product_lead,policy_override,policy_override_reason) values
 ('e9100000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001','e9100000-0000-4000-8000-000000000002','VIEWER',true,false,true,'Disposable synthetic negative-test fixture'),
 ('e9100000-0000-4000-8000-000000000013','d2000000-0000-4000-8000-000000000001','e9100000-0000-4000-8000-000000000012','MEMBER',true,false,true,'Disposable synthetic negative-test fixture');
set local role service_role;
do $$declare w uuid:='d2000000-0000-4000-8000-000000000002';m uuid:='d2000000-0000-4000-8000-000000000003';viewer uuid:='e9100000-0000-4000-8000-000000000003';member uuid:='e9100000-0000-4000-8000-000000000013';
 new_slug text;iid uuid;sid uuid;aid uuid;pid uuid;rc uuid;rc2 uuid;tid uuid;tid2 uuid;stamp timestamptz;response jsonb;notes text:='Raised: settlement files may arrive late.';q text:='settlement files may arrive late';actor uuid;
begin
 select user_id into actor from public.organization_memberships where id=m;
 new_slug:=public.create_managed_initiative(w,m,jsonb_build_object('requestId',gen_random_uuid(),'name','Synthetic risk SQL','businessLine','FS','stage','DELIVERY','ownerMemberId',m));select id into iid from public.initiatives where workspace_id=w and initiatives.slug=new_slug;
 sid:=public.submit_anchored_evidence(w,m,jsonb_build_object('initiativeId',iid,'requestId',gen_random_uuid(),'title','Synthetic risk note','text',notes,'textSha256',encode(sha256(convert_to(notes,'UTF8')),'hex'),'charLength',length(notes)));
 response:=public.start_evidence_attempt(w,m,sid,gen_random_uuid());aid:=(response->>'attemptId')::uuid;
 perform public.finish_evidence_attempt(w,m,aid,jsonb_build_object('model','synthetic-provider-fixture','discardedCount',0,'errorCode',null,'candidates',jsonb_build_array(jsonb_build_object('type','RISK','payload',jsonb_build_object('subject','Settlement files','attribute','timeliness','value',q,'domain','OPERATIONS','phase',null),'anchor',jsonb_build_object('start',position(q in notes)-1,'end',position(q in notes)-1+length(q),'quote',q),'baseRevision',0))));
 select id into pid from public.evidence_proposals where attempt_id=aid;rc:=(public.decide_evidence_proposal(w,m,jsonb_build_object('id',pid,'version',1,'operation','CONFIRM','requestId',gen_random_uuid(),'reason',''))->>'id')::uuid;
 -- Unverified risks cannot be tracked.
 begin perform public.save_risk_tracking(w,m,iid,jsonb_build_object('operation','START','claimId',rc,'requestId',gen_random_uuid(),'expectedRevision',0));raise exception 'UNVERIFIED_TRACKED';exception when others then if sqlerrm<>'RISK_CLAIM_INVALID' then raise;end if;end;
 select updated_at into stamp from public.claims where id=rc;perform public.verify_claim(rc,stamp,'DIRECT_KNOWLEDGE','Synthetic verification',actor::text,'Synthetic Reviewer');
 -- Q-3 Viewer and non-owner Member are denied; nothing is written.
 begin perform public.save_risk_tracking(w,viewer,iid,jsonb_build_object('operation','START','claimId',rc,'requestId',gen_random_uuid(),'expectedRevision',0));raise exception 'VIEWER_TRACKED';exception when others then if sqlerrm='VIEWER_TRACKED' then raise;end if;end;
 begin perform public.save_risk_tracking(w,member,iid,jsonb_build_object('operation','START','claimId',rc,'requestId',gen_random_uuid(),'expectedRevision',0));raise exception 'MEMBER_TRACKED';exception when others then if sqlerrm<>'RISK_PERMISSION' then raise;end if;end;
 if exists(select 1 from public.risk_tracking where claim_id=rc) then raise exception 'DENIED_WRITE_PERSISTED';end if;
 -- Q-1 Owner starts tracking; a concurrent second start returns the same row.
 tid:=public.save_risk_tracking(w,m,iid,jsonb_build_object('operation','START','claimId',rc,'requestId',gen_random_uuid(),'expectedRevision',0,'ownerMemberId',member,'mitigationText','Ask acquirer for an earlier file'));
 if public.save_risk_tracking(w,m,iid,jsonb_build_object('operation','START','claimId',rc,'requestId',gen_random_uuid(),'expectedRevision',0))<>tid then raise exception 'SECOND_TRACKING_ROW';end if;
 if (select status from public.risk_tracking where id=tid)<>'OPEN' or not exists(select 1 from public.activity_log where entity_id=tid::text and event_type='RISK_STARTED') then raise exception 'START_NOT_RECORDED';end if;
 -- The risk owner (a Member) may change status; stale revision refused; closing needs a reason.
 perform public.save_risk_tracking(w,member,iid,jsonb_build_object('operation','STATUS','id',tid,'requestId',gen_random_uuid(),'expectedRevision',1,'status','MITIGATING'));
 begin perform public.save_risk_tracking(w,m,iid,jsonb_build_object('operation','STATUS','id',tid,'requestId',gen_random_uuid(),'expectedRevision',1,'status','OPEN'));raise exception 'STALE_ACCEPTED';exception when others then if sqlerrm<>'STALE_RISK' then raise;end if;end;
 begin perform public.save_risk_tracking(w,m,iid,jsonb_build_object('operation','STATUS','id',tid,'requestId',gen_random_uuid(),'expectedRevision',2,'status','CLOSED'));raise exception 'REASONLESS_CLOSE';exception when others then if sqlerrm<>'REASON_REQUIRED' then raise;end if;end;
 begin perform public.save_risk_tracking(w,member,iid,jsonb_build_object('operation','UPDATE','id',tid,'requestId',gen_random_uuid(),'expectedRevision',2,'mitigationText','hijack'));raise exception 'OWNER_EDITED_MITIGATION';exception when others then if sqlerrm<>'RISK_PERMISSION' then raise;end if;end;
 perform public.save_risk_tracking(w,m,iid,jsonb_build_object('operation','STATUS','id',tid,'requestId',gen_random_uuid(),'expectedRevision',2,'status','CLOSED','reason','Acquirer moved file to 04:00'));
 if (select status||':'||(data->>'resolvedAt' is not null)::text from public.risk_tracking where id=tid)<>'CLOSED:true' or (select count(*) from public.risk_tracking_events where tracking_id=tid)<>3 then raise exception 'CLOSE_NOT_RECORDED';end if;
 -- Tracking never edits the claim text; events are append-only.
 if (select value from public.claims where id=rc)<>q then raise exception 'CLAIM_EDITED';end if;
 begin update public.risk_tracking_events set data='{}' where tracking_id=tid;raise exception 'EVENTS_MUTABLE';exception when insufficient_privilege then null;end;
 -- Supersession: tracking stays; carrying forward is an explicit command to the replacement only.
 reset role;insert into public.claims(id,workspace_id,initiative_id,type,status,subject,attribute,value,domain,created_by,origin) values(gen_random_uuid(),w,iid,'RISK','UNVERIFIED','Settlement files','timeliness','files may arrive after 06:00','OPERATIONS',actor,'HUMAN_ENTRY') returning id into rc2;
 update public.claims set status='SUPERSEDED',superseded_by_claim_id=rc2 where id=rc;set local role service_role;
 if (select claim_id from public.risk_tracking where id=tid)<>rc then raise exception 'TRACKING_MOVED_SILENTLY';end if;
 select updated_at into stamp from public.claims where id=rc2;perform public.verify_claim(rc2,stamp,'DIRECT_KNOWLEDGE','Synthetic verification',actor::text,'Synthetic Reviewer');
 tid2:=public.save_risk_tracking(w,m,iid,jsonb_build_object('operation','CARRY','id',tid,'claimId',rc2,'requestId',gen_random_uuid(),'expectedRevision',0));
 if (select status||':'||(data->>'carriedFromTrackingId') from public.risk_tracking where id=tid2)<>'CLOSED:'||tid::text then raise exception 'CARRY_INCORRECT';end if;
 raise notice 'PASS: unverified risk not trackable, viewer/member denial, single tracking per claim, owner status change, stale revision, reasoned close, owner cannot edit mitigation, claim text untouched, append-only events, no silent move on supersession, explicit carry forward';
end$$;set constraints all immediate;reset role;rollback;
