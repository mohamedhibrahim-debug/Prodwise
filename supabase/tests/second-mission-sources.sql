-- Run only against the disposable Second Mission replay. All fixture changes roll back.
\set ON_ERROR_STOP on
do $$begin if current_database() !~ '^prodwise_second_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_LOCAL_DATABASE_REQUIRED';end if;end$$;
begin;
insert into auth.users(id,email,email_confirmed_at) values('e1000000-0000-4000-8000-000000000001','source-member@fictional.test',now()),('e1000000-0000-4000-8000-000000000002','source-viewer@fictional.test',now()),('e1000000-0000-4000-8000-000000000003','source-other@fictional.test',now());
insert into public.users(id,email,display_name,auth_user_id,active,is_system)
select id,email,'Synthetic source test',id,true,false from auth.users where id in ('e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000003');
insert into public.organization_memberships(id,organization_id,user_id,role,active,is_product_lead,policy_override,policy_override_reason)
values('e1000000-0000-4000-8000-000000000011','d2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','MEMBER',true,false,true,'Disposable synthetic test'),
('e1000000-0000-4000-8000-000000000012','d2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','VIEWER',true,false,true,'Disposable synthetic test'),
('e1000000-0000-4000-8000-000000000013','d2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000003','MEMBER',true,false,true,'Disposable synthetic test');
set local role service_role;
do $$declare
 w uuid:='d2000000-0000-4000-8000-000000000002'; m uuid:='e1000000-0000-4000-8000-000000000011';
 i uuid:='6d525f1b-36ef-4117-82d0-6c348ce6dbbb'; mapping uuid; payload jsonb; change jsonb;
begin
 payload:=jsonb_build_object('initiativeId',i,'provider','JIRA','providerWorkspace','synthetic-source-test','containerReference','PAY','containerName','Synthetic Payments','role','DELIVERY','items',jsonb_build_array(jsonb_build_object('reference','PAY-102','name','Synthetic work item','kind','Epic','url',null)));
 perform public.map_initiative_sources(w,m,payload);
 perform public.map_initiative_sources(w,m,payload);
 select sm.id into mapping from public.source_mappings sm join public.source_items si on si.id=sm.item_id join public.source_containers sc on sc.id=si.container_id where sc.provider_workspace='synthetic-source-test' and sm.initiative_id=i;
 if mapping is null then raise exception 'TEST_MAPPING_MISSING';end if;
 if (select count(*) from public.activity_log where entity_id=mapping::text and event_type='SOURCE_MAPPED')<>1 then raise exception 'TEST_RETRY_DUPLICATED';end if;
 change:=jsonb_build_object('initiativeId',i,'mappingId',mapping,'expectedRevision',1,'action','UNLINK','reason','Synthetic scope correction');
 begin perform public.revise_initiative_source(w,'e1000000-0000-4000-8000-000000000012',change);raise exception 'TEST_VIEWER_ALLOWED';exception when others then if sqlerrm<>'VIEW_ONLY' then raise;end if;end;
 begin perform public.revise_initiative_source(w,'e1000000-0000-4000-8000-000000000013',change);raise exception 'TEST_UNRELATED_MEMBER_ALLOWED';exception when others then if sqlerrm<>'SOURCE_MAPPING_ACCESS' then raise;end if;end;
 perform public.revise_initiative_source(w,m,change);
 begin perform public.revise_initiative_source(w,m,change);raise exception 'TEST_STALE_ALLOWED';exception when others then if sqlerrm<>'STALE_SOURCE_MAPPING' then raise;end if;end;
 begin perform public.map_initiative_sources(w,m,payload);raise exception 'TEST_IMPLICIT_RELINK';exception when others then if sqlerrm<>'EXPLICIT_RELINK_REQUIRED' then raise;end if;end;
 perform public.revise_initiative_source(w,m,change||jsonb_build_object('expectedRevision',2,'action','RELINK'));
 if not exists(select 1 from public.source_mappings where id=mapping and revision=3 and unlinked_at is null) then raise exception 'TEST_RELINK_FAILED';end if;
 if (select count(*) from public.activity_log where entity_id=mapping::text)<>3 then raise exception 'TEST_HISTORY_MISSING';end if;
 if has_function_privilege('authenticated','public.revise_initiative_source(uuid,uuid,jsonb)','EXECUTE') then raise exception 'TEST_PUBLIC_WRITE';end if;
 raise notice 'PASS: source reuse, idempotent link, Viewer denial, unrelated Member denial, stale denial, explicit relink, immutable audit';
end$$;
reset role;
rollback;
