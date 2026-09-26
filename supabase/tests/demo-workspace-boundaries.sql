-- Fictional LOCAL database proof only. Extends platform-rbac.sql fixtures.
\set ON_ERROR_STOP on
do $$ begin if current_database() !~ '^prodwise_platform_preflight_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_PREFLIGHT_DATABASE_REQUIRED';end if;end $$;

insert into auth.users(id,email) values('d0000000-0000-4000-8000-000000000001','reviewer@demo.test');
insert into public.users(id,auth_user_id,email,display_name) values('d0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','reviewer@demo.test','Fictional reviewer');
insert into preflight.ids values('demo-user','d0000000-0000-4000-8000-000000000001');
set role service_role;
select public.platform_create_organization(preflight.id('platform'),'Fictional reviewer Demo',array['demo.test'],array[]::text[]);
reset role;
insert into preflight.ids select 'demo-org',id from public.organizations where name='Fictional reviewer Demo';
insert into preflight.ids select 'demo-workspace',id from public.workspaces where organization_id=preflight.id('demo-org');
set role service_role;
select public.platform_provision_membership(preflight.id('platform'),preflight.id('demo-org'),'reviewer@demo.test','ORG_OWNER',false,'Fictional reviewer organization owner only',repeat('6',64));
reset role;
insert into preflight.ids select 'demo-member',id from public.organization_memberships where organization_id=preflight.id('demo-org') and user_id=preflight.id('demo-user');
insert into public.workspaces(id,name,organization_id,status) values('d0000000-0000-4000-8000-000000000002','Fictional Demo generation 2',preflight.id('demo-org'),'ACTIVE');
insert into preflight.ids values('demo-workspace-2','d0000000-0000-4000-8000-000000000002');

-- Same synthetic route story may coexist with the seeded AMAN story and with
-- another generation. The UUIDs and server-selected workspace disambiguate it.
insert into public.initiatives(id,workspace_id,slug,name,business_line,is_demo) values
 ('d0000000-0000-4000-8000-000000000003',preflight.id('demo-workspace'),'merchant-flex-finance','Fictional Demo Merchant Flex Finance','MF',true),
 ('d0000000-0000-4000-8000-000000000004',preflight.id('demo-workspace-2'),'merchant-flex-finance','Fictional reset generation Merchant Flex Finance','MF',true);
insert into preflight.ids values('demo-initiative','d0000000-0000-4000-8000-000000000003'),('demo-initiative-2','d0000000-0000-4000-8000-000000000004');
select preflight.assert((select id='11111111-1111-4111-8111-111111111111'::uuid from public.initiatives where workspace_id='10000000-0000-4000-8000-000000000001' and slug='merchant-flex-finance'),'existing AMAN MFF row and ID preserved');
select preflight.assert((select id=preflight.id('demo-initiative') from public.initiatives where workspace_id=preflight.id('demo-workspace') and slug='merchant-flex-finance'),'workspace-scoped demo slug query resolves only its own UUID');
select preflight.assert((select id=preflight.id('demo-initiative-2') from public.initiatives where workspace_id=preflight.id('demo-workspace-2') and slug='merchant-flex-finance'),'new generation resolves its own UUID');
select preflight.refused(format('insert into public.initiatives(workspace_id,slug,name,business_line,is_demo) values(%L,''merchant-flex-finance'',''Forbidden duplicate in one workspace'',''MF'',true)',preflight.id('demo-workspace')),'duplicate key.*initiatives_workspace_slug_key');

