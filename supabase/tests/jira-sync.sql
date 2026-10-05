\set ON_ERROR_STOP on
do $$begin if current_database() !~ '^prodwise_sync_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_LOCAL_DATABASE_REQUIRED';end if;end$$;
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('e4000000-0000-4000-8000-000000000001','owner@fictional.test',now()),
 ('e4000000-0000-4000-8000-000000000002','member@fictional.test',now()),
 ('e4000000-0000-4000-8000-000000000003','viewer@fictional.test',now());
insert into public.users(id,email,display_name,auth_user_id,active,is_system)
 select id,email,'Synthetic sync test',id,true,false from auth.users;
insert into public.organizations(id,name,status,allowed_email_domains,allowed_exact_emails)
 values('e4000000-0000-4000-8000-000000000010','Synthetic sync organization','BOOTSTRAPPING',array['fictional.test'],array[]::text[]);
insert into public.workspaces(id,name,status,organization_id)
 values('e4000000-0000-4000-8000-000000000011','Synthetic sync workspace','BOOTSTRAPPING','e4000000-0000-4000-8000-000000000010');
insert into public.organization_memberships(id,organization_id,user_id,role,active)
 values('e4000000-0000-4000-8000-000000000021','e4000000-0000-4000-8000-000000000010','e4000000-0000-4000-8000-000000000001','ORG_OWNER',true),
 ('e4000000-0000-4000-8000-000000000022','e4000000-0000-4000-8000-000000000010','e4000000-0000-4000-8000-000000000002','MEMBER',true),
 ('e4000000-0000-4000-8000-000000000023','e4000000-0000-4000-8000-000000000010','e4000000-0000-4000-8000-000000000003','VIEWER',true);
update public.organizations set status='ACTIVE' where id='e4000000-0000-4000-8000-000000000010';
update public.workspaces set status='ACTIVE' where id='e4000000-0000-4000-8000-000000000011';
insert into public.initiatives(id,workspace_id,slug,name,is_demo,created_by,business_line)
 values('e4000000-0000-4000-8000-000000000031','e4000000-0000-4000-8000-000000000011','synthetic-sync-test','Synthetic sync test',true,'e4000000-0000-4000-8000-000000000002','BP');
insert into public.connector_connections(id,organization_id,user_id,provider,status,sealed_tokens,connected_at)
 values('e4000000-0000-4000-8000-000000000041','e4000000-0000-4000-8000-000000000010','e4000000-0000-4000-8000-000000000002','JIRA','CONNECTED','synthetic-not-a-token',now());
set local role service_role;
do $$declare
 w uuid:='e4000000-0000-4000-8000-000000000011';m uuid:='e4000000-0000-4000-8000-000000000022';v uuid:='e4000000-0000-4000-8000-000000000023';
 i uuid:='e4000000-0000-4000-8000-000000000031';c uuid:='e4000000-0000-4000-8000-000000000041';item uuid;other_item uuid; j jsonb;r jsonb;first_id uuid;
 base jsonb; t text:='Synthetic initial snapshot'; updated text:='Synthetic changed child date 2027-02-28';rev integer; claims_before integer;facts_before integer;
