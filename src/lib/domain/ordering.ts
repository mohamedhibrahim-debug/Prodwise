import type { AssessmentState, Severity, Stage } from "./types";
import { STAGES } from "./types";

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
