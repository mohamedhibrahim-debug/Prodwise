-- Run only through scripts/db-test/run-platform-preflight.ps1. All identities,
-- organizations and policy changes below are fictional disposable fixtures.
-- These tests exercise SQL permissions/transactions, not provider transport.
\set ON_ERROR_STOP on
do $$ begin
 if current_database() !~ '^prodwise_platform_preflight_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_PREFLIGHT_DATABASE_REQUIRED'; end if;
end $$;

create function preflight.assert(p_condition boolean,p_label text) returns void
language plpgsql security invoker set search_path='' as $$ begin
 if p_condition is distinct from true then raise exception 'PREFLIGHT_ASSERTION: %',p_label; end if;
end $$;
create function preflight.refused(p_statement text,p_expected_pattern text) returns void
language plpgsql security invoker set search_path='' as $$
declare denied boolean=false; begin
 begin execute p_statement;
 exception when others then
  if sqlerrm !~ p_expected_pattern then raise exception 'UNEXPECTED_REFUSAL: % (expected %)',sqlerrm,p_expected_pattern; end if;
  denied=true;
 end;
 if not denied then raise exception 'EXPECTED_REFUSAL_DID_NOT_OCCUR'; end if;
end $$;
grant usage on schema preflight to service_role,anon,authenticated;
grant execute on function preflight.assert(boolean,text),preflight.refused(text,text) to service_role,anon,authenticated;

select preflight.assert(
 (select data from preflight.historical_final) =
 (select data from public.weekly_reviews where id='91000000-0000-4000-8000-000000000001'),
 '0012 must preserve historical Final snapshot roles, labels, wording and hash as JSON');

-- Fail closed until the platform/org contract is present; no silently skipped
-- checks or fallback to the superseded single-Owner migration are permitted.
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='users' and column_name='platform_role') then
  raise exception 'PLATFORM_ORGANIZATION_MIGRATION_NOT_READY';
 end if;
end $$;

create table preflight.ids(key text primary key,id uuid not null);
create function preflight.id(p_key text) returns uuid language sql stable set search_path='' as $$ select id from preflight.ids where key=p_key; $$;
grant select on preflight.ids to service_role,anon,authenticated;
grant execute on function preflight.id(text) to service_role,anon,authenticated;