begin
 base:=jsonb_build_object('initiativeId',i,'mode','IMPORT','connector','JIRA','provider','JIRA','providerWorkspace','synthetic.example','containerReference','PAY','containerName','Synthetic Payments','role','DELIVERY',
 'item',jsonb_build_object('reference','PAY-7','name','Synthetic Epic','kind','Epic','url','https://synthetic.example/browse/PAY-7'),'title','Synthetic Epic','evidenceSourceType','JIRA','requestId',gen_random_uuid(),'text',t,'charLength',length(t),'textSha256',encode(sha256(convert_to(t,'UTF8')),'hex'));
 r:=public.import_connector_snapshot(w,m,base);
 select item_id into item from public.source_item_syncs where workspace_id=w and initiative_id=i;
 select count(*) into claims_before from public.claims where workspace_id=w;select count(*) into facts_before from public.delivery_facts where workspace_id=w;
 begin perform public.configure_jira_sync(w,v,i,item,true,0);raise exception 'TEST_VIEWER';exception when others then if sqlerrm<>'VIEW_ONLY' then raise;end if;end;
 begin perform public.configure_jira_sync('10000000-0000-4000-8000-000000000001',m,i,item,true,0);raise exception 'TEST_FOREIGN_WORKSPACE';exception when others then if sqlerrm<>'ACCESS_DENIED' then raise;end if;end;
 perform public.configure_jira_sync(w,m,i,item,true,0);
 begin perform public.configure_jira_sync(w,m,i,item,true,0);raise exception 'TEST_STALE_CONFIG';exception when others then if sqlerrm<>'STALE_REVISION' then raise;end if;end;
 j:=public.claim_jira_sync();if j is null then raise exception 'TEST_CLAIM';end if;
 if public.claim_jira_sync() is not null then raise exception 'TEST_DOUBLE_CLAIM';end if;
 first_id:=(j->>'id')::uuid;select revision into rev from public.source_item_syncs where item_id=item;
 -- Failed evidence validation rolls back the entire completion, including job state.
 begin perform public.finish_jira_sync(first_id,(j->>'lease_token')::uuid,(j->>'revision')::integer,rev,base||jsonb_build_object('textSha256',repeat('0',64)));raise exception 'TEST_BAD_DIGEST';exception when others then if sqlerrm<>'INVALID_EVIDENCE' then raise;end if;end;
 if (select revision from public.jira_sync_jobs where id=first_id)<>(j->>'revision')::integer or (select count(*) from public.evidence_submissions where workspace_id=w)<>1 then raise exception 'TEST_ATOMIC_ROLLBACK';end if;
 -- Same snapshot creates no duplicate evidence.
 r:=public.finish_jira_sync(first_id,(j->>'lease_token')::uuid,(j->>'revision')::integer,rev,base);
 if r->>'outcome'<>'UNCHANGED' then raise exception 'TEST_UNCHANGED %',r;end if;
 if (select count(*) from public.evidence_submissions where workspace_id=w)<>1 then raise exception 'TEST_DUPLICATE';end if;
 update public.jira_sync_jobs set next_run_at=now()-interval '1 minute';j:=public.claim_jira_sync();select revision into rev from public.source_item_syncs where item_id=item;
 base:=base||jsonb_build_object('text',updated,'charLength',length(updated),'textSha256',encode(sha256(convert_to(updated,'UTF8')),'hex'));
 r:=public.finish_jira_sync(first_id,(j->>'lease_token')::uuid,(j->>'revision')::integer,rev,base);
 if r->>'outcome'<>'SAVED' or (select count(*) from public.evidence_submissions where workspace_id=w)<>2 then raise exception 'TEST_CHANGED %',r;end if;
 -- Replayed/stale completion cannot publish.
 if public.finish_jira_sync(first_id,(j->>'lease_token')::uuid,(j->>'revision')::integer,rev,base)->>'outcome'<>'STALE' then raise exception 'TEST_COMPLETION_REPLAY';end if;
 -- Manual refresh wins over a snapshot fetched earlier.
 update public.jira_sync_jobs set next_run_at=now()-interval '1 minute';j:=public.claim_jira_sync();select revision into rev from public.source_item_syncs where item_id=item;
 perform public.import_connector_snapshot(w,m,base||jsonb_build_object('mode','REFRESH','requestId',gen_random_uuid()));
 r:=public.finish_jira_sync(first_id,(j->>'lease_token')::uuid,(j->>'revision')::integer,rev,base);
 if r->>'outcome'<>'STALE' or r->>'code'<>'CHECK_SUPERSEDED' then raise exception 'TEST_MANUAL_REFRESH_RACE %',r;end if;
 -- Pause cancels the running lease.
 update public.jira_sync_jobs set next_run_at=now()-interval '1 minute';j:=public.claim_jira_sync();
 perform public.configure_jira_sync(w,m,i,item,false,(j->>'revision')::integer);
 if public.finish_jira_sync(first_id,(j->>'lease_token')::uuid,(j->>'revision')::integer,rev,base)->>'outcome'<>'STALE' then raise exception 'TEST_PAUSE';end if;
 select revision into rev from public.jira_sync_jobs where id=first_id;perform public.configure_jira_sync(w,m,i,item,true,rev);j:=public.claim_jira_sync();select revision into rev from public.source_item_syncs where item_id=item;
 -- Disconnect during fetch stops publication and keeps the previous snapshot.
 update public.connector_connections set status='DISCONNECTED',sealed_tokens=null where id=c;
 r:=public.finish_jira_sync(first_id,(j->>'lease_token')::uuid,(j->>'revision')::integer,rev,base);
 if r->>'code'<>'NOT_CONNECTED' or (select status from public.jira_sync_jobs where id=first_id)<>'ATTENTION' then raise exception 'TEST_DISCONNECT %',r;end if;
 update public.connector_connections set status='CONNECTED',sealed_tokens='synthetic-not-a-token',connected_at=clock_timestamp() where id=c;
 select revision into rev from public.jira_sync_jobs where id=first_id;perform public.configure_jira_sync(w,m,i,item,true,rev);j:=public.claim_jira_sync();select revision into rev from public.source_item_syncs where item_id=item;
 update public.organization_memberships set active=false where id=m;
 r:=public.finish_jira_sync(first_id,(j->>'lease_token')::uuid,(j->>'revision')::integer,rev,base);
 if r->>'code'<>'ACCESS_REVOKED' then raise exception 'TEST_REVOKE %',r;end if;
 update public.organization_memberships set active=true where id=m;
 -- Unlink and archive are rechecked at completion, not only at fetch start.
 select revision into rev from public.jira_sync_jobs where id=first_id;perform public.configure_jira_sync(w,m,i,item,true,rev);j:=public.claim_jira_sync();select revision into rev from public.source_item_syncs where item_id=item;
 update public.source_mappings set unlinked_at=clock_timestamp(),unlinked_by='e4000000-0000-4000-8000-000000000002',unlink_reason='Synthetic unlink test' where workspace_id=w and initiative_id=i and item_id=item;
 r:=public.finish_jira_sync(first_id,(j->>'lease_token')::uuid,(j->>'revision')::integer,rev,base);
 if r->>'code'<>'ACCESS_REVOKED' then raise exception 'TEST_UNLINK %',r;end if;
 update public.source_mappings set unlinked_at=null,unlinked_by=null,unlink_reason=null where workspace_id=w and initiative_id=i and item_id=item;
 select revision into rev from public.jira_sync_jobs where id=first_id;perform public.configure_jira_sync(w,m,i,item,true,rev);j:=public.claim_jira_sync();select revision into rev from public.source_item_syncs where item_id=item;
 update public.initiatives set archived_at=clock_timestamp(),archived_by='e4000000-0000-4000-8000-000000000001',archive_reason='Synthetic archive test' where id=i;
 r:=public.finish_jira_sync(first_id,(j->>'lease_token')::uuid,(j->>'revision')::integer,rev,base);
 if r->>'code'<>'ACCESS_REVOKED' then raise exception 'TEST_ARCHIVE %',r;end if;
 update public.initiatives set archived_at=null,archived_by=null,archive_reason=null where id=i;
 if (select count(*) from public.evidence_submissions where workspace_id=w)<>2 then raise exception 'TEST_REVOKED_HISTORY';end if;
 select revision into rev from public.jira_sync_jobs where id=first_id;perform public.configure_jira_sync(w,m,i,item,true,rev);j:=public.claim_jira_sync();
 r:=public.finish_jira_sync(first_id,(j->>'lease_token')::uuid,(j->>'revision')::integer,null,null,'RATE_LIMITED');
 if (select failures from public.jira_sync_jobs where id=first_id)<>1 or (select status from public.jira_sync_jobs where id=first_id)<>'ACTIVE' then raise exception 'TEST_BACKOFF';end if;
 -- Different source jobs sharing one connection cannot run together.
 perform public.import_connector_snapshot(w,m,base||jsonb_build_object('requestId',gen_random_uuid(),'item',jsonb_build_object('reference','PAY-8','name','Second synthetic Epic','kind','Epic')));
 select id into other_item from public.source_items where workspace_id=w and reference='PAY-8';perform public.configure_jira_sync(w,m,i,other_item,true,0);
 update public.jira_sync_jobs set next_run_at=now()-interval '1 minute';j:=public.claim_jira_sync();
 if public.claim_jira_sync() is not null then raise exception 'TEST_CONNECTION_SERIALIZATION';end if;
 update public.jira_sync_jobs set lease_until=now()-interval '1 minute' where id=(j->>'id')::uuid;
 update public.connector_connections set sync_lease_until=now()-interval '1 minute' where id=c;
 r:=public.claim_jira_sync();if r is null or r->>'lease_token'=j->>'lease_token' then raise exception 'TEST_CRASH_RECOVERY';end if;
 if (select count(*) from public.claims where workspace_id=w)<>claims_before or (select count(*) from public.delivery_facts where workspace_id=w)<>facts_before then raise exception 'TEST_CANONICAL_TRUTH';end if;
 if has_function_privilege('authenticated','public.claim_jira_sync()','EXECUTE') or has_function_privilege('anon','public.finish_jira_sync(uuid,uuid,integer,integer,jsonb,text)','EXECUTE') or has_table_privilege('authenticated','public.jira_sync_jobs','SELECT') then raise exception 'TEST_PUBLIC_ACCESS';end if;
 raise notice 'PASS: scoped opt-in, Viewer denial, revision conflict, exclusive leases, atomic snapshot completion/history, manual refresh conflict, pause, disconnect, member revocation, retry backoff, shared connection serialization, crash recovery, no truth writes, deny-all public access';
