\set ON_ERROR_STOP on
do $$begin if current_database() !~ '^prodwise_second_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_LOCAL_DATABASE_REQUIRED';end if;end$$;
begin;
set local role service_role;
do $$declare
 w uuid:='d2000000-0000-4000-8000-000000000002';m uuid:='d2000000-0000-4000-8000-000000000003';i uuid:='6d525f1b-36ef-4117-82d0-6c348ce6dbbb';stamp timestamptz;cid uuid;payload jsonb;
begin
 select updated_at into stamp from public.initiatives where id=i;
 payload:=jsonb_build_object('initiativeId',i,'expectedUpdatedAt',stamp,'operation','CREATE','label','Synthetic pilot','reason','Define synthetic scope');
 perform public.change_initiative_context(w,m,payload);
 select current_context_id,updated_at into cid,stamp from public.initiatives where id=i;
 if cid is null then raise exception 'TEST_CURRENT_CONTEXT_MISSING';end if;
 begin perform public.change_initiative_context(w,m,payload);raise exception 'TEST_STALE_ALLOWED';exception when others then if sqlerrm<>'STALE_INITIATIVE' then raise;end if;end;
 payload:=jsonb_build_object('initiativeId',i,'expectedUpdatedAt',stamp,'operation','RENAME','contextId',cid,'expectedRevision',1,'label','Synthetic expanded pilot','note','Only synthetic merchants','reason','Clarify current pilot boundary');
 perform public.change_initiative_context(w,m,payload);
 if not exists(select 1 from public.initiative_contexts where id=cid and revision=2 and label='Synthetic expanded pilot') then raise exception 'TEST_RENAME_FAILED';end if;
 select updated_at into stamp from public.initiatives where id=i;
 perform public.change_initiative_context(w,m,payload||jsonb_build_object('operation','RETIRE','expectedRevision',2,'expectedUpdatedAt',stamp));
 if not exists(select 1 from public.initiative_contexts where id=cid and revision=3 and retired_at is not null) then raise exception 'TEST_RETIRE_DELETED_HISTORY';end if;
 if exists(select 1 from public.initiatives where id=i and current_context_id is not null) then raise exception 'TEST_RETIRED_CONTEXT_STILL_CURRENT';end if;
 if (select count(*) from public.activity_log where entity_id=cid::text)<>3 then raise exception 'TEST_HISTORY_MISSING';end if;
 raise notice 'PASS: controlled context create/select, stale refusal, rename, retire, retained history';
end$$;
reset role;
rollback;
