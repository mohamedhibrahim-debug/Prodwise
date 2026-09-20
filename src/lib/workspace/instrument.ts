import { applyFindingStates } from "@/lib/review/merge";
import { runReview } from "@/lib/review/engine";
import type { InitiativeSnapshot, ReviewFinding } from "@/lib/domain/types";
import { deriveSetup, type SetupProgress } from "@/lib/workspace/setup";

export interface InstrumentSnapshot extends InitiativeSnapshot {
  findings: ReviewFinding[];
  progress: SetupProgress;
}

/** Keeps Instrument presentation over the existing deterministic truth path. */
export function deriveInstrumentSnapshot(
  snapshot: InitiativeSnapshot,
): InstrumentSnapshot {
  const findings = applyFindingStates(
    runReview(snapshot.initiative.id, snapshot.claims),
    snapshot.findingStates,
  );

  return {
    ...snapshot,
    findings,
    progress: deriveSetup({
      evidence: snapshot.evidence,
      claims: snapshot.claims,
      findings,
    }),
  };
}

export function initiativeCode(references: string | null): string {
  return references?.split(/[\n,]/)[0]?.trim() || "—";
}