end$$;
reset role;
commit;

-- Real concurrent database sessions, not simulated in-memory locks.
create extension if not exists dblink;
update public.jira_sync_jobs set status='ACTIVE',next_run_at=now()-interval '1 minute',lease_token=null,lease_until=null;
update public.connector_connections set sync_lease_token=null,sync_lease_until=null;
do $$declare conn text:='host=127.0.0.1 port='||inet_server_port()||' dbname='||current_database()||' user=postgres';j jsonb;r jsonb;
begin
 perform dblink_connect('sync_a',conn);perform dblink_connect('sync_b',conn);
 perform dblink_exec('sync_a','set role service_role');perform dblink_exec('sync_b','set role service_role');
 perform dblink_exec('sync_a','begin');
 select value into j from dblink('sync_a','select public.claim_jira_sync()') as result(value jsonb);
 if j is null then raise exception 'TEST_PARALLEL_FIRST_CLAIM';end if;
 select value into r from dblink('sync_b','select public.claim_jira_sync()') as result(value jsonb);
 if r is not null then raise exception 'TEST_PARALLEL_DOUBLE_CLAIM';end if;
 perform dblink_exec('sync_a','commit');
 select value into r from dblink('sync_b','select public.claim_jira_sync()') as result(value jsonb);
 if r is not null then raise exception 'TEST_PERSISTED_CONNECTION_LEASE';end if;
 perform dblink_disconnect('sync_a');perform dblink_disconnect('sync_b');
 raise notice 'PASS: two simultaneous SQL sessions cannot claim the same job or a second source on the same connection';
end$$;

-- Trusted Demo registration is an operator action; it never enables real connectors.
insert into public.demo_scenarios(workspace_id,organization_id,canonical_version,scenario_at)
 values('e4000000-0000-4000-8000-000000000011','e4000000-0000-4000-8000-000000000010','synthetic-sync-test',now());
set role service_role;
do $$begin
 begin perform public.jira_sync_actor('e4000000-0000-4000-8000-000000000011','e4000000-0000-4000-8000-000000000022');raise exception 'TEST_DEMO_GRANTED';exception when others then if sqlerrm<>'DEMO_ORGANIZATION' then raise;end if;end;
 raise notice 'PASS: registered Demo refuses background connector grants';
end$$;
reset role;
