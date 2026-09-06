import type {
  AssessmentState,
  ReviewFinding,
  Severity,
  Stage,
} from "./types";
import { STAGES } from "./types";

/**
 * Whether a finding belongs in Review's "Open" list.
 *
 * Open means *actionable*: something a Product Manager still has to resolve.
 *
 * A SUPERSEDED finding is a record that product truth moved on - the earlier
 * claim was replaced and is retained as history (truth rule 5). That is not a
 * task, so it does not belong in an actionable queue. Listing it there dilutes
 * the list and makes Review look busier than the initiative actually is.
 *
 * It is never deleted or reclassified: it stays visible under "All", keeps its
 * evidence, and continues to explain itself as a supersession rather than a
 * conflict (truth rule 7).
 */
export function isActionable(finding: ReviewFinding): boolean {
  return finding.type !== "SUPERSEDED";
}

/**
 * Default priority for the Initiatives list. It answers one question:
 * "Which initiative needs my attention?"
 *
 * BLOCKED → critical findings → AT_RISK → UNKNOWN → READY.
 */
const STATE_PRIORITY: Record<AssessmentState, number> = {
  BLOCKED: 0,
  AT_RISK: 2,
  UNKNOWN: 3,
  READY: 4,
};

const SEVERITY_PRIORITY: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export function severityRank(severity: Severity): number {
  return SEVERITY_PRIORITY[severity];
}

/**
 * A critical finding lifts an initiative above other same-state initiatives,
 * placing it immediately after anything BLOCKED.
 */
export function attentionRank(
  state: AssessmentState,
  hasCriticalFinding: boolean,
): number {
  const base = STATE_PRIORITY[state];
  if (hasCriticalFinding && base > 1) return 1;
  return base;
}

export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}
