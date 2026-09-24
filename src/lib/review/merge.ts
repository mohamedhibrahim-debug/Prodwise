import type { FindingState, ReviewFinding } from "../domain/types.ts";

/**
 * Applies the persisted human overlay to derived findings.
 *
 * Pure, so the staleness rule below is testable without a database.
 *
 * A derived finding with no state row is OPEN — absence is the default, not a
 * missing record.
 *
 * State rows with no matching finding are ignored here. They are not deleted:
 * a claim edit can make a finding stop deriving, and discarding the decision
 * immediately would throw away a person's reasoning the moment anything moved.
 */
export function applyFindingStates(
  findings: readonly ReviewFinding[],
  states: readonly FindingState[],
): ReviewFinding[] {
  const byFingerprint = new Map(states.map((s) => [s.fingerprint, s]));

  return findings.map((finding) => {
    const state = byFingerprint.get(finding.fingerprint);
    if (!state) return { ...finding, confirmerLabel: null };
    if (state.status !== "RESOLVED") return { ...finding, confirmerLabel: state.confirmerLabel };

    if (state.outcome) {
      // A real decision changed Knowledge. If the original conflict derives
      // again, it is a new decision cycle even if its digest repeats exactly.
      return {
        ...finding,
        status: "OPEN",
        actionable: true,
        resolution: null,
        resolvedAt: null,
        confirmerLabel: state.confirmerLabel,
        previousDecision: {
          outcome: state.outcome,
          decidedValue: state.decidedValue!,
          rationale: state.resolution!,
          decidedAt: state.resolvedAt!,
        },
      };
    }

    if (isStale(finding, state)) {
      // The claims behind this finding changed AFTER it was resolved, so the
      // resolution no longer describes what is on screen. Silently keeping it
      // would show "Resolved" against reasoning that has been overtaken —
      // and, because a fingerprint survives edits that do not touch the
      // compared values, that can happen without the finding changing at all.
      //
      // It reopens, and the earlier note is carried through as history rather
      // than dropped, so nothing a person wrote disappears without trace.
      return {
        ...finding,
        status: "OPEN",
        resolution: state.resolution,
        resolvedAt: state.resolvedAt,
        confirmerLabel: state.confirmerLabel,
      };
    }

    return {
      ...finding,
      status: "RESOLVED",
      resolution: state.resolution,
      resolvedAt: state.resolvedAt,
      confirmerLabel: null,
    };
  });
}

/**
 * True when the finding no longer contains what it contained when resolved.
 *
 * Compares content, not time. Timestamps cannot answer this:
 *
 *  - `detectedOn` is the maximum `updatedAt` across the SURVIVING claims, and a
 *    maximum does not move when a member is removed. Withdraw one claim from a
 *    three-claim conflict and every timestamp stays exactly where it was.
 *  - Evidence links never touch `claims.updated_at`, so re-linking or excluding
 *    provenance rewrites what a finding cites while the clock says nothing
 *    happened.
 *  - `resolvedAt` is always later than any `detectedOn` at the moment of
 *    resolving, so anything that changed between rendering the page and
 *    submitting the form could never be caught afterwards.
 *
 * The digest covers member claims, their values and their provenance, so all
 * three are visible. A state row written before digests existed has none; it is
 * treated as current rather than reopened en masse.
 */
export function isStale(finding: ReviewFinding, state: FindingState): boolean {
  if (!state.contentDigest) return false;
  return state.contentDigest !== finding.contentDigest;
}
