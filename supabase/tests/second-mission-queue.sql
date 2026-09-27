\set ON_ERROR_STOP on
-- Only the root-owned disposable local replay database. All synthetic fixtures roll back.
do $$begin if current_database() !~ '^prodwise_second_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_LOCAL_DATABASE_REQUIRED';end if;end$$;
begin;
insert into auth.users(id,email,email_confirmed_at) values('e3200000-0000-4000-8000-000000000001','queue-viewer@synthetic.test',now());
insert into public.users(id,email,display_name,auth_user_id,active,is_system) values('e3200000-0000-4000-8000-000000000002','queue-viewer@synthetic.test','Synthetic Queue Viewer','e3200000-0000-4000-8000-000000000001',true,false);
insert into public.organization_memberships(id,organization_id,user_id,role,active,is_product_lead,policy_override,policy_override_reason) values('e3200000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001','e3200000-0000-4000-8000-000000000002','VIEWER',true,false,true,'Disposable Queue negative test');
insert into public.initiatives(id,workspace_id,slug,name,business_line,stage) values('e3200000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000002','synthetic-queue-test','Synthetic Queue test','FS','DISCOVERY');
insert into public.claims(id,workspace_id,initiative_id,type,status,subject,attribute,value,domain,phase,origin) values
 ('e3200000-0000-4000-8000-000000000005','d2000000-0000-4000-8000-000000000002','e3200000-0000-4000-8000-000000000004','REQUIREMENT','ACTIVE','Queue value','Divisor','27','PRODUCT',null,'LEGACY'),
 ('e3200000-0000-4000-8000-000000000006','d2000000-0000-4000-8000-000000000002','e3200000-0000-4000-8000-000000000004','REQUIREMENT','ACTIVE','Queue value','Divisor','30','PRODUCT',null,'LEGACY');
