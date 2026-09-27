-- Disposable local database only. No provider calls or real organization rows.
\set ON_ERROR_STOP on
do $$ begin if current_database() !~ '^prodwise_platform_preflight_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_PREFLIGHT_DATABASE_REQUIRED';end if;end $$;
begin;
select preflight.assert(not has_table_privilege('anon','public.metric_definitions','SELECT'),'metrics deny anonymous reads');
select preflight.assert(not has_table_privilege('authenticated','public.metric_observations','SELECT'),'metrics deny direct authenticated reads');
select preflight.assert(not has_table_privilege('service_role','public.metric_definitions','INSERT'),'runtime cannot seed metrics');
select preflight.assert(not has_table_privilege('service_role','public.metric_observations','UPDATE'),'runtime cannot rewrite observations');
select preflight.assert(not has_function_privilege('anon','public.switch_workspace_session(text,text,uuid,uuid,uuid)','EXECUTE'),'switch is server-only');
select preflight.assert(not has_function_privilege('authenticated','public.update_initiative_stage(uuid,uuid,uuid,public.initiative_stage,timestamptz,text)','EXECUTE'),'stage is server-only');
set role service_role;
select preflight.assert(jsonb_array_length(public.list_authorized_contexts(preflight.id('platform'),preflight.id('workspace-a')))>=3,'persisted platform owner has every active context without memberships');
select preflight.assert(not exists(select 1 from jsonb_array_elements(public.list_authorized_contexts(preflight.id('admin'),preflight.id('workspace-a'))) x where x->>'organizationId'=preflight.id('org-b')::text),'organization administrator cannot discover foreign context');
select preflight.assert(exists(select 1 from jsonb_array_elements(public.list_authorized_contexts(preflight.id('admin'),preflight.id('workspace-a'))) x where x->>'workspaceId'=preflight.id('workspace-a2')::text),'normal member can discover authorized context');
reset role;
insert into public.workspace_sessions(token_hash,workspace_id,organization_id,user_id,auth_user_id,access_token,refresh_token,expires_at)
values(repeat('9',64),preflight.id('workspace-a'),preflight.id('org-a'),preflight.id('admin'),preflight.id('admin'),'fictional-provider-test','fictional-refresh-test',now()+interval '1 hour');
set role service_role;
select preflight.refused(format('select public.switch_workspace_session(%L,%L,%L,%L,%L)',repeat('9',64),repeat('0',64),preflight.id('workspace-a'),preflight.id('workspace-b'),preflight.id('admin')),'ACCESS_DENIED');
select preflight.assert(exists(select 1 from public.workspace_sessions where token_hash=repeat('9',64)),'failed switch preserves original session');
select preflight.assert(public.switch_workspace_session(repeat('9',64),repeat('0',64),preflight.id('workspace-a'),preflight.id('workspace-a2'),preflight.id('admin'))>0,'allowed switch rotates session atomically');
select preflight.assert(not exists(select 1 from public.workspace_sessions where token_hash=repeat('9',64)),'old session is revoked');
select preflight.assert(exists(select 1 from public.workspace_sessions where token_hash=repeat('0',64) and workspace_id=preflight.id('workspace-a2') and user_id=preflight.id('admin')),'new session stays bound to identity and target');
select preflight.assert(exists(select 1 from public.membership_events where action='ORGANIZATION_CONTEXT_SWITCHED' and actor_id=preflight.id('admin') and workspace_id=preflight.id('workspace-a2')),'switch audit records actor and destination');
select preflight.refused(format('select public.switch_workspace_session(%L,%L,%L,%L,%L)',repeat('0',64),repeat('1',64),preflight.id('workspace-a'),preflight.id('workspace-a'),preflight.id('admin')),'SESSION_SCOPE_CHANGED');
select preflight.refused(format('select public.switch_workspace_session(%L,%L,%L,%L,%L)',repeat('9',64),repeat('1',64),preflight.id('workspace-a'),preflight.id('workspace-a'),preflight.id('admin')),'SESSION_SCOPE_CHANGED');
select preflight.refused(format('select public.update_initiative_stage(%L,%L,%L,''VALIDATION'',%L,''Fictional test'')',preflight.id('workspace-a'),preflight.id('member-viewer'),'c0000000-0000-4000-8000-000000000002',(select updated_at from public.initiatives where id='c0000000-0000-4000-8000-000000000002')),'VIEW_ONLY');
select preflight.refused(format('select public.update_initiative_stage(%L,%L,%L,''VALIDATION'',%L,''Fictional test'')',preflight.id('workspace-a'),preflight.id('member-shared'),'c0000000-0000-4000-8000-000000000002',(select updated_at from public.initiatives where id='c0000000-0000-4000-8000-000000000002')),'STAGE_ACCESS|ACCESS_DENIED');
select public.update_initiative_stage(preflight.id('workspace-a'),preflight.id('member-admin'),'c0000000-0000-4000-8000-000000000002','VALIDATION',(select updated_at from public.initiatives where id='c0000000-0000-4000-8000-000000000002'),'Fictional UAT start confirmed');
select preflight.assert((select stage='VALIDATION' from public.initiatives where id='c0000000-0000-4000-8000-000000000002'),'stage updates canonical initiative immediately');
select preflight.assert(exists(select 1 from public.activity_log where initiative_id='c0000000-0000-4000-8000-000000000002' and event_type='STAGE_CHANGED' and actor_id=preflight.id('admin') and payload->>'reason'='Fictional UAT start confirmed'),'canonical stage and actor audit commit together');
select preflight.refused(format('select public.update_initiative_stage(%L,%L,%L,''DELIVERY'',''2000-01-01'',''Stale request'')',preflight.id('workspace-a'),preflight.id('member-admin'),'c0000000-0000-4000-8000-000000000002'),'STALE_INITIATIVE');
select preflight.refused(format('select public.update_initiative_stage(%L,%L,%L,''DELIVERY'',now(),''Foreign request'')',preflight.id('workspace-b'),preflight.id('owner-b'),'c0000000-0000-4000-8000-000000000002'),'INITIATIVE_ACCESS|ACCESS_DENIED');
reset role;
insert into public.metric_definitions(id,organization_id,workspace_id,initiative_id,name,definition,unit,formula,source_label,period_grain,timezone,origin)
values('e0170000-0000-4000-8000-000000000001',preflight.id('org-a'),preflight.id('workspace-a'),'c0000000-0000-4000-8000-000000000002','Fictional metric','Recorded observed quantity','days','Median observed duration','Fictional approved source','week','Africa/Cairo','HUMAN_ENTRY');
insert into public.metric_observations(id,metric_id,workspace_id,period_start,period_end,value,captured_at,note,origin)
values('e0170000-0000-4000-8000-000000000002','e0170000-0000-4000-8000-000000000001',preflight.id('workspace-a'),'2026-09-14','2026-09-20',null,'2026-09-22','Observation window has not completed','HUMAN_ENTRY');
select preflight.assert((select value is null from public.metric_observations where id='e0170000-0000-4000-8000-000000000002'),'missing observation remains NULL');
select preflight.refused(format('update public.metric_definitions set workspace_id=%L,organization_id=%L where id=%L',preflight.id('workspace-b'),preflight.id('org-b'),'e0170000-0000-4000-8000-000000000001'),'foreign key');
select preflight.refused('update public.metric_definitions set origin=''SYNTHETIC_DEMO'' where id=''e0170000-0000-4000-8000-000000000001''','SYNTHETIC_METRIC_SCOPE');
select preflight.refused('update public.metric_definitions set target_value=3,target_comparator=''AT_MOST'' where id=''e0170000-0000-4000-8000-000000000001''','check constraint');
select preflight.assert((select data from preflight.historical_final)=(select data from public.weekly_reviews where id='91000000-0000-4000-8000-000000000001'),'historical Final survives context/stage/schema additions');
rollback;
