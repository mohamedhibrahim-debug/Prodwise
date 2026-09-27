\set ON_ERROR_STOP on
do $$begin if current_database() !~ '^prodwise_second_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_LOCAL_DATABASE_REQUIRED';end if;end$$;
begin;
insert into auth.users(id,email,email_confirmed_at) values('e8100000-0000-4000-8000-000000000001','rel-viewer@synthetic.test',now()),('e8100000-0000-4000-8000-000000000011','rel-member@synthetic.test',now()),('e8100000-0000-4000-8000-000000000021','rel-foreign@synthetic.test',now());
insert into public.users(id,email,display_name,auth_user_id,active,is_system) values('e8100000-0000-4000-8000-000000000002','rel-viewer@synthetic.test','Synthetic rel Viewer','e8100000-0000-4000-8000-000000000001',true,false),('e8100000-0000-4000-8000-000000000012','rel-member@synthetic.test','Synthetic rel Member','e8100000-0000-4000-8000-000000000011',true,false);
insert into public.organization_memberships(id,organization_id,user_id,role,active,is_product_lead,policy_override,policy_override_reason) values
 ('e8100000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001','e8100000-0000-4000-8000-000000000002','VIEWER',true,false,true,'Disposable synthetic negative-test fixture'),
 ('e8100000-0000-4000-8000-000000000013','d2000000-0000-4000-8000-000000000001','e8100000-0000-4000-8000-000000000012','MEMBER',true,false,true,'Disposable synthetic negative-test fixture');
set local role service_role;
do $$declare w uuid:='d2000000-0000-4000-8000-000000000002';m uuid:='d2000000-0000-4000-8000-000000000003';viewer uuid:='e8100000-0000-4000-8000-000000000003';member uuid:='e8100000-0000-4000-8000-000000000013';
 a uuid;b uuid;c uuid;foreign_i uuid;rid uuid;rid2 uuid;sid uuid;aid uuid;pid uuid;new_slug text;response jsonb;notes text:='Merchant Insights depends on Instant Settlement Payout (synthetic).';q text:=$q$Instant Settlement Payout$q$;
 function_input jsonb;
