import test from "node:test";
import assert from "node:assert/strict";
import { SEED_CLAIMS, SEED_CLAIM_EVIDENCE } from "../data/fixtures/claims.ts";
import { SEED_EVIDENCE } from "../data/fixtures/evidence.ts";
import { runReview } from "../review/engine.ts";
import { applyFindingStates } from "../review/merge.ts";
import type { FindingState, ResolveConflictInput } from "../domain/types.ts";
import { planResolution } from "./plan.ts";

const initiativeId = "11111111-1111-4111-8111-111111111111";
const claims = SEED_CLAIMS.map((claim) => ({ ...claim, evidence: SEED_CLAIM_EVIDENCE
  .filter((link) => link.claimId === claim.id)
  .map((link) => SEED_EVIDENCE.find((item) => item.id === link.evidenceId)!)
  .filter(Boolean) }));
const finding = runReview(initiativeId, claims).find((item) => item.type === "CONFLICT")!;
const stamps = new Map(claims.map((claim) => [claim.id, claim.updatedAt]));
const actor = { id: null, label: "Reviewer" };

function input(patch: Partial<ResolveConflictInput> = {}): ResolveConflictInput {
  return { initiativeId, fingerprint: finding.fingerprint,
    contentDigest: finding.contentDigest, outcome: "CHOSE_EXISTING",
    chosenClaimId: finding.claims.find((claim) => claim.value === "27")!.claimId,
    correctedValue: null, decisionDomain: null, rationale: "Verified with owner",
    actor, ...patch };
}

test("choosing either existing value keeps every matching claim and supersedes competitors", () => {
  for (const value of ["27", "30"]) {
    const chosenClaimId = finding.claims.find((claim) => claim.value === value)!.claimId;
    const plan = planResolution(finding, input({ chosenClaimId }), stamps);
    assert.equal(plan.members.find((member) => member.id === chosenClaimId)?.keep, true);
    assert.equal(plan.members.filter((member) => member.keep).length, 1);
  }
});

test("corrected 28 plans one decision; equivalent existing value is refused", () => {
  const base = { outcome: "CORRECTED_VALUE" as const, chosenClaimId: null,
    decisionDomain: null };
  assert.equal(planResolution(finding, input({ ...base, correctedValue: " 28 " }), stamps)
    .correctedValue, "28");
  assert.throws(() => planResolution(finding, input({ ...base, correctedValue: "27" }), stamps),
    /CHOOSE_EXISTING_VALUE/);
});

test("stale digest and missing claim timestamp are refused", () => {
  assert.throws(() => planResolution(finding, input({ contentDigest: "stale" }), stamps),
    /FINDING_STALE/);
  assert.throws(() => planResolution(finding, input(), new Map()), /CLAIM_STALE/);
});

test("a prior decision is open on re-emergence even when the digest is identical", () => {
  const state: FindingState = { initiativeId, fingerprint: finding.fingerprint,
    ruleId: finding.ruleId, contentDigest: finding.contentDigest, subject: finding.subject,
    attribute: finding.claims[0]!.attribute, phase: finding.phase, valuesRecorded: "27 | 30",
    status: "RESOLVED", resolution: "Chose 27", resolvedAt: "2026-09-23T00:00:00Z",
    outcome: "CHOSE_EXISTING", chosenClaimId: finding.claims[0]!.claimId,
    decisionClaimId: null, decidedValue: "27", confirmedWith: null,
    actorId: null, actorLabel: "Reviewer", confirmerLabel: null,
    confirmerSetAt: null, confirmerSetByLabel: null,
    createdAt: "2026-09-23T00:00:00Z",
    updatedAt: "2026-09-23T00:00:00Z" };
  const merged = applyFindingStates([finding], [state])[0]!;
  assert.equal(merged.status, "OPEN");
  assert.equal(merged.previousDecision?.decidedValue, "27");
});