create function preflight.platform_fact_next(p_workspace_id uuid,p_actor_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare state jsonb; fact jsonb; event jsonb; label text; at text; begin
 select display_name into label from public.users where id=p_actor_id;
 at=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 state=public.delivery_state(p_workspace_id);
 fact=jsonb_build_object('id','c0000000-0000-4000-8000-000000000001','workspaceId',p_workspace_id,'initiativeId','c0000000-0000-4000-8000-000000000002','kind','SCOPE','revision',1,
  'value',jsonb_build_object('date',null,'text','Fictional preflight phase','memberId',null,'extent',null),'state','SET','basis','DIRECT_KNOWLEDGE','note','Explicit fictional platform confirmation',
  'evidenceId',null,'locator',null,'supportDigest',null,'confirmedByMemberId',null,'confirmedByUserId',p_actor_id,'confirmedByLabel',label,'updatedAt',at);
 event=jsonb_build_object('id','c0000000-0000-4000-8000-000000000003','workspaceId',p_workspace_id,'initiativeId','c0000000-0000-4000-8000-000000000002','occurredAt',at,'actor',jsonb_build_object('id',p_actor_id,'label',label),'before',null,'after',fact);
 return state||jsonb_build_object('facts',(state->'facts')||jsonb_build_array(fact),'events',(state->'events')||jsonb_build_array(event));
end $$;
grant execute on function preflight.platform_fact_next(uuid,uuid) to service_role;

create function preflight.platform_review_next(p_workspace_id uuid,p_actor_id uuid,p_transition text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare state jsonb; review jsonb; section jsonb; label text; at text; input jsonb; begin
 select display_name into label from public.users where id=p_actor_id;
 at=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 state=public.delivery_state(p_workspace_id);
 if p_transition='CREATE' then
  input=public.delivery_camel(public.delivery_source(p_workspace_id))||jsonb_build_object('workspaceId',p_workspace_id,'asOf',at,'digest','fictional-sql-actor-preflight','facts',state->'facts','events',state->'events');
  section=jsonb_build_object('initiativeId','c0000000-0000-4000-8000-000000000002','ownerMemberId',null,'revision',1,'headline','','updates','','attention','','decisionNeeded','','nextMilestone','','nextStep','','sourceDigest','fictional-sql-section-preflight','needsRecheck',false,'editedByMemberId',null,'editedAt',null,'aiOriginal',null);
  review=jsonb_build_object('id','c0000000-0000-4000-8000-000000000004','workspaceId',p_workspace_id,'week',to_char(clock_timestamp() at time zone 'Africa/Cairo','IYYY-"W"IW'),'status','DRAFT','revision',1,'baselineReviewId',null,'input',input,'sections',jsonb_build_array(section),'aiDrafts','[]'::jsonb,'createdAt',at,'createdByMemberId',null,'createdByUserId',p_actor_id,'finalizedAt',null,'finalizedByMemberId',null,'finalizedByLabel',null);
 elsif p_transition='SAVE' then
  review=state->'reviews'->0;
  section=review->'sections'->0||jsonb_build_object('revision',2,'headline','Fictional human-reviewed preflight','editedByMemberId',null,'editedByUserId',p_actor_id,'editedByLabel',label,'editedAt',at);
  review=review||jsonb_build_object('revision',2,'sections',jsonb_build_array(section));
 elsif p_transition='FINALIZE' then
  review=state->'reviews'->0||jsonb_build_object('status','FINAL','revision',3,'finalizedAt',at,'finalizedByMemberId',null,'finalizedByUserId',p_actor_id,'finalizedByLabel',label);
 else raise exception 'INVALID_PREFLIGHT_TRANSITION'; end if;
 return state||jsonb_build_object('reviews',jsonb_build_array(review));
end $$;
grant execute on function preflight.platform_review_next(uuid,uuid,text) to service_role;

-- Public identities are global; organization memberships and policy are not.
insert into auth.users(id,email) values
 ('a0000000-0000-4000-8000-000000000001','platform-one@platform.test'),
 ('a0000000-0000-4000-8000-000000000002','owner@alpha.test'),
 ('a0000000-0000-4000-8000-000000000003','owner@beta.test'),
 ('a0000000-0000-4000-8000-000000000004','admin@alpha.test'),
 ('a0000000-0000-4000-8000-000000000005','shared@alpha.test'),
 ('a0000000-0000-4000-8000-000000000006','viewer@alpha.test'),
 ('a0000000-0000-4000-8000-000000000007','next-owner@alpha.test'),
 ('a0000000-0000-4000-8000-000000000008','exact@outside.test'),
 ('a0000000-0000-4000-8000-000000000009','blocked@outside.test'),
 ('a0000000-0000-4000-8000-000000000010','platform-two@platform.test');
insert into public.users(id,auth_user_id,email,display_name)
select id,id,email,'Fictional '||split_part(email,'@',1) from auth.users;
insert into auth.users(id,email) values('a0000000-0000-4000-8000-000000000011','injected@platform.test');
insert into auth.users(id,email) values('a0000000-0000-4000-8000-000000000012','new-person@beta.test');
select public.bootstrap_platform_owner('a0000000-0000-4000-8000-000000000001');
insert into preflight.ids values
 ('platform','a0000000-0000-4000-8000-000000000001'),('owner-a','a0000000-0000-4000-8000-000000000002'),
 ('owner-b','a0000000-0000-4000-8000-000000000003'),('admin','a0000000-0000-4000-8000-000000000004'),
 ('shared','a0000000-0000-4000-8000-000000000005'),('viewer','a0000000-0000-4000-8000-000000000006'),
 ('next-owner','a0000000-0000-4000-8000-000000000007'),('exact','a0000000-0000-4000-8000-000000000008'),
 ('blocked','a0000000-0000-4000-8000-000000000009'),('platform-two','a0000000-0000-4000-8000-000000000010');

set role service_role;
select public.platform_create_organization(preflight.id('platform'),'Fictional Alpha preflight',array['alpha.test'],array['exact@outside.test']);
select public.platform_create_organization(preflight.id('platform'),'Fictional Beta preflight',array['beta.test'],array[]::text[]);
reset role;
insert into preflight.ids select 'org-a',id from public.organizations where name='Fictional Alpha preflight';
insert into preflight.ids select 'org-b',id from public.organizations where name='Fictional Beta preflight';
-- Workspace fixtures provide a context for compatibility APIs. Their policy is
-- resolved from organization_id, never copied to a user or workspace role.
insert into public.workspaces(id,name,organization_id,status) values
 ('b0000000-0000-4000-8000-000000000001','Alpha test workspace',preflight.id('org-a'),'BOOTSTRAPPING'),
 ('b0000000-0000-4000-8000-000000000002','Beta test workspace',preflight.id('org-b'),'BOOTSTRAPPING'),
 ('b0000000-0000-4000-8000-000000000003','Alpha second test workspace',preflight.id('org-a'),'BOOTSTRAPPING');
insert into preflight.ids values ('workspace-a','b0000000-0000-4000-8000-000000000001'),('workspace-b','b0000000-0000-4000-8000-000000000002'),('workspace-a2','b0000000-0000-4000-8000-000000000003');

set role service_role;
select public.platform_provision_membership(preflight.id('platform'),preflight.id('org-a'),'owner@alpha.test','ORG_OWNER',false,'Fictional scoped membership provisioning',repeat('a',64));
select public.platform_provision_membership(preflight.id('platform'),preflight.id('org-b'),'owner@beta.test','ORG_OWNER',false,'Fictional scoped membership provisioning',repeat('b',64));
select public.platform_provision_membership(preflight.id('platform'),preflight.id('org-a'),'admin@alpha.test','ADMIN',false,'Fictional scoped membership provisioning',repeat('c',64));
select public.platform_provision_membership(preflight.id('platform'),preflight.id('org-a'),'shared@alpha.test','MEMBER',false,'Fictional scoped membership provisioning',repeat('d',64));
select public.platform_provision_membership(preflight.id('platform'),preflight.id('org-a'),'viewer@alpha.test','VIEWER',false,'Fictional scoped membership provisioning',repeat('e',64));
select public.platform_provision_membership(preflight.id('platform'),preflight.id('org-a'),'next-owner@alpha.test','MEMBER',false,'Fictional scoped membership provisioning',repeat('f',64));
select public.platform_provision_membership(preflight.id('platform'),preflight.id('org-a'),'exact@outside.test','MEMBER',false,'Fictional scoped membership provisioning',repeat('1',64));
reset role;
-- Policy/owner fixtures are complete before activation; deferred constraints
-- must also hold immediately, rather than being hidden by transaction cleanup.
begin;
update public.organizations set status='ACTIVE' where id in (preflight.id('org-a'),preflight.id('org-b'));
update public.workspaces set status='ACTIVE' where id in (preflight.id('workspace-a'),preflight.id('workspace-b'),preflight.id('workspace-a2'));
set constraints all immediate;
commit;
insert into preflight.ids
select 'member-'||x.key,m.id from preflight.ids x join public.organization_memberships m on m.user_id=x.id
where x.key in ('owner-a','admin','shared','viewer','next-owner','exact') and m.organization_id=preflight.id('org-a');
insert into preflight.ids select 'member-owner-b',id from public.organization_memberships where user_id=preflight.id('owner-b') and organization_id=preflight.id('org-b');
insert into public.initiatives(id,name,slug,workspace_id,is_demo,business_line) values('c0000000-0000-4000-8000-000000000002','Fictional platform delivery audit','fictional-platform-delivery-audit',preflight.id('workspace-a'),true,'MF');

set role service_role;
select preflight.assert(public.workspace_email_allowed(preflight.id('workspace-a'),'PM@ALPHA.TEST'),'exact domain comparison is case-normalized');
select preflight.assert(not public.workspace_email_allowed(preflight.id('workspace-a'),'pm@fakealpha.test'),'domain suffix lookalike denied');
select preflight.assert(not public.workspace_email_allowed(preflight.id('workspace-a'),'pm@sub.alpha.test'),'unapproved subdomain denied');
select preflight.assert(public.workspace_email_allowed(preflight.id('workspace-a'),'exact@outside.test'),'exact account exception belongs to Alpha');
select preflight.assert(not public.workspace_email_allowed(preflight.id('workspace-b'),'exact@outside.test'),'exact account exception does not leak into Beta');
select preflight.assert(not public.workspace_email_allowed(preflight.id('workspace-b'),'shared@alpha.test'),'Alpha domain is not implicitly allowed in Beta');
select preflight.assert((public.require_workspace_member(preflight.id('workspace-a'),preflight.id('member-owner-a'),true,true)).role='ORG_OWNER','organization owner context');
select preflight.assert((public.require_workspace_member(preflight.id('workspace-a'),preflight.id('member-admin'),true,true)).role='ADMIN','organization Admin context');
select preflight.assert((public.require_workspace_member(preflight.id('workspace-a2'),preflight.id('member-admin'),true,true)).id=preflight.id('member-admin'),'one organization membership applies to both of its workspaces');
select preflight.assert((public.require_workspace_member(preflight.id('workspace-a'),preflight.id('member-shared'),false,true)).role='MEMBER','organization Member context');
select preflight.assert((public.require_workspace_member(preflight.id('workspace-a'),preflight.id('member-viewer'),false,false)).role='VIEWER','organization Viewer reads');
select preflight.refused(format('select public.require_workspace_member(%L,%L,false,true)',preflight.id('workspace-a'),preflight.id('member-viewer')),'VIEW_ONLY|WRITE_ACCESS');
select preflight.refused(format('select public.require_workspace_member(%L,%L,true,false)',preflight.id('workspace-a'),preflight.id('member-shared')),'ADMIN_REQUIRED|ACCESS_DENIED');
select preflight.refused(format('select public.require_workspace_member(%L,%L,false,false)',preflight.id('workspace-b'),preflight.id('member-admin')),'ACCESS_DENIED');

-- A platform actor enters either organization without manufacturing a role or
-- membership. Global privilege is not copied onto every organization record.
select preflight.assert((select count(*)=0 from public.organization_memberships where user_id=preflight.id('platform')),'platform actor has no organization membership');
select preflight.assert((public.require_workspace_member(preflight.id('workspace-a'),preflight.id('platform'),true,true)).user_id=preflight.id('platform'),'platform actor entry derives actual global identity');
select preflight.assert((public.require_workspace_member(preflight.id('workspace-b'),preflight.id('platform'),true,true)).id is null,'platform actor entry does not invent membership id');
select preflight.assert((public.require_workspace_member(preflight.id('workspace-b'),preflight.id('platform'),true,true)).role is null,'platform actor entry does not invent organization role');
-- Null membership is not an anonymous audit actor. The hardened Delivery RPC
-- must bind the actual global user on the fact and embedded activity event.
select preflight.refused(format('select public.delivery_commit_workspace(%L,%L,public.delivery_source(%L),public.delivery_state(%L),jsonb_set(preflight.platform_fact_next(%L,%L),''{facts,0,confirmedByUserId}'',to_jsonb(%L::text)))',preflight.id('workspace-a'),preflight.id('platform'),preflight.id('workspace-a'),preflight.id('workspace-a'),preflight.id('workspace-a'),preflight.id('platform'),preflight.id('admin')),'FACT_REVISION|FACT_ACTOR');
select preflight.refused(format('select public.delivery_commit_workspace(%L,%L,public.delivery_source(%L),public.delivery_state(%L),jsonb_set(preflight.platform_fact_next(%L,%L),''{events,0,actor,id}'',to_jsonb(%L::text)))',preflight.id('workspace-a'),preflight.id('platform'),preflight.id('workspace-a'),preflight.id('workspace-a'),preflight.id('workspace-a'),preflight.id('platform'),preflight.id('admin')),'EVENT_ACTOR');
select preflight.assert(not exists(select 1 from public.delivery_facts where workspace_id=preflight.id('workspace-a')),'forged global actor refusals roll back all fact writes');
select public.delivery_commit_workspace(preflight.id('workspace-a'),preflight.id('platform'),public.delivery_source(preflight.id('workspace-a')),public.delivery_state(preflight.id('workspace-a')),preflight.platform_fact_next(preflight.id('workspace-a'),preflight.id('platform')));
select preflight.assert(exists(select 1 from public.delivery_facts where workspace_id=preflight.id('workspace-a') and data->>'confirmedByMemberId' is null and data->>'confirmedByUserId'=preflight.id('platform')::text),'platform confirmation keeps nullable membership and real global user');
select preflight.assert(exists(select 1 from public.activity_log where initiative_id='c0000000-0000-4000-8000-000000000002' and actor_id=preflight.id('platform') and payload#>>'{deliveryEvent,actor,id}'=preflight.id('platform')::text),'outer and inner delivery activity retain the real platform actor');
select preflight.refused(format('select public.delivery_commit_workspace(%L,%L,public.delivery_source(%L),public.delivery_state(%L),jsonb_set(preflight.platform_review_next(%L,%L,''CREATE''),''{reviews,0,createdByUserId}'',to_jsonb(%L::text)))',preflight.id('workspace-a'),preflight.id('platform'),preflight.id('workspace-a'),preflight.id('workspace-a'),preflight.id('workspace-a'),preflight.id('platform'),preflight.id('admin')),'DRAFT_CREATOR');
select public.delivery_commit_workspace(preflight.id('workspace-a'),preflight.id('platform'),public.delivery_source(preflight.id('workspace-a')),public.delivery_state(preflight.id('workspace-a')),preflight.platform_review_next(preflight.id('workspace-a'),preflight.id('platform'),'CREATE'));
select preflight.refused(format('select public.delivery_commit_workspace(%L,%L,public.delivery_source(%L),public.delivery_state(%L),jsonb_set(preflight.platform_review_next(%L,%L,''SAVE''),''{reviews,0,sections,0,editedByUserId}'',to_jsonb(%L::text)))',preflight.id('workspace-a'),preflight.id('platform'),preflight.id('workspace-a'),preflight.id('workspace-a'),preflight.id('workspace-a'),preflight.id('platform'),preflight.id('admin')),'SECTION_REVIEW_ACTOR');
select public.delivery_commit_workspace(preflight.id('workspace-a'),preflight.id('platform'),public.delivery_source(preflight.id('workspace-a')),public.delivery_state(preflight.id('workspace-a')),preflight.platform_review_next(preflight.id('workspace-a'),preflight.id('platform'),'SAVE'));
select preflight.refused(format('select public.delivery_commit_workspace(%L,%L,public.delivery_source(%L),public.delivery_state(%L),jsonb_set(preflight.platform_review_next(%L,%L,''FINALIZE''),''{reviews,0,finalizedByUserId}'',to_jsonb(%L::text)))',preflight.id('workspace-a'),preflight.id('platform'),preflight.id('workspace-a'),preflight.id('workspace-a'),preflight.id('workspace-a'),preflight.id('platform'),preflight.id('admin')),'FINAL_ACTOR');
select public.delivery_commit_workspace(preflight.id('workspace-a'),preflight.id('platform'),public.delivery_source(preflight.id('workspace-a')),public.delivery_state(preflight.id('workspace-a')),preflight.platform_review_next(preflight.id('workspace-a'),preflight.id('platform'),'FINALIZE'));
select preflight.assert(exists(select 1 from public.weekly_reviews where id='c0000000-0000-4000-8000-000000000004' and status='FINAL' and data->>'createdByMemberId' is null and data->>'createdByUserId'=preflight.id('platform')::text and data->>'finalizedByMemberId' is null and data->>'finalizedByUserId'=preflight.id('platform')::text and data#>>'{sections,0,editedByUserId}'=preflight.id('platform')::text),'platform creates, reviews and finalizes with real global user and no invented membership');

-- Ordinary invitation/membership paths never silently bypass organization policy.
select preflight.refused(format('select public.manage_workspace_invitation(%L,%L,%L,null,%L,%L,%L)',preflight.id('workspace-a'),preflight.id('member-owner-a'),'INVITE','blocked@outside.test','MEMBER',repeat('2',64)),'EMAIL_NOT_ALLOWED');
select preflight.refused(format('select public.manage_workspace_invitation(%L,%L,%L,null,%L,%L,%L)',preflight.id('workspace-a'),preflight.id('platform'),'INVITE','blocked@outside.test','MEMBER',repeat('3',64)),'EMAIL_NOT_ALLOWED');
select preflight.refused(format('select public.platform_provision_membership(%L,%L,%L,%L,false,''Fictional denied nonoverride membership'',%L)',preflight.id('platform'),preflight.id('org-b'),'blocked@outside.test','MEMBER',repeat('4',64)),'EMAIL_NOT_ALLOWED');
select preflight.refused(format('select public.platform_provision_membership(%L,%L,%L,%L,true,%L,%L)',preflight.id('platform'),preflight.id('org-b'),'blocked@outside.test','MEMBER','',repeat('5',64)),'REASON|OVERRIDE|INVALID_MEMBERSHIP');
select preflight.refused(format('select public.platform_provision_membership(%L,%L,%L,%L,true,%L,%L)',preflight.id('owner-a'),preflight.id('org-b'),'blocked@outside.test','MEMBER','Cannot override as org owner',repeat('6',64)),'PLATFORM_OWNER|PLATFORM_REQUIRED|ACCESS_DENIED');
select public.platform_provision_membership(preflight.id('platform'),preflight.id('org-b'),'blocked@outside.test','MEMBER',true,'Fictional explicit Beta policy exception',repeat('7',64));
select preflight.assert(exists(select 1 from public.organization_memberships where organization_id=preflight.id('org-b') and user_id=preflight.id('blocked') and policy_override and policy_override_reason='Fictional explicit Beta policy exception'),'explicit override persisted only on Beta membership');
select preflight.assert(exists(select 1 from public.platform_events where organization_id=preflight.id('org-b') and actor_id=preflight.id('platform') and policy_overridden and reason='Fictional explicit Beta policy exception'),'explicit override audit has actual actor, target organization and reason');
select preflight.assert(not exists(select 1 from public.organization_memberships where organization_id=preflight.id('org-a') and user_id=preflight.id('blocked')),'override does not create access to Alpha');

-- Reuse an existing global identity with independent roles and scoped override.
select public.platform_provision_membership(preflight.id('platform'),preflight.id('org-b'),'shared@alpha.test','VIEWER',true,'Fictional shared identity assigned Beta Viewer',repeat('8',64));
select preflight.assert((select count(*)=1 from public.users where email='shared@alpha.test'),'one global identity remains after second organization provision');
select preflight.assert((select display_name='Fictional shared' from public.users where id=preflight.id('shared')),'provision does not reset global display profile');
select preflight.assert(exists(select 1 from public.organization_memberships where user_id=preflight.id('shared') and organization_id=preflight.id('org-a') and role='MEMBER'),'Alpha role remains Member');
select preflight.assert(exists(select 1 from public.organization_memberships where user_id=preflight.id('shared') and organization_id=preflight.id('org-b') and role='VIEWER'),'Beta role independently Viewer');

-- Policy configuration is global-platform authority, independently audited.
select preflight.refused(format('select public.platform_configure_policy(%L,%L,array[%L],array[]::text[])',preflight.id('owner-a'),preflight.id('org-a'),'alpha.test'),'PLATFORM_OWNER|PLATFORM_REQUIRED|ACCESS_DENIED');
select public.platform_configure_policy(preflight.id('platform'),preflight.id('org-b'),array['beta.test','alpha.test'],array[]::text[]);
select preflight.assert(public.workspace_email_allowed(preflight.id('workspace-b'),'shared@alpha.test'),'platform policy update affects selected organization');
select preflight.assert(not public.workspace_email_allowed(preflight.id('workspace-a'),'owner@beta.test'),'Beta policy update does not affect Alpha');
select preflight.assert((select allowed_email_domains=array['alpha.test'] from public.organizations where id=preflight.id('org-a')),'Alpha stored domain policy is preserved');
select preflight.refused(format('select public.manage_workspace_invitation(%L,%L,%L,null,%L,%L,%L)',preflight.id('workspace-a'),preflight.id('member-shared'),'INVITE','new-person@alpha.test','MEMBER',repeat('b',64)),'ADMIN_REQUIRED|ACCESS_DENIED');
select public.manage_workspace_invitation(preflight.id('workspace-b'),preflight.id('member-owner-b'),'INVITE',null,'new-person@beta.test','MEMBER',repeat('c',64));
select public.accept_workspace_invitation(preflight.id('workspace-b'),repeat('c',64),'a0000000-0000-4000-8000-000000000012','Fictional new person');
select preflight.assert(exists(select 1 from public.organization_memberships m join public.users u on u.id=m.user_id where m.organization_id=preflight.id('org-b') and u.email='new-person@beta.test' and m.role='MEMBER' and m.active),'allowed normal invitation creates scoped membership');
select public.manage_workspace_invitation(preflight.id('workspace-b'),preflight.id('member-owner-b'),'INVITE',null,'viewer@alpha.test','MEMBER',repeat('d',64));
select public.accept_workspace_invitation(preflight.id('workspace-b'),repeat('d',64),'a0000000-0000-4000-8000-000000000006','Should not replace the existing global profile');
select preflight.assert((select count(*)=1 from public.users where email='viewer@alpha.test'),'normal invitation acceptance reuses global identity');
select preflight.assert((select display_name='Fictional viewer' from public.users where id=preflight.id('viewer')),'existing global profile is preserved during second organization acceptance');

-- Platform-origin invitations use their own audited resend/revoke authority.
select public.platform_provision_membership(preflight.id('platform'),preflight.id('org-b'),'pending@beta.test','MEMBER',false,'Fictional pending platform invitation',repeat('1',64));
reset role;
insert into preflight.ids select 'platform-invitation',id from public.workspace_invitations where email='pending@beta.test' and organization_id=preflight.id('org-b');
set role service_role;
select preflight.refused(format('select public.platform_rotate_invitation(%L,%L,false,%L,%L)',preflight.id('owner-b'),preflight.id('platform-invitation'),repeat('2',64),'Forbidden normal owner platform resend'),'PLATFORM_OWNER|PLATFORM_REQUIRED|ACCESS_DENIED');
select preflight.refused(format('select public.manage_workspace_invitation(%L,%L,%L,%L,null,null,%L)',(select workspace_id from public.workspace_invitations where id=preflight.id('platform-invitation')),preflight.id('member-owner-b'),'RESEND',preflight.id('platform-invitation'),repeat('2',64)),'INVITE_INVALID');
select public.platform_rotate_invitation(preflight.id('platform'),preflight.id('platform-invitation'),false,repeat('2',64),'Fictional dedicated platform resend');
select preflight.refused(format('select public.inspect_workspace_invitation(null,%L)',repeat('1',64)),'INVITE_INVALID');
select preflight.assert(public.inspect_workspace_invitation(null,repeat('2',64))->>'email'='pending@beta.test','dedicated resend replaces old link with a valid new link');
select preflight.assert(exists(select 1 from public.platform_events where actor_id=preflight.id('platform') and organization_id=preflight.id('org-b') and target_id=preflight.id('platform-invitation')::text and reason='Fictional dedicated platform resend'),'resend audit binds actual platform actor, invitation, org and reason');
select public.platform_configure_policy(preflight.id('platform'),preflight.id('org-b'),array['alpha.test'],array[]::text[]);
select preflight.refused(format('select public.platform_rotate_invitation(%L,%L,false,%L,%L)',preflight.id('platform'),preflight.id('platform-invitation'),repeat('3',64),'Fictional denied resend after policy change'),'EMAIL_NOT_ALLOWED');
select preflight.assert((select token_hash=repeat('2',64) from public.workspace_invitations where id=preflight.id('platform-invitation')),'denied resend preserves previous token atomically');
select public.platform_configure_policy(preflight.id('platform'),preflight.id('org-b'),array['beta.test','alpha.test'],array[]::text[]);
select public.platform_rotate_invitation(preflight.id('platform'),preflight.id('platform-invitation'),true,null,'Fictional dedicated platform revoke');
select preflight.refused(format('select public.inspect_workspace_invitation(null,%L)',repeat('2',64)),'INVITE_INVALID');
select preflight.refused(format('select public.platform_rotate_invitation(%L,%L,false,%L,%L)',preflight.id('platform'),preflight.id('platform-invitation'),repeat('3',64),'Forbidden resend after revoke'),'INVITE_INVALID');
select public.platform_provision_membership(preflight.id('platform'),preflight.id('org-b'),'pending-override@outside.test','MEMBER',true,'Fictional stored override rationale',repeat('4',64));
reset role;
insert into preflight.ids select 'override-invitation',id from public.workspace_invitations where email='pending-override@outside.test' and organization_id=preflight.id('org-b');
set role service_role;
select public.platform_rotate_invitation(preflight.id('platform'),preflight.id('override-invitation'),false,repeat('5',64),'Fictional override invitation resend');
select preflight.assert((select policy_override and policy_override_reason='Fictional stored override rationale' from public.workspace_invitations where id=preflight.id('override-invitation')),'resend preserves explicit stored override rationale');
select preflight.assert(public.inspect_workspace_invitation(null,repeat('5',64))->>'email'='pending-override@outside.test','explicit override remains valid on dedicated resend');

-- Global platform privilege is neither an organization role nor an invitation.
select preflight.refused(format('select public.grant_platform_owner(%L,%L,%L)',preflight.id('owner-a'),preflight.id('shared'),'Forbidden global escalation'),'PLATFORM_OWNER|PLATFORM_REQUIRED|ACCESS_DENIED');
select preflight.refused(format('select public.bootstrap_platform_owner(%L)',preflight.id('shared')),'permission denied');
select preflight.refused(format('update public.users set platform_role=%L where id=%L','PLATFORM_OWNER',preflight.id('shared')),'PLATFORM|PROTECTED|permission denied');
select preflight.refused('insert into public.users(id,auth_user_id,email,display_name,platform_role) values(''a0000000-0000-4000-8000-000000000011'',''a0000000-0000-4000-8000-000000000011'',''injected@platform.test'',''Forbidden injected global role'',''PLATFORM_OWNER'')','PLATFORM|PROTECTED|permission denied');
select preflight.refused(format('select public.change_workspace_membership(%L,%L,%L,%L,true,false)',preflight.id('workspace-a'),preflight.id('member-owner-a'),preflight.id('member-shared'),'PLATFORM_OWNER'),'INVALID|ROLE');
select public.platform_configure_policy(preflight.id('platform'),preflight.id('org-a'),array['alpha.test','platform.test'],array['exact@outside.test']);
select public.manage_workspace_invitation(preflight.id('workspace-a'),preflight.id('member-owner-a'),'INVITE',null,'platform-two@platform.test','MEMBER',repeat('f',64));
select public.grant_platform_owner(preflight.id('platform'),preflight.id('platform-two'),'Fictional second global platform owner');
select preflight.assert((select platform_role='PLATFORM_OWNER' from public.users where id=preflight.id('platform-two')),'explicit platform grant creates second global authority');
select preflight.refused(format('select public.manage_workspace_invitation(%L,%L,%L,null,%L,%L,%L)',preflight.id('workspace-a'),preflight.id('member-owner-a'),'INVITE','platform-two@platform.test','MEMBER',repeat('f',64)),'PLATFORM_IDENTITY_PROTECTED');
select preflight.refused(format('select public.inspect_workspace_invitation(%L,%L)',preflight.id('workspace-a'),repeat('f',64)),'PLATFORM_IDENTITY_PROTECTED');
select public.platform_configure_policy(preflight.id('platform'),preflight.id('org-a'),array['alpha.test'],array['exact@outside.test']);
select preflight.assert(exists(select 1 from public.platform_events where actor_id=preflight.id('platform')),'global actions have actual actor audit');

-- Additional organization owners are allowed; minimum one remains required.
select public.platform_provision_membership(preflight.id('platform'),preflight.id('org-a'),'next-owner@alpha.test','ORG_OWNER',false,'Fictional scoped membership provisioning',repeat('9',64));
select preflight.assert((select count(*)=2 from public.organization_memberships where organization_id=preflight.id('org-a') and role='ORG_OWNER' and active),'multiple active organization owners accepted');
select preflight.refused(format('select public.platform_replace_org_owner(%L,%L,%L,%L)',preflight.id('platform'),preflight.id('org-a'),'a0000000-0000-4000-8000-000000000099','Invalid replacement must roll back'),'ACCESS|TARGET|MEMBER|OWNER');
select preflight.assert((select count(*)=2 from public.organization_memberships where organization_id=preflight.id('org-a') and role='ORG_OWNER' and active),'invalid replacement leaves original owner set intact');
select public.platform_replace_org_owner(preflight.id('platform'),preflight.id('org-a'),preflight.id('next-owner'),'Fictional atomic owner replacement');
select preflight.assert((select count(*)=1 from public.organization_memberships where organization_id=preflight.id('org-a') and role='ORG_OWNER' and active),'atomic replacement leaves one active owner');
select preflight.assert(exists(select 1 from public.organization_memberships where organization_id=preflight.id('org-a') and user_id=preflight.id('next-owner') and role='ORG_OWNER' and active),'replacement promotes actual existing member');
select preflight.assert(exists(select 1 from public.organization_memberships where organization_id=preflight.id('org-a') and user_id=preflight.id('owner-a') and role='ADMIN'),'replacement demotes previous owners to Admin');
select preflight.assert((select count(*)=1 from public.organization_memberships where organization_id=preflight.id('org-b') and role='ORG_OWNER' and active),'replacement does not affect another organization');
reset role;
-- Test the deferred database backstop directly under operator privileges, not
-- only an application refusal. The exception subtransaction rolls it back.
select preflight.refused(format('update public.organization_memberships set active=false where organization_id=%L and role=%L; set constraints all immediate',preflight.id('org-a'),'ORG_OWNER'),'OWNER_INVARIANT|ORG_OWNER_REQUIRED|LAST_OWNER|LAST_ORG_OWNER');
select preflight.assert((select count(*)=1 from public.organization_memberships where organization_id=preflight.id('org-a') and role='ORG_OWNER' and active),'minimum-owner refusal is atomic');

-- Independent global and organization roles can coexist without collapsing
-- into one role field. This is separate from no-membership platform entry.
set role service_role;
select public.platform_provision_membership(preflight.id('platform'),preflight.id('org-a'),'platform-one@platform.test','ORG_OWNER',true,'Fictional platform identity explicitly becomes Alpha owner',repeat('0',64));
select public.platform_provision_membership(preflight.id('platform'),preflight.id('org-a'),'platform-two@platform.test','ORG_OWNER',true,'Fictional second platform identity explicitly becomes Alpha owner',repeat('a',64));
select preflight.assert((select count(*)=2 from public.users u join public.organization_memberships m on m.user_id=u.id where u.id in (preflight.id('platform'),preflight.id('platform-two')) and u.platform_role='PLATFORM_OWNER' and m.organization_id=preflight.id('org-a') and m.role='ORG_OWNER' and m.active),'both global platform owners can independently be owners of the same organization');
reset role;
update public.users set active=false where id=preflight.id('platform-two');
set role service_role;
select preflight.refused(format('select public.platform_configure_policy(%L,%L,array[%L],array[]::text[])',preflight.id('platform-two'),preflight.id('org-a'),'alpha.test'),'PLATFORM_OWNER|PLATFORM_REQUIRED|ACCESS_DENIED|INACTIVE');
reset role;
update public.users set active=true where id=preflight.id('platform-two');

-- A dedicated two-owner organization is reserved for the runner's overlapping
-- transactions. Its identities and policy are fictional and independent.
set role service_role;
select public.platform_create_organization(preflight.id('platform'),'Fictional concurrent owners preflight',array['alpha.test'],array[]::text[]);
reset role;
insert into preflight.ids select 'org-race',id from public.organizations where name='Fictional concurrent owners preflight';
set role service_role;
select public.platform_provision_membership(preflight.id('platform'),preflight.id('org-race'),'owner@alpha.test','ORG_OWNER',false,'Fictional concurrency owner A',repeat('e',64));
select public.platform_provision_membership(preflight.id('platform'),preflight.id('org-race'),'next-owner@alpha.test','ORG_OWNER',false,'Fictional concurrency owner B',repeat('f',64));
select preflight.assert((select count(*)=2 from public.organization_memberships where organization_id=preflight.id('org-race') and role='ORG_OWNER' and active),'concurrent downgrade fixture begins with exactly two owners');
reset role;

-- Public roles have neither business reads nor platform mutation entry points.
set role anon;
select preflight.refused('select * from public.organizations','permission denied');
select preflight.refused('select * from public.organization_memberships','permission denied');
select preflight.refused(format('select public.platform_create_organization(%L,%L,array[%L],array[]::text[])',preflight.id('platform'),'Forbidden public org','evil.test'),'permission denied');
reset role;
set role authenticated;
select preflight.refused('select * from public.organization_memberships','permission denied');
select preflight.refused(format('select public.require_workspace_member(%L,%L,false,false)',preflight.id('workspace-a'),preflight.id('platform')),'permission denied');
reset role;
select preflight.assert((select data from preflight.historical_final)=(select data from public.weekly_reviews where id='91000000-0000-4000-8000-000000000001'),'historical Final remains unchanged after all platform/org operations');
select preflight.assert(not has_function_privilege('authenticated','public.platform_configure_policy(uuid,uuid,text[],text[])','EXECUTE'),'public platform policy API remains closed');
select preflight.assert(not has_function_privilege('authenticated','public.platform_rotate_invitation(uuid,uuid,boolean,text,text)','EXECUTE'),'public platform invitation rotation API remains closed');
select preflight.assert(not has_function_privilege('service_role','public.bootstrap_platform_owner(uuid)','EXECUTE'),'trusted operator bootstrap is unavailable to service_role');
\echo 'PASS: organization role/policy isolation, no-membership platform entry, audited explicit overrides, identity reuse, protected global privilege, multiple owners, atomic replacement/minimum and public denial.'
