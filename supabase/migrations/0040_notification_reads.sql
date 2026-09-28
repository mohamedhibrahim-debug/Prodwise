-- Phase 4: in-app notifications.
--
-- Notifications themselves are derived from canonical records on every read and
-- are never stored (no second source of truth). Only a person's "read" marks are
-- kept, per organization, keyed by a fingerprint of the exact record version.
-- Server-only (service role); RLS on with no policies.
create table public.notification_reads (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references public.users(id),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{32}$'),
  read_at timestamptz not null default clock_timestamp(),
  primary key (organization_id, user_id, fingerprint)
);
alter table public.notification_reads enable row level security;
revoke all on public.notification_reads from public, anon, authenticated;
grant select, insert on public.notification_reads to service_role;
