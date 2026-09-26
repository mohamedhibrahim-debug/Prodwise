-- Disposable localhost DB only. FK stand-in for Auth provider, not a real login.
create schema auth;
create table auth.users(id uuid primary key,email text);
grant usage on schema auth to service_role;