begin
 new_slug:=public.create_managed_initiative(w,m,jsonb_build_object('requestId',gen_random_uuid(),'name','Synthetic rel A','businessLine','FS','stage','DELIVERY','ownerMemberId',m));select id into a from public.initiatives where workspace_id=w and initiatives.slug=new_slug;
 new_slug:=public.create_managed_initiative(w,m,jsonb_build_object('requestId',gen_random_uuid(),'name','Synthetic rel B','businessLine','FS','stage','DELIVERY','ownerMemberId',m));select id into b from public.initiatives where workspace_id=w and initiatives.slug=new_slug;
 new_slug:=public.create_managed_initiative(w,m,jsonb_build_object('requestId',gen_random_uuid(),'name','Synthetic rel C','businessLine','FS','stage','DELIVERY','ownerMemberId',m));select id into c from public.initiatives where workspace_id=w and initiatives.slug=new_slug;
 select id into foreign_i from public.initiatives where workspace_id<>w limit 1;
 function_input:=jsonb_build_object('operation','CREATE','requestId',gen_random_uuid(),'expectedRevision',0,'fromInitiativeId',a,'toInitiativeId',b,'type','DEPENDS_ON','rationale','A needs B settlement files','providerFactKind','TARGET_LIVE','neededByFactKind','NEXT_MILESTONE');
 -- R-4 Viewer and non-owner Member are denied a crafted create; nothing is written.
 begin perform public.save_relationship(w,viewer,function_input);raise exception 'VIEWER_ACCEPTED';exception when others then if sqlerrm='VIEWER_ACCEPTED' then raise;end if;end;
 begin perform public.save_relationship(w,member,function_input);raise exception 'MEMBER_ACCEPTED';exception when others then if sqlerrm<>'RELATIONSHIP_PERMISSION' then raise;end if;end;
 if exists(select 1 from public.initiative_relationships where from_initiative_id=a) then raise exception 'DENIED_WRITE_PERSISTED';end if;
 rid:=public.save_relationship(w,m,function_input);if public.save_relationship(w,m,function_input)<>rid then raise exception 'RETRY_DUPLICATED';end if;
 -- R-3 self, duplicate-active, cycle and cross-org are rejected server-side.
 begin perform public.save_relationship(w,m,function_input||jsonb_build_object('requestId',gen_random_uuid()));raise exception 'DUPLICATE_ACCEPTED';exception when others then if sqlerrm<>'RELATIONSHIP_DUPLICATE' then raise;end if;end;
 begin perform public.save_relationship(w,m,function_input||jsonb_build_object('requestId',gen_random_uuid(),'toInitiativeId',a));raise exception 'SELF_ACCEPTED';exception when others then if sqlerrm<>'RELATIONSHIP_SELF' then raise;end if;end;
 begin perform public.save_relationship(w,m,function_input||jsonb_build_object('requestId',gen_random_uuid(),'fromInitiativeId',b,'toInitiativeId',a));raise exception 'CYCLE_ACCEPTED';exception when others then if sqlerrm<>'RELATIONSHIP_CYCLE' then raise;end if;end;
 perform public.save_relationship(w,m,jsonb_build_object('operation','CREATE','requestId',gen_random_uuid(),'expectedRevision',0,'fromInitiativeId',b,'toInitiativeId',c,'type','DEPENDS_ON','rationale','B needs C'));
 begin perform public.save_relationship(w,m,jsonb_build_object('operation','CREATE','requestId',gen_random_uuid(),'expectedRevision',0,'fromInitiativeId',c,'toInitiativeId',a,'type','DEPENDS_ON','rationale','closes a loop'));raise exception 'TRANSITIVE_CYCLE_ACCEPTED';exception when others then if sqlerrm<>'RELATIONSHIP_CYCLE' then raise;end if;end;
 if foreign_i is not null then begin perform public.save_relationship(w,m,function_input||jsonb_build_object('requestId',gen_random_uuid(),'toInitiativeId',foreign_i));raise exception 'CROSS_ORG_ACCEPTED';exception when others then if sqlerrm<>'INITIATIVE_ACCESS' then raise;end if;end;end if;
 begin reset role;insert into public.initiative_relationships(id,workspace_id,from_initiative_id,to_initiative_id,type,status,revision,data) values(gen_random_uuid(),w,a,a,'RELATED_TO','ACTIVE',1,'{}');raise exception 'SELF_ROW_ACCEPTED';exception when check_violation then null;end;set local role service_role;
 -- PART_OF: at most one active parent. RELATED_TO: stored in one normalized direction.
 perform public.save_relationship(w,m,jsonb_build_object('operation','CREATE','requestId',gen_random_uuid(),'expectedRevision',0,'fromInitiativeId',c,'toInitiativeId',a,'type','PART_OF','rationale','C is a workstream of A'));
 begin perform public.save_relationship(w,m,jsonb_build_object('operation','CREATE','requestId',gen_random_uuid(),'expectedRevision',0,'fromInitiativeId',c,'toInitiativeId',b,'type','PART_OF','rationale','second parent'));raise exception 'SECOND_PARENT_ACCEPTED';exception when others then if sqlerrm<>'RELATIONSHIP_PARENT' then raise;end if;end;
 rid2:=public.save_relationship(w,m,jsonb_build_object('operation','CREATE','requestId',gen_random_uuid(),'expectedRevision',0,'fromInitiativeId',greatest(a,b),'toInitiativeId',least(a,b),'type','RELATED_TO','rationale','shared settlement'));
 if (select from_initiative_id from public.initiative_relationships where id=rid2)<>least(a,b) then raise exception 'RELATED_NOT_NORMALIZED';end if;
 -- Stale revision refused; END keeps the row with reason and writes history on both initiatives.
 begin perform public.save_relationship(w,m,jsonb_build_object('operation','END','id',rid,'requestId',gen_random_uuid(),'expectedRevision',0,'reason','x'));raise exception 'STALE_ACCEPTED';exception when others then if sqlerrm<>'STALE_RELATIONSHIP' then raise;end if;end;
 begin perform public.save_relationship(w,m,jsonb_build_object('operation','END','id',rid,'requestId',gen_random_uuid(),'expectedRevision',1,'reason',''));raise exception 'REASONLESS_END';exception when others then if sqlerrm<>'REASON_REQUIRED' then raise;end if;end;
 perform public.save_relationship(w,m,jsonb_build_object('operation','END','id',rid,'requestId',gen_random_uuid(),'expectedRevision',1,'reason','B shipped the capability another way'));
 if (select status||':'||(data->>'endReason') from public.initiative_relationships where id=rid)<>'ENDED:B shipped the capability another way' or (select count(*) from public.relationship_events where relationship_id=rid)<>2 then raise exception 'END_NOT_PRESERVED';end if;
 if (select count(distinct initiative_id) from public.activity_log where entity_id=rid::text and event_type='RELATIONSHIP_ENDED')<>2 then raise exception 'END_HISTORY_NOT_ON_BOTH';end if;
 begin update public.relationship_events set data='{}' where relationship_id=rid;raise exception 'EVENTS_MUTABLE';exception when insufficient_privilege then null;end;
 -- An ended relationship can be recorded again as a new active row.
 perform public.save_relationship(w,m,function_input||jsonb_build_object('requestId',gen_random_uuid()));
 -- AI path: a RELATIONSHIP proposal is confirmed only through this command with a human type and rationale.
 sid:=public.submit_anchored_evidence(w,m,jsonb_build_object('initiativeId',c,'requestId',gen_random_uuid(),'title','Synthetic relationship note','text',notes,'textSha256',encode(sha256(convert_to(notes,'UTF8')),'hex'),'charLength',length(notes)));
 response:=public.start_evidence_attempt(w,m,sid,gen_random_uuid());aid:=(response->>'attemptId')::uuid;
 perform public.finish_evidence_attempt(w,m,aid,jsonb_build_object('model','synthetic-provider-fixture','discardedCount',0,'errorCode',null,'candidates',jsonb_build_array(jsonb_build_object('type','RELATIONSHIP','payload',jsonb_build_object('subject','Synthetic rel B','attribute','relationship','value',q,'domain','PRODUCT','phase',null,'targetInitiativeId',b),'anchor',jsonb_build_object('start',position(q in notes)-1,'end',position(q in notes)-1+length(q),'quote',q),'baseRevision',0))));
 select id into pid from public.evidence_proposals where attempt_id=aid;
 if exists(select 1 from public.initiative_relationships where from_initiative_id=c and to_initiative_id=b and type='RELATED_TO') then raise exception 'UNCONFIRMED_RELATIONSHIP_WRITTEN';end if;
 begin perform public.decide_evidence_proposal(w,m,jsonb_build_object('id',pid,'version',1,'operation','CONFIRM','requestId',gen_random_uuid(),'reason',''));raise exception 'GENERIC_CONFIRM_ACCEPTED';exception when others then if sqlerrm<>'RELATIONSHIP_COMMAND_REQUIRED' then raise;end if;end;
 rid:=public.save_relationship(w,m,jsonb_build_object('operation','CREATE','requestId',gen_random_uuid(),'expectedRevision',0,'type','RELATED_TO','rationale','Named together in the synthetic note','proposalId',pid,'proposalVersion',1));
 if (select data->>'status' from public.evidence_proposals where id=pid)<>'CONFIRMED' or (select data->>'evidenceAnchorId' from public.initiative_relationships where id=rid) is null or not exists(select 1 from public.evidence_confirmations where proposal_id=pid) then raise exception 'PROPOSAL_RELATIONSHIP_PROVENANCE';end if;
 raise notice 'PASS: viewer/member denial, retry, duplicate/self/cycle/transitive-cycle/cross-org/self-row rejection, single parent, normalized RELATED_TO, stale revision, reasoned END preserved with events on both initiatives, append-only events, re-record after end, AI relationship only via explicit human command with anchor provenance';
end$$;set constraints all immediate;reset role;rollback;
