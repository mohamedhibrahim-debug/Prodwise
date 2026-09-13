import type { ClaimWithEvidence, ReviewFinding } from "../domain/types.ts";
import { detectConflicts } from "./rules/conflict.ts";
import { detectSuperseded } from "./rules/superseded.ts";

/**
 * The review engine.
 *
 * A pure function of an initiative's Product Memory: same claims in, byte-
 * identical findings out, whatever order they arrive in and whatever the clock
 * says. Nothing here reads the database, the environment or the time — which is
 * what makes findings reproducible, testable without a build step, and fully
 * derivable in the read-only public demo.
 *
 * Findings are never stored. They are recomputed on every read, so they can
 * never drift from the claims they describe: edit a claim and the next render
 * reflects it with no refresh step, no job and no staleness window. Only the
 * human decision about a finding is persisted, keyed by its fingerprint.
 *
 * Slice 1 implements two of the five finding types. GAP, UNKNOWN and RISK are
 * NOT detected — and their absence from this output says nothing whatsoever
 * about whether they exist.
 */
export function runReview(
  initiativeId: string,
  claims: readonly ClaimWithEvidence[],
): ReviewFinding[] {
  // Guard the initiative boundary here as well as at the caller: a finding must
  // never be built from a claim belonging to another initiative.
  const scoped = claims.filter((c) => c.initiativeId === initiativeId);

  return [
    ...detectConflicts(initiativeId, scoped),
    ...detectSuperseded(initiativeId, scoped),
  ].sort(compareFindings);
}

/**
 * A total order, so output is stable no matter how the input was ordered.
 *
 * Note what is NOT here: severity. Slice 1 findings carry none, so any ranking
 * by importance would be invented. Actionable work sorts above history because
 * that is a derived fact, not a judgement; the remaining keys exist only to
 * make the order total and reproducible.
 */
export function compareFindings(a: ReviewFinding, b: ReviewFinding): number {
  if (a.actionable !== b.actionable) return a.actionable ? -1 : 1;

  const aMs = Date.parse(a.detectedOn);
  const bMs = Date.parse(b.detectedOn);
  const aValid = !Number.isNaN(aMs);
  const bValid = !Number.isNaN(bMs);
  if (aValid && bValid && aMs !== bMs) return bMs - aMs;
  if (aValid !== bValid) return aValid ? -1 : 1;

  return a.fingerprint < b.fingerprint ? -1 : a.fingerprint > b.fingerprint ? 1 : 0;
}
