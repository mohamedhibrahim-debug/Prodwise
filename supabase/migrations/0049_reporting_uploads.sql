-- Temporary, private source exports. Only server-side code may access tickets.
create table public.reporting_uploads (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id),
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references public.users(id),
  files jsonb not null check (jsonb_typeof(files) = 'array'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '130 minutes',
  closed boolean not null default false
);
create index reporting_uploads_expiry on public.reporting_uploads(expires_at);
create index reporting_uploads_owner on public.reporting_uploads(user_id, created_at);
alter table public.reporting_uploads enable row level security;
revoke all on public.reporting_uploads from public, anon, authenticated;
grant select, insert, update, delete on public.reporting_uploads to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('reporting-imports','reporting-imports',false,25000000,array['application/octet-stream'])
on conflict(id) do nothing;
do $$begin
  if not exists(select 1 from storage.buckets where id='reporting-imports' and not public and file_size_limit=25000000) then
    raise exception 'REPORTING_BUCKET_CONFIGURATION_MISMATCH';
  end if;
end$$;
