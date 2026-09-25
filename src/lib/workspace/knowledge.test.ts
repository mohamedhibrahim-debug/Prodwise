import assert from "node:assert/strict";
import { test } from "node:test";
import { trustLine } from "../domain/trust.ts";
import type { FindingState, MemoryClaim } from "../domain/types.ts";
import { decisionMarkers, groupKnowledge, replacementLineage } from "./knowledge.ts";

const entry = (id: string, value: string, phase: string | null, status: MemoryClaim["status"] = "ACTIVE") =>
  ({ id, subject: "Daily Repayment", attribute: "Calculation Divisor", phase, value, status,
    origin: "LEGACY", verifiedAt: null, verifiedActorId: null, verifiedActorLabel: null,
    verificationBasis: null, verificationNote: null, evidence: [], anchors: [],
    supersededByClaimId: null }) as unknown as MemoryClaim;
const decision = (outcome: FindingState["outcome"], claimId: string) =>
  ({ fingerprint: "decision-1", outcome, chosenClaimId: outcome === "CHOSE_EXISTING" ? claimId : null,
    decisionClaimId: outcome === "CORRECTED_VALUE" ? claimId : null,
    resolvedAt: "2026-09-20T00:00:00Z" }) as FindingState;

test("legacy provenance never invents a verification", () => {
  assert.equal(trustLine(entry("a", "27", null)), "Verification history not recorded.");
});
test("decision markers distinguish chosen and corrected values", () => {
  const chosen = decisionMarkers(entry("a", "27", null), [decision("CHOSE_EXISTING", "a")]);
  assert.equal(chosen[0]?.label, "Chosen in a decision");
  const corrected = decisionMarkers(entry("b", "30", null), [decision("CORRECTED_VALUE", "b")]);
  assert.equal(corrected[0]?.label, "Set by decision · Entered as a corrected value");
  const unlinked = { ...entry("c", "31", null), origin: "HUMAN_DECISION" as const, createdAt: "2026-09-19T00:00:00Z" };
  assert.deepEqual(decisionMarkers(unlinked, []).map((marker) => marker.fingerprint), [null]);
});
test("replacement lineage resolves both directions from loaded entries", () => {
  const prior = { ...entry("a", "27", null, "SUPERSEDED"), supersededByClaimId: "b" };
  const next = entry("b", "30", null);
  assert.equal(replacementLineage(prior, [prior, next]).replacedBy?.value, "30");
  assert.deepEqual(replacementLineage(next, [prior, next]).replaces.map((item) => item.value), ["27"]);
});
test("identical normalized values in different phases stay separate", () => {
  const groups = groupKnowledge([entry("a", "27", "Phase 1"), entry("b", " 27 ", "Phase 2")]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.phase), ["Phase 1", "Phase 2"]);
});
test("mixed-status groups retain each underlying status and provenance", () => {
  const confirmed = entry("a", "27", null);
  const unconfirmed = entry("b", " 27 ", null, "UNVERIFIED");
  confirmed.evidence = [{ id: "source-a" } as MemoryClaim["evidence"][number]];
  unconfirmed.evidence = [{ id: "source-b" } as MemoryClaim["evidence"][number]];
  const groups = groupKnowledge([confirmed, unconfirmed]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0]?.entries.map((item) => item.status), ["ACTIVE", "UNVERIFIED"]);
  assert.deepEqual(groups[0]?.entries.flatMap((item) => item.evidence.map((source) => source.id)), ["source-a", "source-b"]);
});
