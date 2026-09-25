import type { EvidenceRecord, MemoryClaim, ReviewFinding } from "../domain/types.ts";

export type SetupStepKey = "sources" | "record" | "confirm" | "checking";
export type SetupStepState = "done" | "current" | "waiting" | "descriptive";
export interface SetupStep { key: SetupStepKey; state: SetupStepState }
export interface SetupFacts {
  evidenceTotal: number;
  evidenceInScope: number;
  evidenceLastAddedAt: string | null;
  claimsTotal: number;
  claimsActive: number;
  claimsUnverified: number;
  claimsSuperseded: number;
  decisionsOpen: number;
  confirmedWithSource: number;
}
export interface SetupProgress {
  steps: SetupStep[];
  current: Exclude<SetupStepKey, "checking"> | null;
  mode: "setup" | "operating";
  complete: boolean;
  doneCount: number;
  facts: SetupFacts;
}
export interface SetupInput {
  evidence: Pick<EvidenceRecord, "boundary" | "createdAt">[];
  claims: Pick<MemoryClaim, "status" | "evidence">[];
  findings: Pick<ReviewFinding, "status" | "actionable">[];
}

const IN_SCOPE = new Set(["CURRENT_SCOPE", "FUTURE_PHASE"]);

/** The three required checks are independent persisted facts. */
export function deriveSetup({ evidence, claims, findings }: SetupInput): SetupProgress {
  let lastAdded: string | null = null;
  for (const item of evidence) if (lastAdded === null || item.createdAt > lastAdded) lastAdded = item.createdAt;
  const facts: SetupFacts = {
    evidenceTotal: evidence.length,
    evidenceInScope: evidence.filter((item) => IN_SCOPE.has(item.boundary)).length,
    evidenceLastAddedAt: lastAdded,
    claimsTotal: claims.length,
    claimsActive: claims.filter((item) => item.status === "ACTIVE").length,
    claimsUnverified: claims.filter((item) => item.status === "UNVERIFIED").length,
    claimsSuperseded: claims.filter((item) => item.status === "SUPERSEDED").length,
    decisionsOpen: findings.filter((item) => item.status === "OPEN" && item.actionable).length,
    confirmedWithSource: claims.filter((item) => item.status === "ACTIVE" && item.evidence.some((source) => IN_SCOPE.has(source.boundary))).length,
  };
  const satisfied = {
    sources: facts.evidenceInScope > 0,
    record: facts.claimsTotal > 0,
    confirm: facts.confirmedWithSource > 0,
  };
  const order = ["sources", "record", "confirm"] as const;
  const current = order.find((key) => !satisfied[key]) ?? null;
  const steps: SetupStep[] = [
    ...order.map((key) => ({ key, state: satisfied[key] ? "done" as const : key === current ? "current" as const : "waiting" as const })),
    { key: "checking", state: "descriptive" },
  ];
  const complete = order.every((key) => satisfied[key]);
  return { steps, current, mode: complete ? "operating" : "setup", complete,
    doneCount: order.filter((key) => satisfied[key]).length, facts };
}