-- Demo registration is operator-only persisted metadata. No display-name or
-- email heuristic confers synthetic status or changes authorization.
insert into public.demo_scenarios(workspace_id,organization_id,canonical_version,scenario_at) values(preflight.id('demo-workspace'),preflight.id('demo-org'),'fictional-preflight-v1','2026-09-26T09:00:00Z');
select preflight.refused(format('insert into public.demo_scenarios(workspace_id,organization_id,canonical_version,scenario_at) values(%L,%L,''forbidden-crossorg'',now())',preflight.id('workspace-b'),preflight.id('demo-org')),'foreign key.*demo_scenarios_workspace_organization');
set role service_role;
select preflight.assert((select canonical_version='fictional-preflight-v1' from public.demo_scenarios where workspace_id=preflight.id('demo-workspace')),'server reads explicit canonical scenario registration');
select preflight.refused(format('update public.demo_scenarios set canonical_version=''forbidden'' where workspace_id=%L',preflight.id('demo-workspace')),'permission denied');
select preflight.refused(format('delete from public.demo_scenarios where workspace_id=%L',preflight.id('demo-workspace')),'permission denied');
select preflight.assert(not has_table_privilege('service_role','public.demo_scenarios','INSERT'),'runtime service cannot register a demo scenario');
select preflight.assert((select platform_role is null from public.users where id=preflight.id('demo-user')),'reviewer has no global platform authority');
select preflight.assert((select count(*)=1 from public.organization_memberships where user_id=preflight.id('demo-user')),'reviewer membership belongs to demo organization only');
select preflight.assert((public.require_workspace_member(preflight.id('demo-workspace'),preflight.id('demo-member'),true,true)).role='ORG_OWNER','reviewer has full operational authority inside demo');
select preflight.refused(format('select public.require_workspace_member(%L,%L,false,false)','10000000-0000-4000-8000-000000000001',preflight.id('demo-member')),'ACCESS_DENIED');
select preflight.refused(format('select public.require_workspace_member(%L,%L,true,true)',preflight.id('workspace-b'),preflight.id('demo-member')),'ACCESS_DENIED');
select preflight.refused(format('select public.delivery_read_workspace(%L,%L)','10000000-0000-4000-8000-000000000001',preflight.id('demo-member')),'ACCESS_DENIED');
select preflight.refused(format('select public.delivery_commit_workspace(%L,%L,''{}''::jsonb,''{}''::jsonb,''{}''::jsonb)',preflight.id('workspace-b'),preflight.id('demo-member')),'ACCESS_DENIED');
select preflight.refused(format('select public.auth_business_rpc(%L,%L,''set_finding_note'',jsonb_build_object(''p_initiative_id'',''11111111-1111-4111-8111-111111111111'',''p_fingerprint'',''fictional'',''p_input'',''{}''::jsonb))',preflight.id('demo-workspace'),preflight.id('demo-member')),'ACCESS_DENIED');
select preflight.refused(format('select public.platform_configure_policy(%L,%L,array[''demo.test''],array[]::text[])',preflight.id('demo-user'),preflight.id('demo-org')),'PLATFORM_OWNER|PLATFORM_REQUIRED|ACCESS_DENIED');
select preflight.assert(jsonb_array_length(public.delivery_read_workspace(preflight.id('demo-workspace'),preflight.id('demo-member'))#>'{source,snapshots}')=1,'reviewer portfolio contains only demo workspace initiatives');

-- Source/knowledge FKs derive their parent workspace and reject cross-wiring.
insert into public.initiative_sources(id,workspace_id,initiative_id,name,source_type) values('d0000000-0000-4000-8000-000000000005',preflight.id('demo-workspace'),preflight.id('demo-initiative'),'Fictional demo evidence source','DOCUMENT');
insert into public.evidence(id,workspace_id,initiative_id,source_id,title,source_type,boundary) values('d0000000-0000-4000-8000-000000000006',preflight.id('demo-workspace'),preflight.id('demo-initiative'),'d0000000-0000-4000-8000-000000000005','Fictional demo requirement','DOCUMENT','CURRENT_SCOPE');
select preflight.refused(format('insert into public.evidence(workspace_id,initiative_id,title,source_type,boundary) values(%L,%L,''Forbidden parent workspace'',''DOCUMENT'',''CURRENT_SCOPE'')',preflight.id('demo-workspace'), '11111111-1111-4111-8111-111111111111'),'WORKSPACE_MISMATCH|foreign key');
select preflight.refused(format('insert into public.evidence(workspace_id,initiative_id,source_id,title,source_type,boundary) values(%L,%L,''aaaa0001-0000-4000-8000-000000000001'',''Forbidden source workspace'',''DOCUMENT'',''CURRENT_SCOPE'')',preflight.id('demo-workspace'),preflight.id('demo-initiative')),'foreign key.*evidence_source_workspace');
insert into public.claims(id,workspace_id,initiative_id,type,subject,attribute,value,domain) values('d0000000-0000-4000-8000-000000000007',preflight.id('demo-workspace'),preflight.id('demo-initiative'),'REQUIREMENT','Fictional demo','Repayment divisor','27','PRODUCT');
select preflight.refused(format('insert into public.claim_evidence(workspace_id,claim_id,evidence_id) values(%L,''d0000000-0000-4000-8000-000000000007'',''bbbb0001-0000-4000-8000-000000000002'')',preflight.id('demo-workspace')),'foreign key.*links_evidence_workspace');
select preflight.refused(format('insert into public.claims(workspace_id,initiative_id,type,subject,attribute,value,domain) values(%L,''11111111-1111-4111-8111-111111111111'',''REQUIREMENT'',''Forbidden'',''Scope'',''foreign'',''PRODUCT'')',preflight.id('demo-workspace')),'WORKSPACE_MISMATCH|foreign key');
-- Use a valid fictional fact shape but an independently mismatched parent.
select preflight.refused(format($q$insert into public.delivery_facts(id,workspace_id,initiative_id,kind,revision,value_text,data) select 'd0000000-0000-4000-8000-000000000099',%L,%L,'SCOPE',1,'Fictional crosswire',jsonb_build_object('id','d0000000-0000-4000-8000-000000000099','workspaceId',%L,'initiativeId',%L,'kind','SCOPE','revision',1,'value',jsonb_build_object('date',null,'text','Fictional crosswire','memberId',null),'state','SET','basis','DIRECT_KNOWLEDGE','note','Fictional boundary refusal','confirmedByUserId',%L,'updatedAt','2026-09-26T09:00:00Z')$q$,'10000000-0000-4000-8000-000000000001',preflight.id('demo-initiative'),'10000000-0000-4000-8000-000000000001',preflight.id('demo-initiative'),preflight.id('demo-user')),'foreign key.*delivery_facts_initiative_workspace');
reset role;

-- Test-only draft builder uses actual scoped SQL snapshots. Hash labels below
-- are fixture tokens, not claims of production digest equivalence or AI calls.
create function preflight.demo_review_next(p_workspace uuid,p_member uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare state jsonb; source jsonb; input jsonb; sections jsonb; review jsonb; actor uuid; at text; baseline uuid; begin
 state=public.delivery_state(p_workspace);source=public.delivery_camel(public.delivery_source(p_workspace));
 select user_id into actor from public.organization_memberships where id=p_member;
 at=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 select id into baseline from public.weekly_reviews where workspace_id=p_workspace and status='FINAL' and iso_week<to_char(clock_timestamp() at time zone 'Africa/Cairo','IYYY-"W"IW') order by iso_week desc limit 1;
 input=source||jsonb_build_object('workspaceId',p_workspace,'asOf',at,'digest','fictional-'||p_workspace::text,'facts',state->'facts','events',state->'events');
 select coalesce(jsonb_agg(jsonb_build_object('initiativeId',s#>>'{initiative,id}','ownerMemberId',null,'revision',1,'headline','','updates','','attention','','decisionNeeded','','nextMilestone','','nextStep','','sourceDigest','fictional-section','needsRecheck',false,'editedByMemberId',null,'editedAt',null,'aiOriginal',null)),'[]'::jsonb) into sections from jsonb_array_elements(source->'snapshots') s;
 review=jsonb_build_object('id',gen_random_uuid(),'workspaceId',p_workspace,'week',to_char(clock_timestamp() at time zone 'Africa/Cairo','IYYY-"W"IW'),'status','DRAFT','revision',1,'baselineReviewId',baseline,'input',input,'sections',sections,'aiDrafts','[]'::jsonb,'createdAt',at,'createdByMemberId',p_member,'createdByUserId',actor,'finalizedAt',null,'finalizedByMemberId',null,'finalizedByLabel',null);
 return state||jsonb_build_object('reviews',(state->'reviews')||jsonb_build_array(review));
end $$;
grant execute on function preflight.demo_review_next(uuid,uuid) to service_role;

-- Operator-only synthetic previous Final fixture, preserved through generation
-- reset. Finalized history is never edited/deleted to reset the demonstration.
insert into public.weekly_reviews(id,workspace_id,iso_week,status,revision,data)
select (r->>'id')::uuid,preflight.id('demo-workspace'),r->>'week','FINAL',1,r from (
 select ((preflight.demo_review_next(preflight.id('demo-workspace'),preflight.id('demo-member'))->'reviews')->-1)||jsonb_build_object('week',to_char((clock_timestamp()-interval '7 days') at time zone 'Africa/Cairo','IYYY-"W"IW'),'status','FINAL','finalizedAt','2026-09-26T09:00:00Z','finalizedByMemberId',preflight.id('demo-member'),'finalizedByUserId',preflight.id('demo-user'),'finalizedByLabel','Fictional previous reviewer') as r
) q;
insert into preflight.ids select 'demo-previous-final',id from public.weekly_reviews where workspace_id=preflight.id('demo-workspace') and status='FINAL';
create table preflight.demo_previous_final as select data from public.weekly_reviews where id=preflight.id('demo-previous-final');
set role service_role;
select preflight.refused(format('select public.delivery_commit_workspace(%L,%L,public.delivery_source(%L),public.delivery_state(%L),jsonb_set(preflight.demo_review_next(%L,%L),''{reviews,1,baselineReviewId}'',''"91000000-0000-4000-8000-000000000001"''::jsonb))',preflight.id('demo-workspace'),preflight.id('demo-member'),preflight.id('demo-workspace'),preflight.id('demo-workspace'),preflight.id('demo-workspace'),preflight.id('demo-member')),'STALE_BASELINE');
select preflight.refused(format('select public.delivery_commit_workspace(%L,%L,public.delivery_source(%L),public.delivery_state(%L),jsonb_set(preflight.demo_review_next(%L,%L),''{reviews,1,input,snapshots}'',public.delivery_camel(public.delivery_source(''10000000-0000-4000-8000-000000000001''))->''snapshots''))',preflight.id('demo-workspace'),preflight.id('demo-member'),preflight.id('demo-workspace'),preflight.id('demo-workspace'),preflight.id('demo-workspace'),preflight.id('demo-member')),'STALE_REVIEW_INPUT');
select public.delivery_commit_workspace(preflight.id('demo-workspace'),preflight.id('demo-member'),public.delivery_source(preflight.id('demo-workspace')),public.delivery_state(preflight.id('demo-workspace')),preflight.demo_review_next(preflight.id('demo-workspace'),preflight.id('demo-member')));
select preflight.assert(exists(select 1 from public.weekly_reviews where workspace_id=preflight.id('demo-workspace') and status='DRAFT' and data->>'baselineReviewId'=preflight.id('demo-previous-final')::text),'demo draft uses previous Final in the same workspace only');

-- Persisted AI history must belong to the frozen input digest. A provider call
-- is not made here; TEMPLATE is explicitly the synthetic SQL test transport.
reset role;
create function preflight.demo_ai_next(p_workspace uuid,p_wrong_digest boolean) returns jsonb language plpgsql security invoker set search_path='' as $$ declare state jsonb; draft jsonb; entry jsonb;begin
 state=public.delivery_state(p_workspace);select value into draft from jsonb_array_elements(state->'reviews') where value->>'status'='DRAFT';
 entry=jsonb_build_object('mode','TEMPLATE','model',null,'promptVersion','fictional-preflight','generatedAt','2026-09-26T09:00:00Z','inputDigest',case when p_wrong_digest then 'foreign-generation-digest' else draft#>>'{input,digest}' end,'original','[]'::jsonb,'reason','Synthetic SQL transport; no provider call');
 draft=draft||jsonb_build_object('revision',2,'aiDrafts',jsonb_build_array(entry));
 return state||jsonb_build_object('reviews',(select jsonb_agg(case when value->>'status'='DRAFT' then draft else value end) from jsonb_array_elements(state->'reviews')));
end $$;
grant execute on function preflight.demo_ai_next(uuid,boolean) to service_role;
set role service_role;
select preflight.refused(format('select public.delivery_commit_workspace(%L,%L,public.delivery_source(%L),public.delivery_state(%L),preflight.demo_ai_next(%L,true))',preflight.id('demo-workspace'),preflight.id('demo-member'),preflight.id('demo-workspace'),preflight.id('demo-workspace'),preflight.id('demo-workspace')),'AI_HISTORY');
select public.delivery_commit_workspace(preflight.id('demo-workspace'),preflight.id('demo-member'),public.delivery_source(preflight.id('demo-workspace')),public.delivery_state(preflight.id('demo-workspace')),preflight.demo_ai_next(preflight.id('demo-workspace'),false));
select public.delivery_commit_workspace(preflight.id('demo-workspace-2'),preflight.id('demo-member'),public.delivery_source(preflight.id('demo-workspace-2')),public.delivery_state(preflight.id('demo-workspace-2')),preflight.demo_review_next(preflight.id('demo-workspace-2'),preflight.id('demo-member')));
select preflight.assert(exists(select 1 from public.weekly_reviews where workspace_id=preflight.id('demo-workspace-2') and status='DRAFT' and data->>'baselineReviewId' is null and jsonb_array_length(data->'aiDrafts')=0),'new reset generation has no inherited Final baseline or AI history');
reset role;
insert into public.demo_scenarios(workspace_id,organization_id,canonical_version,scenario_at) values(preflight.id('demo-workspace-2'),preflight.id('demo-org'),'fictional-preflight-v2','2026-09-26T09:00:00Z');
select preflight.assert((select data from preflight.demo_previous_final)=(select data from public.weekly_reviews where id=preflight.id('demo-previous-final')),'new generation retains old Final byte-equivalent JSON');
select preflight.refused(format('delete from public.weekly_reviews where id=%L',preflight.id('demo-previous-final')),'FINAL_IMMUTABLE');
select preflight.refused(format('update public.weekly_reviews set revision=2 where id=%L',preflight.id('demo-previous-final')),'FINAL_IMMUTABLE');
select preflight.assert((select count(*)=2 from public.demo_scenarios where organization_id=preflight.id('demo-org')),'old and new canonical registrations coexist without deletion');
set role anon;
select preflight.refused('select * from public.demo_scenarios','permission denied');
reset role;
set role authenticated;
select preflight.refused('select * from public.demo_scenarios','permission denied');
reset role;
\echo 'PASS: workspace slugs, reviewer org isolation, source/fact composite FKs, operator-only demo registration, review/AI baseline scope, immutable retained reset history.'
