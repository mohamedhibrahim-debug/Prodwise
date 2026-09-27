\set ON_ERROR_STOP on
do $$begin if current_database() !~ '^prodwise_second_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_LOCAL_DATABASE_REQUIRED';end if;end$$;
begin;
set local role service_role;
do $$declare w uuid:='d2000000-0000-4000-8000-000000000002';m uuid:='d2000000-0000-4000-8000-000000000003';i public.initiatives;before_finals jsonb;source_count integer;begin
 select * into i from public.initiatives where workspace_id=w order by id limit 1;
 select coalesce(jsonb_agg(data order by id),'[]'::jsonb) into before_finals from public.weekly_reviews where workspace_id=w and status='FINAL';
 select count(*) into source_count from public.evidence where initiative_id=i.id;
 perform public.set_initiative_archive(w,m,i.id,i.updated_at,true,'Synthetic archive test',i.name);
 begin perform public.update_initiative_basics(w,m,i.id,i.updated_at,'Forbidden archived edit',i.business_line::text,i.description);raise exception 'TEST_ARCHIVED_EDIT_ALLOWED';exception when others then if sqlerrm<>'INITIATIVE_ARCHIVED' then raise;end if;end;
 begin update public.evidence set title='Forbidden archived evidence change' where initiative_id=i.id; if source_count>0 then raise exception 'TEST_OLD_PATH_ALLOWED';end if;exception when others then if sqlerrm<>'INITIATIVE_ARCHIVED' then raise;end if;end;
 begin update public.initiatives set stage=case when stage='DISCOVERY' then 'DEFINITION'::public.initiative_stage else 'DISCOVERY'::public.initiative_stage end where id=i.id;raise exception 'TEST_ARCHIVED_STAGE_ALLOWED';exception when others then if sqlerrm<>'INITIATIVE_ARCHIVED' then raise;end if;end;
 if source_count<>(select count(*) from public.evidence where initiative_id=i.id) then raise exception 'TEST_EVIDENCE_LOST';end if;
 if before_finals is distinct from (select coalesce(jsonb_agg(data order by id),'[]'::jsonb) from public.weekly_reviews where workspace_id=w and status='FINAL') then raise exception 'TEST_FINAL_CHANGED';end if;
 select * into i from public.initiatives where id=i.id;
 perform public.set_initiative_archive(w,m,i.id,i.updated_at,false,'Synthetic restore test','');
 if exists(select 1 from public.initiatives where id=i.id and archived_at is not null) then raise exception 'TEST_RESTORE_FAILED';end if;
 raise notice 'PASS: archived writes refused across metadata/evidence/stage, evidence and Finals unchanged, restore permitted';
end$$;
reset role;
rollback;
