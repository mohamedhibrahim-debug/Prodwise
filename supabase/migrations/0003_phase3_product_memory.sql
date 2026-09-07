-- ============================================================================
-- PRODWISE — Phase 3: Product Memory
--
-- Structured product knowledge, backed by real links to Phase 2 evidence.
--
-- Two tables only. There is deliberately NO claim_history, claim_versions,
-- knowledge_graph, claim_conflicts or review_issues: activity_log is the Phase 3
-- audit trail, and interpretation of claims belongs to a later phase
-- (CLAUDE.md §19 — create only what the phase needs).
--
-- Nothing in this phase generates claims. Every record is a migrated seed or
-- something a person entered. No AI extraction exists.
-- ============================================================================

-- ── Enums ───────────────────────────────────────────────────────────────────
-- The canonical claim vocabulary, unchanged. Do not grow either list.
create type public.claim_type as enum (
  'REQUIREMENT',
  'DECISION',
  'BUSINESS_RULE',
  'RISK',
  'DEPENDENCY',
  'ASSUMPTION'
);

create type public.claim_status as enum (
  'ACTIVE',
  'SUPERSEDED',
  'DRAFT',
  'REJECTED',
  'DEFERRED',
  'UNKNOWN',
  'UNVERIFIED'
);

create type public.claim_confidence as enum ('HIGH', 'MEDIUM', 'LOW');

-- ── claims ──────────────────────────────────────────────────────────────────
create table public.claims (
  id                     uuid primary key default gen_random_uuid(),
  initiative_id          uuid not null references public.initiatives (id) on delete cascade,
  type                   public.claim_type   not null,
  status                 public.claim_status not null default 'UNVERIFIED',
  subject                text not null,
  attribute              text not null,
  value                  text not null,
  domain                 text not null,
  phase                  text,
  confidence             public.claim_confidence,
  superseded_by_claim_id uuid references public.claims (id) on delete set null,
  created_by             uuid references public.users (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint claims_subject_not_blank   check (length(btrim(subject)) > 0),
  constraint claims_attribute_not_blank check (length(btrim(attribute)) > 0),
  constraint claims_value_not_blank     check (length(btrim(value)) > 0),

  -- A claim can never supersede itself.
  constraint claims_no_self_supersession check (superseded_by_claim_id is null
                                                or superseded_by_claim_id <> id),

  -- A replacement only means anything while the claim is actually superseded.
  -- SUPERSEDED with a NULL replacement stays valid: the system never invents a
  -- successor it does not know.
  constraint claims_supersession_requires_status
    check (superseded_by_claim_id is null or status = 'SUPERSEDED')
);

comment on table public.claims is
  'Product Memory. Provenance lives in claim_evidence, never as copied source strings on the claim. Holds no judgement about other claims: conflict detection belongs to a later phase.';
comment on column public.claims.status is
  'A human-created claim starts UNVERIFIED — unchecked, which is not the same as wrong.';
comment on column public.claims.confidence is
  'Present on records migrated from the Phase 1 fixture. Not assigned by hand in Phase 3.';
comment on column public.claims.superseded_by_claim_id is
  'Human-set only. Enforced to be non-null only while status = SUPERSEDED, and never self-referential.';

create index claims_initiative_type_idx on public.claims (initiative_id, type);
create index claims_superseded_by_idx   on public.claims (superseded_by_claim_id);

-- ── claim_evidence ──────────────────────────────────────────────────────────
-- Minimal many-to-many. Deliberately NO role taxonomy: no SUPPORTS /
-- CONTRADICTS / INVALIDATES. Phase 3 records only "this claim is linked to this
-- evidence"; characterising the relationship is interpretation.
create table public.claim_evidence (
  claim_id    uuid not null references public.claims (id)   on delete cascade,
  evidence_id uuid not null references public.evidence (id) on delete cascade,
  created_at  timestamptz not null default now(),

  primary key (claim_id, evidence_id)
);

comment on table public.claim_evidence is
  'Claim provenance. A claim may have zero, one or many evidence records; one record may support many claims. A link is never removed automatically because the evidence was later reclassified EXCLUDED — that would rewrite history. Only a deliberate human unlink removes it.';

create index claim_evidence_evidence_idx on public.claim_evidence (evidence_id);

-- ── updated_at trigger ──────────────────────────────────────────────────────
create trigger claims_set_updated_at
  before update on public.claims
  for each row execute function public.set_updated_at();

-- ============================================================================
-- SECURITY — unchanged (CLAUDE.md §18)
--
-- RLS enabled with NO policies: deny by default. anon and authenticated can
-- read and write nothing. All access is server-side via the service-role key,
-- and every mutation is additionally gated by DEMO_WRITE_ENABLED.
-- ============================================================================
alter table public.claims         enable row level security;
alter table public.claim_evidence enable row level security;

revoke all on public.claims         from anon, authenticated;
revoke all on public.claim_evidence from anon, authenticated;
