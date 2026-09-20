do $$ declare c claims%rowtype; stamp text; begin
 select to_jsonb(x)->>'updated_at' into stamp from claims x where id='cccc0001-0000-4000-8000-000000000008';
 select * into c from verify_claim('cccc0001-0000-4000-8000-000000000008',stamp,'DIRECT_KNOWLEDGE','Portfolio owner confirmed',null,'Demo mode (no signed-in user)');
 if c.status <> 'ACTIVE' or c.origin <> 'LEGACY' then raise exception 'verification failed'; end if;
 if (select count(*) from activity_log where event_type='CLAIM_VERIFIED' and entity_id=c.id::text) <> 1 then raise exception 'verify audit missing'; end if;
 select to_jsonb(x)->>'updated_at' into stamp from claims x where id='cccc0001-0000-4000-8000-000000000011';
 perform verify_claim('cccc0001-0000-4000-8000-000000000011',stamp,'EVIDENCE',null,null,'Demo mode (no signed-in user)');
 if (select status from claims where id='cccc0001-0000-4000-8000-000000000011') <> 'ACTIVE' then raise exception 'current scope verify failed'; end if;
end $$;
insert into claims(id,initiative_id,type,status,subject,attribute,value,domain)
values('dddd0000-0000-4000-8000-000000000030','11111111-1111-4111-8111-111111111111','REQUIREMENT','DRAFT','Future','Rule','Value','PRODUCT');
insert into claim_evidence(claim_id,evidence_id)
values('dddd0000-0000-4000-8000-000000000030','bbbb0001-0000-4000-8000-000000000006');
do $$ declare stamp text; begin
 select to_jsonb(x)->>'updated_at' into stamp from claims x where id='dddd0000-0000-4000-8000-000000000030';
 begin perform verify_claim('dddd0000-0000-4000-8000-000000000030',stamp,'EVIDENCE',null,null,'Demo'); raise exception 'future blank phase accepted';
 exception when others then
   if sqlerrm='future blank phase accepted' then raise; end if;
   if sqlerrm <> 'FUTURE_PHASE_REQUIRES_PHASE' then raise; end if;
 end;
end $$;
