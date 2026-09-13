-- ============================================================================
-- PRODWISE — Phase 4, Slice 1: human state for derived review findings
--
-- There is deliberately NO `review_findings` table.
--
-- A finding is a pure function of the initiative's claims, recomputed on every
-- read. Storing it would create a second source of truth that could drift from
-- Product Memory, and would need refresh orchestration, duplicate protection
-- and a write path — the last of which would mean the engine never actually
-- executes in the public read-only demo.
--
-- What cannot be recomputed is a person's decision. That is all this table
-- holds, keyed by the finding's content fingerprint.
--
-- ABSENCE OF A ROW MEANS OPEN.
--
-- Additive only: one new enum, one new table. Nothing existing is altered.
-- ============================================================================

create type public.finding_status as enum ('OPEN', 'RESOLVED');

create table public.finding_states (
  initiative_id uuid not null
    references public.initiatives (id) on delete cascade,

  -- sha256 over a length-prefixed canonical string of the rule id, the
  -- initiative and the finding's normalised content. Length prefixing matters:
  -- a plain delimiter could be forged by a claim value containing it, and two
  -- different findings sharing a fingerprint would share one person's
  -- resolution.
  fingerprint text not null,

  rule_id text not null,

  -- The plaintext identity behind the hash.
  --
  -- A fingerprint is one-way, so once a claim changes and a finding stops
  -- deriving, its row would otherwise be permanently unreadable — an audit
  -- record nobody can interpret. These columns keep it legible. They are
  -- descriptive only and are never used to match a finding.
  subject text not null,
  attribute text,
  phase text,
  values_recorded text,

  status public.finding_status not null default 'OPEN',
  resolution text,
  resolved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The composite key IS the duplicate protection: one logical finding can hold
  -- at most one state per initiative.
  primary key (initiative_id, fingerprint),

  -- Both directions, deliberately.
  --
  -- The obvious form — `status = 'RESOLVED' or (resolution is null and ...)` —
  -- is vacuous for exactly the rows it should protect: it permits a RESOLVED
  -- row with no note and no timestamp. Resolving requires a written reason, so
  -- the constraint has to say that.
  constraint finding_states_state_is_coherent check (
    (status = 'OPEN'
       and resolution is null
       and resolved_at is null)
    or
    (status = 'RESOLVED'
       and resolution is not null
       and resolved_at is not null)
  )
);

comment on table public.finding_states is
  'Human decisions about DERIVED review findings. Findings themselves are never stored: they are recomputed from claims on every read, so they cannot drift from Product Memory. Absence of a row means OPEN.';

comment on column public.finding_states.values_recorded is
  'Plaintext of the conflicting values at the time the decision was made. Descriptive only — never used to match a finding, which is matched solely by fingerprint.';

create index finding_states_initiative_idx
  on public.finding_states (initiative_id);

-- ── updated_at trigger ──────────────────────────────────────────────────────
create trigger finding_states_set_updated_at
  before update on public.finding_states
  for each row execute function public.set_updated_at();

-- ============================================================================
-- SECURITY — unchanged (CLAUDE.md §18)
--
-- RLS enabled with NO policies: deny by default. anon and authenticated can
-- read and write nothing. All access is server-side via the service-role key,
-- and every mutation is additionally gated by DEMO_WRITE_ENABLED.
-- ============================================================================
alter table public.finding_states enable row level security;

revoke all on public.finding_states from anon, authenticated;
