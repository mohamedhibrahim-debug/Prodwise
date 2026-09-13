import test from "node:test";
import assert from "node:assert/strict";

import type { ClaimWithEvidence, EvidenceRecord } from "../domain/types.ts";
import { runReview } from "./engine.ts";

/**
 * EXCLUDED evidence must never be cited as the reference behind a value.
 *
 * A link made before the evidence left the initiative boundary is deliberately
 * kept (Phase 3 rule — dropping it would rewrite history), and it stays visible
 * in the finding, tagged. But naming it in the explanation as the source for a
 * value would present evidence a person removed from scope as if it still
 * backed the claim.
 */

const INIT = "init-1";
const T0 = "2026-06-01T00:00:00.000Z";

function ev(id: string, ref: string, boundary: EvidenceRecord["boundary"]): EvidenceRecord {
  return {
    id,
    initiativeId: INIT,
    sourceId: null,
    title: "Evidence " + ref,
    sourceType: "DOCUMENT",
    sourceReference: ref,
    sourceUrl: null,
    contentSummary: null,
    boundary,
    occurredAt: null,
    capturedAt: T0,
    lastVerifiedAt: null,
    createdBy: null,
    createdAt: T0,
    updatedAt: T0,
  };
}

function claim(over: Partial<ClaimWithEvidence> & { id: string }): ClaimWithEvidence {
  return {
    initiativeId: INIT,
    type: "REQUIREMENT",
    status: "ACTIVE",
    subject: "Daily Repayment",
    attribute: "Calculation Divisor",
    value: "27",
    domain: "FINANCE",
    phase: "Phase 1",
    confidence: null,
    supersededByClaimId: null,
    createdBy: null,
    createdAt: T0,
    updatedAt: T0,
    evidence: [],
    ...over,
  };
}

test("an EXCLUDED reference is not cited in the explanation", () => {
  const [f] = runReview(INIT, [
    // Sorts first by id, so a boundary-blind implementation would pick it.
    claim({ id: "a", value: "27", evidence: [ev("e-1", "EXCLUDED-REF", "EXCLUDED")] }),
    claim({ id: "b", value: "30", evidence: [ev("e-2", "MFF-133", "CURRENT_SCOPE")] }),
  ]);

  assert.doesNotMatch(f!.explanation, /EXCLUDED-REF/);
  assert.match(f!.explanation, /MFF-133/);
});

test("an in-scope reference is still cited when an excluded one sorts first", () => {
  const [f] = runReview(INIT, [
    claim({
      id: "a",
      value: "27",
      evidence: [
        ev("e-1", "EXCLUDED-REF", "EXCLUDED"),
        ev("e-2", "MFF-118", "CURRENT_SCOPE"),
      ],
    }),
    claim({ id: "b", value: "30" }),
  ]);

  assert.match(f!.explanation, /27 \(MFF-118\)/);
  assert.doesNotMatch(f!.explanation, /EXCLUDED-REF/);
});

test("the excluded link is still carried on the finding, not dropped", () => {
  const [f] = runReview(INIT, [
    claim({ id: "a", value: "27", evidence: [ev("e-1", "EXCLUDED-REF", "EXCLUDED")] }),
    claim({ id: "b", value: "30" }),
  ]);

  const carried = f!.claims[0]!.evidence;
  assert.equal(carried.length, 1, "provenance is preserved, never rewritten");
  assert.equal(carried[0]!.boundary, "EXCLUDED", "and stays marked as excluded");
});
