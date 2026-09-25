import test from "node:test";
import assert from "node:assert/strict";
import { canOrdinaryUpdateStatus, FUTURE_PHASE_ERROR, trustLine, validateVerification, type VerificationCandidate } from "./trust.ts";
import type { ClaimStatus, MemoryClaim } from "./types.ts";

const base: VerificationCandidate = { status: "UNVERIFIED" as ClaimStatus, phase: null, updatedAt: "raw-1", evidence: [] };
const check = (over: Partial<typeof base>, basis: "EVIDENCE" | "DIRECT_KNOWLEDGE" = "EVIDENCE", note: string | null = null, expectedUpdatedAt = "raw-1") =>
  validateVerification({ ...base, ...over }, { basis, note, expectedUpdatedAt });

test("evidence verification boundary rules", () => {
  assert.equal(check({ evidence: [{ boundary: "CURRENT_SCOPE" }] }), null);
  assert.equal(check({ phase: "Phase 2", evidence: [{ boundary: "FUTURE_PHASE" }] }), null);
  assert.equal(check({ evidence: [{ boundary: "CURRENT_SCOPE" }, { boundary: "FUTURE_PHASE" }] }), null);
  assert.equal(check({ evidence: [{ boundary: "FUTURE_PHASE" }] }), FUTURE_PHASE_ERROR);
  for (const boundary of ["HISTORICAL", "RELATED", "EXCLUDED"] as const)
    assert.match(check({ evidence: [{ boundary }] })!, /current-scope/i);
  assert.match(check({ evidence: [] })!, /current-scope/i);
});

test("direct knowledge, state and raw staleness rules", () => {
  assert.equal(check({}, "DIRECT_KNOWLEDGE", "Owner confirmed"), null);
  assert.match(check({}, "DIRECT_KNOWLEDGE", "  ")!, /direct knowledge/i);
  assert.match(check({}, "EVIDENCE", null, "different")!, /changed/i);
  for (const status of ["ACTIVE", "SUPERSEDED", "REJECTED", "DEFERRED", "UNKNOWN"] as const)
    assert.match(check({ status })!, /unconfirmed or draft/i);
});

test("ordinary edits cannot activate a non-active claim", () => {
  for (const status of ["UNVERIFIED", "DRAFT", "SUPERSEDED", "REJECTED", "DEFERRED", "UNKNOWN"] as const)
    assert.equal(canOrdinaryUpdateStatus(status, "ACTIVE"), false);
  assert.equal(canOrdinaryUpdateStatus("ACTIVE", "ACTIVE"), true);
});

test("trust copy is scoped and exact", () => {
  const claim = { status: "ACTIVE", origin: "LEGACY", verifiedAt: null, verifiedActorId: null, verifiedActorLabel: null, verificationBasis: null, verificationNote: null } as MemoryClaim;
  assert.equal(trustLine(claim), "Confirmation history not recorded.");
  assert.equal(trustLine({ ...claim, origin: "HUMAN_ENTRY", verifiedAt: "2026-09-20T00:00:00Z" }), "Confirmed in demo · Sep 20, 2026");
  assert.equal(trustLine({ ...claim, status: "UNVERIFIED" }), null);
});
