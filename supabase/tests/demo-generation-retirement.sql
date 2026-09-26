-- Trusted operator reset proof, exclusively fictional LOCAL test records.
\set ON_ERROR_STOP on
do $$ begin if current_database() !~ '^prodwise_platform_preflight_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_PREFLIGHT_DATABASE_REQUIRED';end if;end $$;

create table preflight.retired_generation_before(table_name text primary key,rows jsonb not null);
do $$ declare table_name text; captured jsonb; begin
 foreach table_name in array array['initiatives','initiative_sources','evidence','claims','claim_evidence','finding_states','activity_log','delivery_facts','weekly_reviews'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from public.%I t where workspace_id in ($1,$2)',table_name) into captured using preflight.id('demo-workspace'),preflight.id('demo-workspace-2');
  insert into preflight.retired_generation_before values(table_name,captured);
 end loop;
end $$;
insert into public.workspace_sessions(token_hash,workspace_id,organization_id,user_id,auth_user_id,access_token,refresh_token,expires_at) values(repeat('8',64),preflight.id('demo-workspace'),preflight.id('demo-org'),preflight.id('demo-user'),preflight.id('demo-user'),'fictional-provider-stand-in','fictional-refresh-stand-in',clock_timestamp()+interval '1 hour');
insert into auth.users(id,email) values('d0000000-0000-4000-8000-000000000050','pending-archival@demo.test');
set role service_role;
select public.platform_provision_membership(preflight.id('platform'),preflight.id('demo-org'),'pending-archival@demo.test','ORG_OWNER',false,'Fictional invitation before explicit demo retirement',repeat('7',64));
reset role;
insert into preflight.ids select 'retired-invitation-workspace',workspace_id from public.workspace_invitations where email='pending-archival@demo.test' and organization_id=preflight.id('demo-org');

-- Operator plan guard: persisted registration, exact org/scope, and a reviewer
-- without global platform authority. Names/emails confer no special treatment.
begin;
do $$ begin
 if not exists(select 1 from public.demo_scenarios where workspace_id=preflight.id('demo-workspace') and organization_id=preflight.id('demo-org'))
 or exists(select 1 from public.workspaces w where w.organization_id=preflight.id('demo-org') and not exists(select 1 from public.demo_scenarios d where d.workspace_id=w.id and d.organization_id=w.organization_id))
 or exists(select 1 from public.users where id=preflight.id('demo-user') and platform_role is not null) then raise exception 'EXPLICIT_REGISTERED_DEMO_RETIREMENT_REQUIRED';end if;
end $$;
update public.workspace_sessions set expires_at=clock_timestamp()-interval '1 second' where organization_id=preflight.id('demo-org') and user_id=preflight.id('demo-user') and workspace_id in (preflight.id('demo-workspace'),preflight.id('demo-workspace-2'));
update public.organizations set status='ARCHIVED' where id=preflight.id('demo-org');
update public.workspaces set status='ARCHIVED' where organization_id=preflight.id('demo-org');
update public.organization_memberships set active=false where id=preflight.id('demo-member') and organization_id=preflight.id('demo-org') and user_id=preflight.id('demo-user');
set constraints all immediate;
commit;
select preflight.assert((select status='ARCHIVED' from public.organizations where id=preflight.id('demo-org')),'old demo organization uses explicit retirement state');
select preflight.assert((select count(*)=2 from public.workspaces where organization_id=preflight.id('demo-org') and status='ARCHIVED'),'only old registered generation workspaces archived');
select preflight.assert((select expires_at<clock_timestamp() from public.workspace_sessions where token_hash=repeat('8',64)),'only fictional old reviewer session expired without deletion');
select preflight.assert((select active and platform_role is null from public.users where id=preflight.id('demo-user')),'shared global identity remains active without platform privilege');
set role service_role;
select preflight.refused(format('select public.delivery_read_workspace(%L,%L)',preflight.id('demo-workspace'),preflight.id('demo-member')),'ACCESS_DENIED|OWNER_BOOTSTRAP_REQUIRED');
select preflight.refused(format('select public.delivery_commit_workspace(%L,%L,''{}''::jsonb,''{}''::jsonb,''{}''::jsonb)',preflight.id('demo-workspace-2'),preflight.id('demo-member')),'ACCESS_DENIED|OWNER_BOOTSTRAP_REQUIRED');
select preflight.refused(format('select public.delivery_read_workspace(%L,%L)',preflight.id('demo-workspace'),preflight.id('platform')),'ACCESS_DENIED');
select preflight.refused(format('select public.inspect_workspace_invitation(%L,%L)',preflight.id('retired-invitation-workspace'),repeat('7',64)),'INVITE_INVALID');
select preflight.refused(format('select public.accept_workspace_invitation(%L,%L,''d0000000-0000-4000-8000-000000000050'',''Fictional forbidden archived invitation acceptance'')',preflight.id('retired-invitation-workspace'),repeat('7',64)),'INVITE_INVALID');
select public.platform_create_organization(preflight.id('platform'),'Fictional fresh Demo generation',array['demo.test'],array[]::text[]);
reset role;
insert into preflight.ids select 'fresh-demo-org',id from public.organizations where name='Fictional fresh Demo generation';
insert into preflight.ids select 'fresh-demo-workspace',id from public.workspaces where organization_id=preflight.id('fresh-demo-org');
set role service_role;
select public.platform_provision_membership(preflight.id('platform'),preflight.id('fresh-demo-org'),'reviewer@demo.test','ORG_OWNER',false,'Fictional reviewer reused only in fresh registered demo',repeat('9',64));
reset role;
insert into preflight.ids select 'fresh-demo-member',id from public.organization_memberships where organization_id=preflight.id('fresh-demo-org') and user_id=preflight.id('demo-user');
insert into public.demo_scenarios(workspace_id,organization_id,canonical_version,scenario_at) values(preflight.id('fresh-demo-workspace'),preflight.id('fresh-demo-org'),'fictional-preflight-v3','2026-09-26T09:00:00Z');
insert into public.initiatives(id,workspace_id,slug,name,business_line,is_demo) values('d0000000-0000-4000-8000-000000000020',preflight.id('fresh-demo-workspace'),'merchant-flex-finance','Fictional fresh generation MFF','MF',true);
set role service_role;
select preflight.assert((public.require_workspace_member(preflight.id('fresh-demo-workspace'),preflight.id('fresh-demo-member'),true,true)).role='ORG_OWNER','same global reviewer has full new generation authority');
select preflight.assert(jsonb_array_length(public.delivery_read_workspace(preflight.id('fresh-demo-workspace'),preflight.id('fresh-demo-member'))#>'{source,snapshots}')=1,'new generation read contains only new synthetic portfolio');
select preflight.assert(jsonb_array_length(public.delivery_read_workspace(preflight.id('fresh-demo-workspace'),preflight.id('fresh-demo-member'))#>'{state,reviews}')=0,'new organization inherits no Final baseline or AI history');
select preflight.refused(format('select public.require_workspace_member(%L,%L,false,false)',preflight.id('demo-workspace'),preflight.id('fresh-demo-member')),'ACCESS_DENIED|OWNER_BOOTSTRAP_REQUIRED');
select preflight.refused(format('select public.require_workspace_member(%L,%L,false,false)','10000000-0000-4000-8000-000000000001',preflight.id('fresh-demo-member')),'ACCESS_DENIED');
reset role;
select preflight.assert((select count(*)=1 from public.users where email='reviewer@demo.test'),'reset reuses the global identity without resetting its provider account');
select preflight.assert((select count(*)=1 from public.organization_memberships where user_id=preflight.id('demo-user') and active),'only fresh reviewer membership stays active');
select preflight.refused(format('update public.organization_memberships set active=false where id=%L; set constraints all immediate',preflight.id('fresh-demo-member')),'LAST_ORG_OWNER');
-- A retired workspace cannot be opened even if its organization still ACTIVE.
update public.workspaces set status='ARCHIVED' where id=preflight.id('fresh-demo-workspace');
set role service_role;
select preflight.refused(format('select public.require_workspace_member(%L,%L,false,false)',preflight.id('fresh-demo-workspace'),preflight.id('fresh-demo-member')),'ACCESS_DENIED|OWNER_BOOTSTRAP_REQUIRED');
select preflight.refused(format('select public.require_workspace_member(%L,%L,false,false)',preflight.id('fresh-demo-workspace'),preflight.id('platform')),'ACCESS_DENIED');
reset role;
update public.workspaces set status='ACTIVE' where id=preflight.id('fresh-demo-workspace');
do $$ declare snapshot record; current_rows jsonb; begin
 for snapshot in select * from preflight.retired_generation_before loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from public.%I t where workspace_id in ($1,$2)',snapshot.table_name) into current_rows using preflight.id('demo-workspace'),preflight.id('demo-workspace-2');
  if current_rows is distinct from snapshot.rows then raise exception 'RETIREMENT_CHANGED_OLD_BUSINESS_ROWS: %',snapshot.table_name;end if;
 end loop;
end $$;
select preflight.assert((select data from preflight.demo_previous_final)=(select data from public.weekly_reviews where id=preflight.id('demo-previous-final')),'archived generation Final remains byte-equivalent JSON');
select preflight.refused(format('delete from public.weekly_reviews where id=%L',preflight.id('demo-previous-final')),'FINAL_IMMUTABLE');
\echo 'PASS: explicit registered demo retirement, old reviewer access/session revoked, global identity reused, new active generation access, minimum owner retained and all old business rows/Finals preserved.'
