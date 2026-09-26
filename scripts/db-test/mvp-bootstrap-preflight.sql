-- Fictional provider identity for PostgreSQL privilege/FK/transaction tests.
-- This does not test Supabase Auth transport, provider sessions or email.
begin;
insert into auth.users(id,email) values('20000000-0000-4000-8000-000000000001','admin@prodwise.test');
set local role service_role;
select public.bootstrap_workspace_admin('10000000-0000-4000-8000-000000000001','admin@prodwise.test',repeat('a',64));
select public.accept_workspace_invitation('10000000-0000-4000-8000-000000000001',repeat('a',64),'20000000-0000-4000-8000-000000000001','Test Admin');
set constraints all immediate;
do $$ begin
  if not exists(select 1 from public.workspaces where id='10000000-0000-4000-8000-000000000001' and status='ACTIVE') then raise exception 'BOOTSTRAP_NOT_ACTIVE'; end if;
  if (select count(*) from public.memberships where active and role='Admin')<>1 then raise exception 'BOOTSTRAP_ADMIN_COUNT'; end if;
end $$;
rollback;
