-- ============================================================================
-- PRODWISE — Phase 2: evidence and initiative sources
--
-- Adds the minimum needed to answer "what evidence belongs to this initiative?"
-- Two tables only. There is deliberately NO evidence_history table: activity_log
-- already records boundary changes cleanly, and a second history mechanism would
-- be schema for its own sake (CLAUDE.md §19 — create only what the phase needs).
-- ============================================================================

-- ── Enums ───────────────────────────────────────────────────────────────────

-- Deliberately small. JIRA is a source TYPE only: a record may carry a
-- reference like 'MFF-118' without Prodwise ever contacting Jira.
create type public.evidence_source_type as enum (
  'DOCUMENT',
  'MEETING',
  'EMAIL',
  'JIRA',
  'DECISION_NOTE',
  'OTHER'
);

-- The initiative boundary. Getting this wrong poisons every later intelligence
-- layer, so it is never inferred: a human sets it and a human can change it.
create type public.evidence_boundary as enum (
  'CURRENT_SCOPE',
  'FUTURE_PHASE',
  'HISTORICAL',
  'RELATED',
  'EXCLUDED'
);

-- Phase 2 has no connectors, so every row is MANUAL. The other values exist so
-- the model does not need reshaping later; they are never faked for demos.
create type public.source_connection_state as enum (
  'MANUAL',
  'CONNECTED',
  'ERROR',
  'DISCONNECTED'
);

-- ── initiative_sources ──────────────────────────────────────────────────────
-- Where evidence can conceptually come from, before any integration exists.
create table public.initiative_sources (
  id               uuid primary key default gen_random_uuid(),
  initiative_id    uuid not null references public.initiatives (id) on delete cascade,
  name             text not null,
  source_type      public.evidence_source_type not null,
  connection_state public.source_connection_state not null default 'MANUAL',
  last_synced_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint initiative_sources_name_not_blank check (length(btrim(name)) > 0)
);

comment on column public.initiative_sources.connection_state is
  'Phase 2 has no connectors: every seeded source is MANUAL. A CONNECTED value must never be written without a real integration behind it.';

create index initiative_sources_initiative_idx
  on public.initiative_sources (initiative_id);

-- ── evidence ────────────────────────────────────────────────────────────────
-- Source material, never a conclusion. No claims, findings or scores here.
create table public.evidence (
  id               uuid primary key default gen_random_uuid(),
  initiative_id    uuid not null references public.initiatives (id) on delete cascade,
  source_id        uuid references public.initiative_sources (id) on delete set null,
  title            text not null,
  source_type      public.evidence_source_type not null,
  source_reference text,
  source_url       text,
  content_summary  text,
  boundary         public.evidence_boundary not null,
  occurred_at      timestamptz,
  captured_at      timestamptz not null default now(),
  last_verified_at timestamptz,
  created_by       uuid references public.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint evidence_title_not_blank check (length(btrim(title)) > 0)
);

comment on table public.evidence is
  'Source material attached to an initiative. Holds no interpretation: claims, findings and readiness live elsewhere and are not derived from these rows in Phase 2.';
comment on column public.evidence.boundary is
  'Exactly one boundary per record, set by a human. Phase 2 performs no auto-classification.';
comment on column public.evidence.last_verified_at is
  'When a person last confirmed the record still holds. NULL means unknown, which is a valid state and is not evidence of staleness (truth rules 3 and 4).';

create index evidence_initiative_boundary_idx
  on public.evidence (initiative_id, boundary);
create index evidence_captured_at_idx
  on public.evidence (initiative_id, captured_at desc);

-- ── updated_at triggers ─────────────────────────────────────────────────────
create trigger initiative_sources_set_updated_at
  before update on public.initiative_sources
  for each row execute function public.set_updated_at();

create trigger evidence_set_updated_at
  before update on public.evidence
  for each row execute function public.set_updated_at();

-- ============================================================================
-- SECURITY — unchanged from Phase 1 (CLAUDE.md §18)
--
-- RLS enabled with NO policies: deny by default. The anon and authenticated
-- roles can read and write nothing. All access is server-side through the
-- service-role key, which never reaches the browser, and every mutation is
-- additionally gated by DEMO_WRITE_ENABLED in the repository layer.
-- ============================================================================
alter table public.initiative_sources enable row level security;
alter table public.evidence           enable row level security;

revoke all on public.initiative_sources from anon, authenticated;
revoke all on public.evidence           from anon, authenticated;
