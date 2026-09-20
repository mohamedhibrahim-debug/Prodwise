insert into claims(id,initiative_id,type,status,subject,attribute,value,domain)
values('dddd0000-0000-4000-8000-000000000031','11111111-1111-4111-8111-111111111111','RISK','DRAFT','Atomic','Failure','Value','RISK');
do $$ declare before_row claims%rowtype; after_row claims%rowtype; begin
 select * into before_row from claims where id='dddd0000-0000-4000-8000-000000000031';
 begin perform verify_claim(before_row.id,'2000-01-01T00:00:00Z'::timestamptz,'EVIDENCE',null,null,'Demo'); exception when others then null; end;
 select * into after_row from claims where id=before_row.id;
 if after_row.status <> before_row.status or after_row.verified_at is not null then raise exception 'failed verification mutated claim'; end if;
end $$;

-- Force the audit insert to fail after verify_claim has issued its claim
-- update. Catching the error creates a subtransaction boundary, so these
-- assertions prove both writes roll back together.
alter table activity_log add constraint _s21_reject_claim_verified
  check (event_type <> 'CLAIM_VERIFIED') not valid;
do $$ declare before_row claims%rowtype; after_row claims%rowtype; begin
 select * into before_row from claims where id='dddd0000-0000-4000-8000-000000000031';
 begin
   perform verify_claim(before_row.id,before_row.updated_at,'DIRECT_KNOWLEDGE','Atomicity test',null,'Demo');
   raise exception 'late verify failure did not occur';
 exception when check_violation then null;
 end;
 select * into after_row from claims where id=before_row.id;
 if after_row.status <> 'DRAFT'
    or after_row.verified_at is distinct from before_row.verified_at
    or after_row.verified_actor_id is distinct from before_row.verified_actor_id
    or after_row.verified_actor_label is distinct from before_row.verified_actor_label
    or after_row.verification_basis is distinct from before_row.verification_basis
    or after_row.verification_note is distinct from before_row.verification_note then
   raise exception 'late verify failure did not roll back claim';
 end if;
 if exists(select 1 from activity_log where event_type='CLAIM_VERIFIED' and entity_id=before_row.id::text) then
   raise exception 'late verify failure retained activity';
 end if;
end $$;
alter table activity_log drop constraint _s21_reject_claim_verified;
