insert into claims(id,initiative_id,type,status,subject,attribute,value,domain)
values('dddd0000-0000-4000-8000-000000000031','11111111-1111-4111-8111-111111111111','RISK','DRAFT','Atomic','Failure','Value','RISK');
do $$ declare before_row claims%rowtype; after_row claims%rowtype; begin
 select * into before_row from claims where id='dddd0000-0000-4000-8000-000000000031';
 begin perform verify_claim(before_row.id,'stale','EVIDENCE',null,null,'Demo'); exception when others then null; end;
 select * into after_row from claims where id=before_row.id;
 if after_row.status <> before_row.status or after_row.verified_at is not null then raise exception 'failed verification mutated claim'; end if;
end $$;
