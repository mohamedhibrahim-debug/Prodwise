\set ON_ERROR_STOP on
do $$begin if current_database() !~ '^prodwise_second_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_LOCAL_DATABASE_REQUIRED';end if;end$$;
begin;
set local role service_role;
do $$declare w uuid:='d2000000-0000-4000-8000-000000000002';m uuid:='d2000000-0000-4000-8000-000000000003';payload jsonb;slug1 text;slug2 text;iid uuid;fact jsonb;fid uuid:=gen_random_uuid();begin
 payload:=jsonb_build_object('requestId',gen_random_uuid(),'name','Synthetic atomic creation test','businessLine','FS','stage','DISCOVERY','ownerMemberId',m,'description','','contextLabel','Pilot scope');
 slug1:=public.create_managed_initiative(w,m,payload);slug2:=public.create_managed_initiative(w,m,payload);
 if slug1<>slug2 then raise exception 'TEST_RETRY_DUPLICATED';end if;
 select id into iid from public.initiatives where workspace_id=w and slug=slug1;
 if (select count(*) from public.delivery_facts where initiative_id=iid and kind='OWNER' and owner_member_id=m and revision=1)<>1 then raise exception 'TEST_OWNER_NOT_ATOMIC';end if;
 if not exists(select 1 from public.initiatives i join public.initiative_contexts c on c.id=i.current_context_id where i.id=iid and c.initiative_id=iid and c.label='Pilot scope') then raise exception 'TEST_CONTEXT_NOT_ATOMIC';end if;
 begin perform public.create_managed_initiative(w,m,payload||jsonb_build_object('name','Changed retry'));raise exception 'TEST_CHANGED_RETRY_ACCEPTED';exception when others then if sqlerrm<>'CREATION_REQUEST_REUSED' then raise;end if;end;
 begin perform public.create_managed_initiative(w,m,payload||jsonb_build_object('requestId',gen_random_uuid()));raise exception 'TEST_DUPLICATE_NAME_ACCEPTED';exception when others then if sqlerrm<>'DUPLICATE_NAME' then raise;end if;end;
 select data into fact from public.delivery_facts where initiative_id=iid and kind='OWNER';
 fact:=fact||jsonb_build_object('id',fid,'kind','TARGET_LIVE','value',jsonb_build_object('date',null,'text',null,'memberId',null,'extent',null,'unknown',true));
 insert into public.delivery_facts(id,workspace_id,initiative_id,kind,revision,data) values(fid,w,iid,'TARGET_LIVE',1,fact);
 begin update public.delivery_facts set data=jsonb_set(data,'{value}','{"date":null,"text":null,"memberId":null,"extent":null}'::jsonb) where id=fid;raise exception 'TEST_MISSING_DATE_ACCEPTED';exception when check_violation then null;end;
 begin update public.delivery_facts set data=jsonb_set(data,'{value}','{"date":null,"text":"Invented certainty","memberId":null,"extent":null,"unknown":true}'::jsonb),value_text='Invented certainty' where id=fid;raise exception 'TEST_UNKNOWN_WITH_VALUE_ACCEPTED';exception when check_violation then null;end;
 raise notice 'PASS: atomic initiative/owner/context creation, idempotent retry, changed retry and duplicate denial, Unknown distinct from missing';
end$$;
set constraints all immediate;
reset role;
rollback;
