\set ON_ERROR_STOP on
do $$begin if current_database() !~ '^prodwise_second_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_LOCAL_DATABASE_REQUIRED';end if;end$$;
begin;
-- A synthetic Platform Owner with no membership in the fictional Demo organization.
insert into auth.users(id,email,email_confirmed_at) values('e9100000-0000-4000-8000-000000000001','platform-attr@synthetic.test',now());
insert into public.users(id,email,display_name,auth_user_id,active,is_system,platform_role) values('e9100000-0000-4000-8000-000000000002','platform-attr@synthetic.test','Synthetic Platform','e9100000-0000-4000-8000-000000000001',true,false,'PLATFORM_OWNER');
set local role service_role;
do $$declare w uuid:='d2000000-0000-4000-8000-000000000002';m uuid:='d2000000-0000-4000-8000-000000000003';p uuid:='e9100000-0000-4000-8000-000000000002';a uuid;b uuid;rid uuid;s text;label text;begin
 s:=public.create_managed_initiative(w,m,jsonb_build_object('requestId',gen_random_uuid(),'name','Synthetic attr A','businessLine','FS','stage','DELIVERY','ownerMemberId',m));select id into a from public.initiatives where workspace_id=w and slug=s;
 s:=public.create_managed_initiative(w,m,jsonb_build_object('requestId',gen_random_uuid(),'name','Synthetic attr B','businessLine','FS','stage','DELIVERY','ownerMemberId',m));select id into b from public.initiatives where workspace_id=w and slug=s;
 -- Platform authority still writes (0012 policy), and the record names that authority.
 perform public.save_relationship(w,p,jsonb_build_object('operation','CREATE','requestId',gen_random_uuid(),'expectedRevision',0,'fromInitiativeId',a,'toInitiativeId',b,'type','RELATED_TO','rationale','Platform attribution proof'));
 select actor_label into label from public.activity_log where initiative_id=a and event_type='RELATIONSHIP_CONFIRMED' order by occurred_at desc limit 1;
 if label is distinct from 'Synthetic Platform (Platform Owner, not a member)' then raise exception 'PLATFORM_NOT_ATTRIBUTED %',label;end if;
 -- A member's label is unchanged.
 rid:=public.save_relationship(w,m,jsonb_build_object('operation','CREATE','requestId',gen_random_uuid(),'expectedRevision',0,'fromInitiativeId',b,'toInitiativeId',a,'type','DEPENDS_ON','rationale','Member attribution proof'));
 select actor_label into label from public.activity_log where entity_id=rid::text and initiative_id=b limit 1;if label is null then raise exception 'MEMBER_EVENT_MISSING';end if;
 if label like '%Platform Owner%' then raise exception 'MEMBER_MISLABELLED %',label;end if;
 raise notice 'PASS: non-member Platform Owner writes are attributed as platform authority; member labels unchanged';
end$$;reset role;rollback;
