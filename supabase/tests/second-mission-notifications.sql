-- Run only against the disposable Second Mission replay. All fixture changes roll back.
\set ON_ERROR_STOP on
do $$begin if current_database() !~ '^prodwise_second_[0-9a-f]{32}$' then raise exception 'DISPOSABLE_LOCAL_DATABASE_REQUIRED';end if;end$$;
begin;
set local role service_role;
do $$declare o uuid:='d2000000-0000-4000-8000-000000000001'; u uuid:='d2000000-0000-4000-8000-000000000004';begin
 insert into public.notification_reads(organization_id,user_id,fingerprint) values(o,u,repeat('a',32));
 insert into public.notification_reads(organization_id,user_id,fingerprint) values(o,u,repeat('a',32)) on conflict do nothing;
 if (select count(*) from public.notification_reads where user_id=u)<>1 then raise exception 'TEST_DUPLICATE_READ';end if;
 begin insert into public.notification_reads(organization_id,user_id,fingerprint) values(o,u,'not-a-fingerprint');raise exception 'TEST_BAD_FINGERPRINT';exception when check_violation then null;end;
 begin delete from public.notification_reads where user_id=u;raise exception 'TEST_DELETE_ALLOWED';exception when insufficient_privilege then null;end;
 if has_table_privilege('anon','public.notification_reads','SELECT') or has_table_privilege('authenticated','public.notification_reads','INSERT') then raise exception 'TEST_PUBLIC_ACCESS';end if;
 raise notice 'PASS: one mark per fingerprint, fingerprint format enforced, marks are append-only, no public access';
end$$;
reset role;
rollback;
