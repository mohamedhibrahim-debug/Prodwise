import test from "node:test";
import assert from "node:assert/strict";
import { assertConfirmedContentUnchanged, contentChanges } from "./claim-content.ts";

const claim = { type: "REQUIREMENT" as const, subject: "Daily Repayment", attribute: "Calculation Divisor", value: "27", domain: "FINANCE" as const, phase: "Phase 1", status: "ACTIVE" as const };

test("a confirmed entry's content cannot change in place", () => {
  assert.throws(() => assertConfirmedContentUnchanged(claim, { value: "30" }), /confirmed/);
  assert.throws(() => assertConfirmedContentUnchanged(claim, { subject: "Other" }), /confirmed/);
  assert.throws(() => assertConfirmedContentUnchanged(claim, { phase: null }), /confirmed/);
});

test("status moves, identical resubmits and unconfirmed entries are allowed", () => {
  assert.doesNotThrow(() => assertConfirmedContentUnchanged(claim, { status: "SUPERSEDED", supersededByClaimId: "x" }));
  assert.doesNotThrow(() => assertConfirmedContentUnchanged(claim, { value: " 27 ", subject: "Daily Repayment", phase: "Phase 1" }));
  assert.doesNotThrow(() => assertConfirmedContentUnchanged({ ...claim, status: "UNVERIFIED" }, { value: "30" }));
  assert.deepEqual(contentChanges(claim, { value: "30", type: "DECISION" }), ["type", "value"]);
});
