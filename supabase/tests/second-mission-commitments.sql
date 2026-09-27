\set ON_ERROR_STOP on
do $$begin if current_database() !~ '^prodwise_second_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_LOCAL_DATABASE_REQUIRED';end if;end$$;
begin;
set local role service_role;
do $$declare w uuid:='d2000000-0000-4000-8000-000000000002';m uuid:='d2000000-0000-4000-8000-000000000003';new_slug text;iid uuid;aid uuid;payload jsonb;begin
 new_slug:=public.create_managed_initiative(w,m,jsonb_build_object('requestId',gen_random_uuid(),'name','Synthetic commitment SQL test','businessLine','FS','stage','DISCOVERY','ownerMemberId',m));select id into iid from public.initiatives where workspace_id=w and initiatives.slug=new_slug;
 payload:=jsonb_build_object('requestId',gen_random_uuid(),'expectedRevision',0,'title','Confirm synthetic scope','assigneeMemberId',m,'status','OPEN','note','');
 aid:=public.save_commitment(w,m,iid,payload);if aid<>public.save_commitment(w,m,iid,payload) then raise exception 'TEST_DUPLICATE';end if;
 if (select count(*) from public.action_events where action_id=aid)<>1 then raise exception 'TEST_RETRY_EVENT';end if;
 payload:=payload||jsonb_build_object('id',aid,'requestId',gen_random_uuid(),'expectedRevision',1,'status','DONE');perform public.save_commitment(w,m,iid,payload);
 begin perform public.save_commitment(w,m,iid,payload||jsonb_build_object('requestId',gen_random_uuid()));raise exception 'TEST_STALE_ACCEPTED';exception when others then if sqlerrm<>'STALE_ACTION' then raise;end if;end;
 if (select data#>>'{after,status}' from public.action_events where action_id=aid and seq=2)<>'DONE' then raise exception 'TEST_EVENT_STATE';end if;
 begin update public.action_events set seq=100 where action_id=aid;raise exception 'TEST_MUTABLE_HISTORY';exception when insufficient_privilege then null;end;
 raise notice 'PASS: commitment create, retry, status revision, stale rejection, immutable event permissions';
end$$;
set constraints all immediate;
reset role;
rollback;
