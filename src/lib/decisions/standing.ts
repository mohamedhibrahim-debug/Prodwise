import type { FindingState, ReviewFinding } from "../domain/types.ts";

/** A real decision changes Knowledge so its original mismatch ceases to derive. */
export function isStandingDecision(
  finding: ReviewFinding | null,
  state: FindingState | null,
): boolean {
  return Boolean(state?.outcome && !finding);
}

export function isReemergedDecision(
  finding: ReviewFinding | null,
  state: FindingState | null,
): boolean {
  return Boolean(state?.outcome && finding);
}
