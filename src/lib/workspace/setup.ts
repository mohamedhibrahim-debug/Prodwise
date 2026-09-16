import type {
  ClaimRecord,
  EvidenceRecord,
  ReviewFinding,
} from "../domain/types.ts";

/**
 * Setup progress for an initiative, derived from records that already exist.
 *
 * Pure: no clock, no database, no environment — the Status page passes in what
 * it has already loaded, so this costs no query and is fully testable.
 *
 * Every "done" is a fact about persisted data, never a judgement. The last two
 * steps cannot be derived at all yet: readiness criteria and derived status do
 * not exist in the product. They are reported as not assessed rather than as
 * waiting or done, so no amount of setup work can make the rail read complete
 * before those capabilities are real.
 */

export type SetupStepKey =
  | "sources"
  | "memory"
  | "decisions"
  | "readiness"
  | "status";

export type SetupStepState =
  /** The persisted data satisfies this step. */
  | "done"
  /** The first unfinished step. Exactly one step, at most, is current. */
  | "current"
  /** Unfinished, and not the first unfinished step. */
  | "waiting"
  /** The capability behind this step is not built, so it cannot be assessed. */
  | "not_assessed";

export interface SetupStep {
  key: SetupStepKey;
  state: SetupStepState;
}

export interface SetupFacts {
  evidenceTotal: number;
  /** CURRENT_SCOPE or FUTURE_PHASE — confirmed as belonging to the initiative. */
  evidenceInScope: number;
  /** Latest evidence `createdAt` — when a record was added, nothing more. */
  evidenceLastAddedAt: string | null;
  claimsTotal: number;
  claimsActive: number;
  claimsUnverified: number;
  claimsSuperseded: number;
  /** Open, actionable findings. History is never counted as open work. */
  decisionsOpen: number;
}

export interface SetupProgress {
  steps: SetupStep[];
  /** The one step carrying the primary action, or null when none can. */
  current: SetupStepKey | null;
  /**
   * `setup` until trusted knowledge exists (at least one ACTIVE claim). Moving
   * to `operating` changes the layout only — it does not mean setup is done.
   */
  mode: "setup" | "operating";
  /** True only when every step is done. Unreachable until later stages exist. */
  complete: boolean;
  doneCount: number;
  facts: SetupFacts;
}

export interface SetupInput {
  evidence: Pick<EvidenceRecord, "boundary" | "createdAt">[];
  claims: Pick<ClaimRecord, "status">[];
  findings: Pick<ReviewFinding, "status" | "actionable">[];
}

const IN_SCOPE = new Set(["CURRENT_SCOPE", "FUTURE_PHASE"]);

export function deriveSetup({
  evidence,
  claims,
  findings,
}: SetupInput): SetupProgress {
  let lastAdded: string | null = null;
  for (const e of evidence) {
    if (lastAdded === null || e.createdAt > lastAdded) lastAdded = e.createdAt;
  }

  const facts: SetupFacts = {
    evidenceTotal: evidence.length,
    evidenceInScope: evidence.filter((e) => IN_SCOPE.has(e.boundary)).length,
    evidenceLastAddedAt: lastAdded,
    claimsTotal: claims.length,
    claimsActive: claims.filter((c) => c.status === "ACTIVE").length,
    claimsUnverified: claims.filter((c) => c.status === "UNVERIFIED").length,
    claimsSuperseded: claims.filter((c) => c.status === "SUPERSEDED").length,
    decisionsOpen: findings.filter((f) => f.status === "OPEN" && f.actionable)
      .length,
  };

  const hasMemory = facts.claimsActive > 0;

  const satisfied: Record<"sources" | "memory" | "decisions", boolean> = {
    sources: facts.evidenceInScope > 0,
    memory: hasMemory,
    // Nothing is "reviewed" without memory to review: zero open findings over
    // zero claims is an absence of input, not a settled queue.
    decisions: hasMemory && facts.decisionsOpen === 0,
  };

  const order = ["sources", "memory", "decisions"] as const;
  const current = order.find((key) => !satisfied[key]) ?? null;

  const steps: SetupStep[] = [
    ...order.map((key) => ({
      key,
      state: satisfied[key]
        ? ("done" as const)
        : key === current
          ? ("current" as const)
          : ("waiting" as const),
    })),
    { key: "readiness", state: "not_assessed" },
    { key: "status", state: "not_assessed" },
  ];

  const doneCount = steps.filter((s) => s.state === "done").length;

  return {
    steps,
    current,
    mode: hasMemory ? "operating" : "setup",
    complete: doneCount === steps.length,
    doneCount,
    facts,
  };
}
