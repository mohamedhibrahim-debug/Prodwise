-- ============================================================================
-- PRODWISE — Phase 1 foundation
--
-- Creates only what Phase 1 requires: users, initiatives, activity_log.
-- The wider entity set (evidence, claims, review_issues, assessments, actions,
-- relationships, initiative_sources) belongs to later phases and is NOT
-- created here. See CLAUDE.md §19.
-- ============================================================================

-- ── Enums ───────────────────────────────────────────────────────────────────
-- The lifecycle is not a waterfall: an initiative may move backward, reopen or
-- split into phases. The enum records position, it does not enforce a path.
create type public.initiative_stage as enum (
  'DISCOVERY',
  'DEFINITION',
  'ALIGNMENT',
  'DELIVERY',
  'VALIDATION',
  'RELEASE_PREPARATION',
  'LIVE_VALIDATION',
  'MONITORING'
);

-- UNKNOWN is a first-class value, not a missing one. Prodwise never
-- manufactures certainty, and never stores a percentage readiness.
create type public.assessment_state as enum (
  'READY',
  'AT_RISK',
  'BLOCKED',
  'UNKNOWN'
);

-- ── users ───────────────────────────────────────────────────────────────────
-- Phase 1 has no authentication. This table exists so ownership and audit
-- relationships have somewhere to point, and is seeded with a single demo user.
create table public.users (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,
  display_name text not null,
  created_at   timestamptz not null default now()
);

comment on table public.users is
  'Phase 1: no authentication. Seeded with one demo user so ownership and audit relationships have a target. Real accounts arrive with authentication in a later phase.';

-- ── initiatives ─────────────────────────────────────────────────────────────
create table public.initiatives (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  description      text,
  known_references text,
  stage            public.initiative_stage not null default 'DISCOVERY',
  overall_state    public.assessment_state  not null default 'UNKNOWN',
  state_summary    text,
  is_demo          boolean not null default false,
  created_by       uuid references public.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint initiatives_name_not_blank check (length(btrim(name)) > 0),
  constraint initiatives_slug_format    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

comment on column public.initiatives.slug is
  'Stable public identifier. Routes and synthetic fixtures key off this, never off the generated uuid.';
comment on column public.initiatives.overall_state is
  'Defaults to UNKNOWN: a new initiative has no connected evidence, so no state can be claimed for it.';
comment on column public.initiatives.is_demo is
  'True for seeded synthetic initiatives, so the UI can label demo data honestly.';

create index initiatives_updated_at_idx on public.initiatives (updated_at desc);

-- ── activity_log ────────────────────────────────────────────────────────────
create table public.activity_log (
  id            uuid primary key default gen_random_uuid(),
  initiative_id uuid not null references public.initiatives (id) on delete cascade,
  actor_id      uuid references public.users (id) on delete set null,
  event_type    text not null,
  summary       text not null,
  occurred_at   timestamptz not null default now()
);

create index activity_log_initiative_idx
  on public.activity_log (initiative_id, occurred_at desc);

-- ── updated_at trigger ──────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger initiatives_set_updated_at
  before update on public.initiatives
  for each row execute function public.set_updated_at();

-- ============================================================================
-- PHASE 1 SECURITY MODEL  (temporary — see CLAUDE.md §18)
--
-- Phase 1 intentionally has no authentication. To make sure that does not leave
-- an unrestricted public surface, RLS is ENABLED ON EVERY TABLE WITH NO
-- POLICIES. Postgres denies by default, so the `anon` and `authenticated`
-- roles can read and write nothing at all.
--
-- All application access is server-side, through the service-role key, which
-- bypasses RLS and never reaches the browser. Prodwise ships no browser
-- Supabase client. Mutations are additionally gated by the DEMO_WRITE_ENABLED
-- environment flag, enforced inside the repository layer.
--
-- This is deliberately NOT a permissive public policy. Real per-user access
-- control arrives with authentication and permission-aware evidence.
-- ============================================================================
alter table public.users       enable row level security;
alter table public.initiatives enable row level security;
alter table public.activity_log enable row level security;

revoke all on public.users        from anon, authenticated;
revoke all on public.initiatives  from anon, authenticated;
revoke all on public.activity_log from anon, authenticated;