set local role service_role;
do $$declare w uuid:='d2000000-0000-4000-8000-000000000002';m uuid:='d2000000-0000-4000-8000-000000000003';iid uuid:='e3200000-0000-4000-8000-000000000004';fp text;f jsonb;cmd jsonb;r jsonb;r2 jsonb;rid uuid;count_before bigint;begin
 fp:=public.decision_hash(array['CONFLICT_SAME_ATTRIBUTE_V1',iid::text,'queue value','divisor',null,'27','30']);f:=public.queue_current_finding(w,iid,fp);if f is null then raise exception 'CURRENT_FINDING_MISSING';end if;
 cmd:=jsonb_build_object('workspaceId',w,'initiativeId',iid,'findingId',fp,'kind','DISMISSED','deferUntil',null,'deferUntilNextReview',false,'reason','Exact synthetic values are separate conventions.','expectedDigest',f->>'digest','expectedLatestDispositionId',null,'clientRequestId',gen_random_uuid());
 r:=public.record_disposition(w,'e3200000-0000-4000-8000-000000000003',cmd);if r->>'code'<>'forbidden' then raise exception 'VIEWER_ACCEPTED';end if;
 r:=public.record_disposition(w,m,cmd);if r->>'code'<>'ok' then raise exception 'DISMISS_FAILED:%',r;end if;rid:=(r#>>'{row,id}')::uuid;
 r2:=public.record_disposition(w,m,cmd);if r2->>'code'<>'ok' or not (r2->>'replay')::boolean or r2#>>'{row,id}'<>rid::text then raise exception 'RETRY_DUPLICATED';end if;
 if (select count(*) from public.finding_dispositions where initiative_id=iid)<>1 or (select count(*) from public.activity_log where initiative_id=iid and event_type='FINDING_DISMISSED')<>1 then raise exception 'HISTORY_DUPLICATED';end if;
 if r#>>'{row,actor,id}' is distinct from (select user_id::text from public.organization_memberships where id=m) then raise exception 'ACTOR_NOT_BOUND';end if;
 if public.queue_current_finding(w,iid,fp)->>'digest'<>f->>'digest' then raise exception 'DIGEST_FEEDBACK_LOOP';end if;
 r:=public.record_disposition(w,m,cmd||jsonb_build_object('clientRequestId',gen_random_uuid(),'expectedDigest','stale'));if r->>'code'<>'digest_conflict' then raise exception 'STALE_DIGEST_ACCEPTED';end if;
 r:=public.record_disposition(w,m,cmd||jsonb_build_object('clientRequestId',gen_random_uuid()));if r->>'code'<>'disposition_conflict' or r#>>'{latest,id}'<>rid::text then raise exception 'STALE_ROW_ACCEPTED';end if;
 begin update public.finding_dispositions set reason='tampered' where id=rid;raise exception 'UPDATE_ACCEPTED';exception when insufficient_privilege then null;end;
 begin delete from public.finding_dispositions where id=rid;raise exception 'DELETE_ACCEPTED';exception when insufficient_privilege then null;end;
 r:=public.record_disposition(w,m,cmd||jsonb_build_object('clientRequestId',gen_random_uuid(),'kind','WITHDRAWN','reason','','expectedLatestDispositionId',rid));if r->>'code'<>'ok' then raise exception 'WITHDRAW_FAILED:%',r;end if;rid:=(r#>>'{row,id}')::uuid;
 r:=public.record_disposition(w,m,cmd||jsonb_build_object('clientRequestId',gen_random_uuid(),'kind','WITHDRAWN','reason','','expectedLatestDispositionId',rid));if r->>'code'<>'invalid' then raise exception 'ALREADY_OPEN_WITHDRAW_ACCEPTED';end if;
 r:=public.record_disposition(w,m,cmd||jsonb_build_object('clientRequestId',gen_random_uuid(),'kind','DEFERRED','deferUntil',(now() at time zone 'Africa/Cairo')::date,'expectedLatestDispositionId',rid));if r->>'code'<>'invalid' then raise exception 'PAST_DATE_ACCEPTED';end if;
 r:=public.record_disposition(w,m,cmd||jsonb_build_object('clientRequestId',gen_random_uuid(),'kind','DEFERRED','deferUntilNextReview',true,'expectedLatestDispositionId',rid));if r->>'code'<>'ok' then raise exception 'NEXT_REVIEW_FAILED:%',r;end if;rid:=(r#>>'{row,id}')::uuid;
 if public.delivery_source(w)->'findingDispositions' is null then raise exception 'WEEKLY_SOURCE_MISSING';end if;
 r:=public.read_finding_dispositions(w,m,iid,clock_timestamp());if jsonb_array_length(r->'dispositions')<>3 then raise exception 'READ_COUNT_WRONG';end if;
 select count(*) into count_before from public.finding_dispositions where initiative_id=iid;
 if count_before<>3 then raise exception 'FAILURE_CHANGED_ROWS';end if;
 raise notice 'PASS Queue SQL checks: current digest, Viewer denied, dismissal, retry, one row/event, bound actor, no digest loop, stale digest/latest, UPDATE/DELETE denied, withdrawal, invalid withdrawal/past date, next review, weekly source/read counts';
end$$;
reset role;
do $$declare rid uuid;begin select id into rid from public.finding_dispositions where initiative_id='e3200000-0000-4000-8000-000000000004' limit 1;begin update public.finding_dispositions set reason='operator tamper' where id=rid;raise exception 'TRIGGER_UPDATE_ACCEPTED';exception when others then if sqlerrm<>'DISPOSITION_APPEND_ONLY' then raise;end if;end;begin delete from public.finding_dispositions where id=rid;raise exception 'TRIGGER_DELETE_ACCEPTED';exception when others then if sqlerrm<>'DISPOSITION_APPEND_ONLY' then raise;end if;end;update public.initiatives set archived_at=now() where id='e3200000-0000-4000-8000-000000000004';end$$;
set local role service_role;
do $$declare r jsonb;begin r:=public.record_disposition('d2000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000003',jsonb_build_object('workspaceId','d2000000-0000-4000-8000-000000000002','initiativeId','e3200000-0000-4000-8000-000000000004'));if r->>'code'<>'archived' then raise exception 'ARCHIVE_WRITE_ACCEPTED';end if;perform public.read_finding_dispositions('d2000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000003','e3200000-0000-4000-8000-000000000004',clock_timestamp());raise notice 'PASS Queue SQL: append-only operator trigger, archived write denied/read allowed';end$$;
reset role;set constraints all immediate;rollback;
