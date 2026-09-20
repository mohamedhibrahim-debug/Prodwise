do $$ declare c claims%rowtype; stamp timestamptz; begin
 select updated_at into stamp from claims where id='cccc0001-0000-4000-8000-000000000008';
 select * into c from verify_claim('cccc0001-0000-4000-8000-000000000008',stamp,'DIRECT_KNOWLEDGE','Portfolio owner confirmed',null,'Demo mode (no signed-in user)');
 if c.status <> 'ACTIVE' or c.origin <> 'LEGACY' then raise exception 'verification failed'; end if;
 if (select count(*) from activity_log where event_type='CLAIM_VERIFIED' and entity_id=c.id::text) <> 1 then raise exception 'verify audit missing'; end if;
 select updated_at into stamp from claims where id='cccc0001-0000-4000-8000-000000000011';
 perform verify_claim('cccc0001-0000-4000-8000-000000000011',stamp,'EVIDENCE',null,null,'Demo mode (no signed-in user)');
 if (select status from claims where id='cccc0001-0000-4000-8000-000000000011') <> 'ACTIVE' then raise exception 'current scope verify failed'; end if;
end $$;
insert into claims(id,initiative_id,type,status,subject,attribute,value,domain)
values('dddd0000-0000-4000-8000-000000000030','11111111-1111-4111-8111-111111111111','REQUIREMENT','DRAFT','Future','Rule','Value','PRODUCT');
insert into claim_evidence(claim_id,evidence_id)
values('dddd0000-0000-4000-8000-000000000030','bbbb0001-0000-4000-8000-000000000006');
do $$ declare stamp timestamptz; begin
 select updated_at into stamp from claims where id='dddd0000-0000-4000-8000-000000000030';
 begin perform verify_claim('dddd0000-0000-4000-8000-000000000030',stamp,'EVIDENCE',null,null,'Demo'); raise exception 'future blank phase accepted';
 exception when others then
   if sqlerrm='future blank phase accepted' then raise; end if;
   if sqlerrm <> 'FUTURE_PHASE_REQUIRES_PHASE' then raise; end if;
 end;
end $$;

insert into claims(id,initiative_id,type,status,subject,attribute,value,domain,phase)
values('dddd0000-0000-4000-8000-000000000032','11111111-1111-4111-8111-111111111111','REQUIREMENT','DRAFT','Future','Phased rule','Value','PRODUCT','Phase 2');
insert into claim_evidence(claim_id,evidence_id)
values('dddd0000-0000-4000-8000-000000000032','bbbb0001-0000-4000-8000-000000000006');
do $$ declare stamp timestamptz; begin
 select updated_at into stamp from claims where id='dddd0000-0000-4000-8000-000000000032';
 perform verify_claim('dddd0000-0000-4000-8000-000000000032',stamp,'EVIDENCE',null,null,'Demo');
 if (select status from claims where id='dddd0000-0000-4000-8000-000000000032') <> 'ACTIVE' then
   raise exception 'future phase verify failed';
 end if;
end $$;

-- A semantically equal timestamptz with an explicitly different textual zone
-- representation must pass the authoritative database stale check.
insert into claims(id,initiative_id,type,status,subject,attribute,value,domain)
values('dddd0000-0000-4000-8000-000000000033','11111111-1111-4111-8111-111111111111','RISK','DRAFT','Timestamp','Equivalent instant','Value','RISK');
do $$ declare stamp timestamptz; equivalent_stamp timestamptz; begin
 select updated_at into stamp from claims where id='dddd0000-0000-4000-8000-000000000033';
 equivalent_stamp := (to_char(stamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US') || '+00:00')::timestamptz;
 perform verify_claim('dddd0000-0000-4000-8000-000000000033',equivalent_stamp,'DIRECT_KNOWLEDGE','Timestamp comparison test',null,'Demo');
end $$;

-- Historical provenance cannot be reused to reactivate a demoted claim.
insert into claims(id,initiative_id,type,status,subject,attribute,value,domain)
values('dddd0000-0000-4000-8000-000000000034','11111111-1111-4111-8111-111111111111','RISK','UNVERIFIED','Reactivation','Fresh provenance','Value','RISK');
do $$ declare stamp timestamptz; begin
 select updated_at into stamp from claims where id='dddd0000-0000-4000-8000-000000000034';
 perform verify_claim('dddd0000-0000-4000-8000-000000000034',stamp,'DIRECT_KNOWLEDGE','First verification',null,'Demo');
end $$;
create temp table _s21_first_verification as
select verified_at, origin from claims where id='dddd0000-0000-4000-8000-000000000034';
update claims set status='DRAFT' where id='dddd0000-0000-4000-8000-000000000034';
do $$ begin
 begin
   update claims set status='ACTIVE' where id='dddd0000-0000-4000-8000-000000000034';
   raise exception 'stale verification reactivation accepted';
 exception when others then
   if sqlerrm='stale verification reactivation accepted' then raise; end if;
   if sqlerrm <> 'CLAIM_ACTIVATION_REQUIRES_VERIFICATION' then raise; end if;
 end;
end $$;
do $$ declare stamp timestamptz; begin
 select updated_at into stamp from claims where id='dddd0000-0000-4000-8000-000000000034';
 perform verify_claim('dddd0000-0000-4000-8000-000000000034',stamp,'DIRECT_KNOWLEDGE','Reverified after draft',null,'Demo');
 if not exists(
   select 1 from claims c cross join _s21_first_verification f
   where c.id='dddd0000-0000-4000-8000-000000000034'
     and c.status='ACTIVE' and c.verified_at > f.verified_at and c.origin=f.origin
 ) then raise exception 'verify did not refresh provenance or preserve origin'; end if;
 begin
   update claims set verified_actor_label='Rewritten actor' where id='dddd0000-0000-4000-8000-000000000034';
   raise exception 'verified provenance rewrite accepted';
 exception when others then
   if sqlerrm='verified provenance rewrite accepted' then raise; end if;
   if sqlerrm <> 'CLAIM_VERIFICATION_IMMUTABLE' then raise; end if;
 end;
end $$;

insert into claims(id,initiative_id,type,status,subject,attribute,value,domain)
values('dddd0000-0000-4000-8000-000000000035','11111111-1111-4111-8111-111111111111','RISK','DRAFT','Actor','Required','Value','RISK');
do $$ declare stamp timestamptz; begin
 select updated_at into stamp from claims where id='dddd0000-0000-4000-8000-000000000035';
 begin perform verify_claim('dddd0000-0000-4000-8000-000000000035',stamp,'DIRECT_KNOWLEDGE','Actor test',null,'  '); raise exception 'blank verify actor accepted';
 exception when others then
   if sqlerrm='blank verify actor accepted' then raise; end if;
   if sqlerrm <> 'ACTOR_REQUIRED' then raise; end if;
 end;
end $$;
