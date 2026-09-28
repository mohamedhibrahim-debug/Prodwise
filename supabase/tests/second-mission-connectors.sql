-- Run only against the disposable Second Mission replay. All fixture changes roll back.
\set ON_ERROR_STOP on
do $$begin if current_database() !~ '^prodwise_second_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_LOCAL_DATABASE_REQUIRED';end if;end$$;
begin;
insert into auth.users(id,email,email_confirmed_at) values('e3000000-0000-4000-8000-000000000001','connector-member@fictional.test',now()),('e3000000-0000-4000-8000-000000000002','connector-viewer@fictional.test',now());
insert into public.users(id,email,display_name,auth_user_id,active,is_system)
select id,email,'Synthetic connector test',id,true,false from auth.users where id in ('e3000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,role,active,is_product_lead,policy_override,policy_override_reason)
values('e3000000-0000-4000-8000-000000000011','d2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','MEMBER',true,false,true,'Disposable synthetic test'),
('e3000000-0000-4000-8000-000000000012','d2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000002','VIEWER',true,false,true,'Disposable synthetic test');
set local role service_role;
do $$declare
 w uuid:='d2000000-0000-4000-8000-000000000002'; m uuid:='e3000000-0000-4000-8000-000000000011'; v uuid:='e3000000-0000-4000-8000-000000000012';
 i uuid:='6d525f1b-36ef-4117-82d0-6c348ce6dbbb'; base jsonb; r jsonb; r2 jsonb; item uuid; claims_before integer; facts_before integer; t1 text:='PAY-7 Synthetic epic. Status: In Progress.'; t2 text:='PAY-7 Synthetic epic. Status: Blocked.';
begin
 select count(*) into claims_before from public.claims where workspace_id=w;select count(*) into facts_before from public.delivery_facts where workspace_id=w;
 base:=jsonb_build_object('initiativeId',i,'mode','IMPORT','connector','JIRA','provider','JIRA','providerWorkspace','synthetic.example','containerReference','PAY','containerName','Synthetic Payments','role','DELIVERY',
  'item',jsonb_build_object('reference','PAY-7','name','Synthetic epic','kind','Epic','url','https://synthetic.example/browse/PAY-7'),'title','PAY-7 · Synthetic epic','evidenceSourceType','JIRA','externalUpdatedAt','2026-09-20T10:00:00.000+0000');
 -- Wrong digest is refused before anything is written.
 begin perform public.import_connector_snapshot(w,m,base||jsonb_build_object('requestId','e3000000-0000-4000-8000-0000000000a0','text',t1,'textSha256',repeat('0',64),'charLength',length(t1)));raise exception 'TEST_BAD_DIGEST';exception when others then if sqlerrm<>'INVALID_EVIDENCE' then raise;end if;end;
 -- A Viewer cannot import.
 begin perform public.import_connector_snapshot(w,v,base||jsonb_build_object('requestId','e3000000-0000-4000-8000-0000000000a1','text',t1,'textSha256',encode(sha256(convert_to(t1,'UTF8')),'hex'),'charLength',length(t1)));raise exception 'TEST_VIEWER_IMPORT';exception when others then if sqlerrm<>'VIEW_ONLY' then raise;end if;end;
 r:=public.import_connector_snapshot(w,m,base||jsonb_build_object('requestId','e3000000-0000-4000-8000-0000000000a2','text',t1,'textSha256',encode(sha256(convert_to(t1,'UTF8')),'hex'),'charLength',length(t1)));
 if (r->>'changed')::boolean is not true then raise exception 'TEST_IMPORT_NOT_SAVED';end if;
 -- Retrying the same request replays; it never duplicates.
 r2:=public.import_connector_snapshot(w,m,base||jsonb_build_object('requestId','e3000000-0000-4000-8000-0000000000a2','text',t1,'textSha256',encode(sha256(convert_to(t1,'UTF8')),'hex'),'charLength',length(t1)));
 if r2->>'submissionId'<>r->>'submissionId' or (r2->>'replay')::boolean is not true then raise exception 'TEST_REPLAY';end if;
 select si.id into item from public.source_items si join public.source_containers sc on sc.id=si.container_id where sc.provider_workspace='synthetic.example' and si.reference='PAY-7';
 if not exists(select 1 from public.evidence e join public.evidence_submissions s on s.data->>'evidenceId'=e.id::text where s.id=(r->>'submissionId')::uuid and e.source_type='JIRA' and e.source_reference='PAY-7' and e.source_url='https://synthetic.example/browse/PAY-7' and s.data#>>'{origin,connector}'='JIRA') then raise exception 'TEST_EVIDENCE_SHAPE';end if;
 if (select count(*) from public.activity_log where event_type='SOURCE_IMPORTED' and payload->>'sourceItemId'=item::text)<>1 then raise exception 'TEST_IMPORT_ACTIVITY';end if;
 -- Refresh with unchanged content moves only the check time.
 r2:=public.import_connector_snapshot(w,m,base||jsonb_build_object('mode','REFRESH','requestId','e3000000-0000-4000-8000-0000000000a3','text',t1,'textSha256',encode(sha256(convert_to(t1,'UTF8')),'hex'),'charLength',length(t1)));
 if (r2->>'changed')::boolean or r2->>'submissionId'<>r->>'submissionId' then raise exception 'TEST_UNCHANGED_REFRESH';end if;
 if (select count(*) from public.evidence_submissions where data->>'sourceItemId'=item::text)<>1 then raise exception 'TEST_UNCHANGED_SNAPSHOT_SAVED';end if;
 -- Changed content saves a new snapshot, keeps the old one, and records the change signal.
 r2:=public.import_connector_snapshot(w,m,base||jsonb_build_object('mode','REFRESH','requestId','e3000000-0000-4000-8000-0000000000a4','text',t2,'textSha256',encode(sha256(convert_to(t2,'UTF8')),'hex'),'charLength',length(t2)));
 if not (r2->>'changed')::boolean then raise exception 'TEST_CHANGE_MISSED';end if;
 if (select count(*) from public.evidence_submissions where data->>'sourceItemId'=item::text)<>2 then raise exception 'TEST_SNAPSHOT_HISTORY';end if;
 if not exists(select 1 from public.activity_log where event_type='SOURCE_CHANGED' and payload->>'previousSubmissionId'=r->>'submissionId') then raise exception 'TEST_CHANGE_ACTIVITY';end if;
 -- Unavailable sources keep the last snapshot and are recorded once per transition.
 perform public.record_source_check(w,m,jsonb_build_object('initiativeId',i,'itemId',item,'status','NOT_FOUND'));
 perform public.record_source_check(w,m,jsonb_build_object('initiativeId',i,'itemId',item,'status','NOT_FOUND'));
 if (select count(*) from public.activity_log where event_type='SOURCE_UNAVAILABLE' and entity_id=item::text)<>1 then raise exception 'TEST_UNAVAILABLE_ONCE';end if;
 if not exists(select 1 from public.source_item_syncs where item_id=item and status='NOT_FOUND' and last_submission_id=(r2->>'submissionId')::uuid) then raise exception 'TEST_LAST_SNAPSHOT_KEPT';end if;
 -- Figma is a design source.
 r:=public.import_connector_snapshot(w,m,base||jsonb_build_object('connector','FIGMA','provider','FIGMA','providerWorkspace','figma','containerReference','abcDEF123','containerName','Synthetic checkout design','role','REQUIREMENTS','evidenceSourceType','DESIGN',
   'item',jsonb_build_object('reference','abcDEF123#1:2','name','Checkout · Receipt frame','kind','FRAME','url','https://www.figma.com/design/abcDEF123/x?node-id=1-2'),'requestId','e3000000-0000-4000-8000-0000000000a5','text',t1,'textSha256',encode(sha256(convert_to(t1,'UTF8')),'hex'),'charLength',length(t1)));
 if not exists(select 1 from public.evidence where source_type='DESIGN' and source_reference='abcDEF123#1:2') then raise exception 'TEST_FIGMA';end if;
 -- Connectors never write product truth.
 if (select count(*) from public.claims where workspace_id=w)<>claims_before or (select count(*) from public.delivery_facts where workspace_id=w)<>facts_before then raise exception 'TEST_TRUTH_WRITTEN';end if;
 if has_function_privilege('authenticated','public.import_connector_snapshot(uuid,uuid,jsonb)','EXECUTE') or has_table_privilege('anon','public.connector_connections','SELECT') or has_table_privilege('authenticated','public.connector_connections','SELECT') then raise exception 'TEST_PUBLIC_ACCESS';end if;
 raise notice 'PASS: digest check, Viewer denial, idempotent import, unchanged refresh saves nothing, changed refresh keeps history and signals, unavailable recorded once, Figma design source, no product truth written, no public access';
end$$;
reset role;
rollback;
