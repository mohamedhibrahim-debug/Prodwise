import type {
  ActivityEntry,
  ClaimPatch,
  ClaimRecord,
  MemoryClaim,
  Actor,
  EvidenceAnchorInput,
  EvidencePatch,
  EvidenceRecord,
  FindingState,
  FindingStateInput,
  Initiative,
  InitiativeSnapshot,
  InitiativeSource,
  NewClaimInput,
  NewEvidenceInput,
  NewInitiativeInput,
  VerifyClaimInput,
  ResolveConflictPlan,
  ResolveConflictResult,
  AssignConfirmerPlan,
} from "@/lib/domain/types";

/**
 * The one data-access contract.
 *
 * Both implementations — Supabase and local fixtures — satisfy this interface
 * and return identical domain shapes. UI code must never know, or be able to
 * tell, which one is active (CLAUDE.md §17).
 *
 * Mutations are gated by DEMO_WRITE_ENABLED inside each implementation and
 * throw WriteDisabledError when writes are off (CLAUDE.md §18).
 */
export interface Repository {
  listInitiatives(): Promise<Initiative[]>;
  /** One read-only aggregate path; used to avoid portfolio N+1 queries. */
  listInitiativeSnapshots(): Promise<InitiativeSnapshot[]>;
  /** The same aggregate shape, scoped to one initiative for shell facts. */
  getInitiativeSnapshot(initiativeId: string): Promise<InitiativeSnapshot | null>;
  getInitiativeBySlug(slug: string): Promise<Initiative | null>;
  listActivity(initiativeId: string, limit?: number): Promise<ActivityEntry[]>;
  createInitiative(input: NewInitiativeInput): Promise<Initiative>;

  /* ── Evidence ────────────────────────────────────────────────────────────
     Evidence is real, persisted and human-owned from Phase 2 onward. */
  listEvidence(initiativeId: string): Promise<EvidenceRecord[]>;
  getEvidence(id: string): Promise<EvidenceRecord | null>;
  createEvidence(input: NewEvidenceInput): Promise<EvidenceRecord>;
  /**
   * Applies an edit. When the patch changes the boundary, the implementation
   * also writes the corresponding activity entry — one method rather than a
   * near-duplicate `reclassify`, so the two can never drift apart.
   */
  updateEvidence(id: string, patch: EvidencePatch): Promise<EvidenceRecord>;

  listSources(initiativeId: string): Promise<InitiativeSource[]>;

  /* ── Product Memory ──────────────────────────────────────────────────────
     Claims are real, persisted and human-owned from Phase 3 onward. Nothing
     generates them: every record is a migrated seed or something a person
     entered. The repository resolves provenance so no page touches the link
     table. */
  listClaims(initiativeId: string): Promise<MemoryClaim[]>;
  getClaim(id: string): Promise<MemoryClaim | null>;
  /** Always created UNVERIFIED — a new claim has not been verified by anyone. */
  createClaim(input: NewClaimInput): Promise<ClaimRecord>;
  /**
   * Applies an edit and logs meaningful changes. Normalises the supersession
   * invariant: `supersededByClaimId` survives only while the status is
   * SUPERSEDED, whatever the caller passes.
   */
  updateClaim(id: string, patch: ClaimPatch): Promise<ClaimRecord>;
  /**
   * Replaces a claim's evidence links with exactly `evidenceIds`.
   * Callers must have already validated the ids (ownership, and that newly
   * added ones are not EXCLUDED) — see lib/data/access.ts.
   */
  setClaimEvidence(claimId: string, evidenceIds: string[]): Promise<void>;
  verifyClaim(id: string, input: VerifyClaimInput): Promise<MemoryClaim>;
  setEvidenceAnchor(
    claimId: string,
    evidenceId: string,
    input: EvidenceAnchorInput,
  ): Promise<void>;

  /* ── Review findings (Phase 4) ───────────────────────────────────────────
     Findings themselves are NOT stored. They are derived from claims by the
     pure engine in lib/review on every read, so they can never drift from
     Product Memory. Only the human decision about a finding is persisted, and
     the absence of a state row means OPEN. */

  /** A read: derivation and display must work with writes disabled. */
  listFindingStates(initiativeId: string): Promise<FindingState[]>;
  resolveConflict(plan: ResolveConflictPlan): Promise<ResolveConflictResult>;
  assignFindingConfirmer(plan: AssignConfirmerPlan): Promise<void>;
  /** Marks a finding resolved. A written reason is required. */
  setFindingState(
    initiativeId: string,
    fingerprint: string,
    input: FindingStateInput,
  ): Promise<void>;
  /**
   * Reopens a finding by removing its state row.
   *
   * The note is not silently discarded: both resolving and reopening are
   * written to activity_log, which is the audit trail for this kind of change
   * (CLAUDE.md §19 — no second history mechanism).
   */
  reopenFindingState(
    initiativeId: string,
    fingerprint: string,
    actor: Actor,
  ): Promise<boolean>;
}

/** Derives a stable, URL-safe slug. Collisions are resolved by the caller. */
export function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return base.length > 0 ? base : "initiative";
}

export function uniqueSlug(name: string, taken: Iterable<string>): string {
  const existing = new Set(taken);
  const base = slugify(name);
  if (!existing.has(base)) return base;

  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}
