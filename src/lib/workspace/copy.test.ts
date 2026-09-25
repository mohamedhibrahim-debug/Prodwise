import assert from "node:assert/strict";
import { test } from "node:test";
import type { ActivityEntry, ReviewFinding } from "../domain/types.ts";
import { activitySummary, attentionSentence, isStructuredActivity } from "./copy.ts";

const event = (eventType: string, payload: ActivityEntry["payload"], summary = "active contracts") =>
  ({ eventType, payload, summary }) as ActivityEntry;

test("typed activity renders structurally and unknown human text stays unchanged", () => {
  assert.equal(activitySummary(event("FINDING_CONFIRMER_ASSIGNED", { label: "Mona" })), "Confirmer assigned: Mona");
  assert.equal(activitySummary(event("FINDING_DECIDED", { subject: "Daily Repayment", attribute: "Calculation Divisor" })),
    "Decision recorded: Daily Repayment — Calculation Divisor");
  assert.equal(activitySummary(event("FINDING_RESOLVED", { subject: "Daily Repayment" })),
    "Reviewed — note only: Daily Repayment");
  assert.equal(activitySummary(event("FINDING_REOPENED", {})), "Reviewed item reopened");
  assert.equal(activitySummary(event("CLAIM_VERIFIED", { subject: "Daily Repayment" })), "Daily Repayment confirmed");
  assert.equal(activitySummary(event("LEGACY", null)), "active contracts");
  assert.equal(activitySummary(event("FINDING_DECIDED", null)), "Decision recorded");
});

test("known activity never displays a stored engine summary when payload is absent", () => {
  assert.equal(activitySummary(event("FINDING_RESOLVED", null, "finding marked resolved")), "Reviewed — note only");
  assert.equal(activitySummary(event("FINDING_CONFIRMER_ASSIGNED", { label: null }, "Finding confirmer changed")), "Confirmer cleared");
  assert.equal(activitySummary(event("CLAIM_VERIFIED", null, "active claims")), "Knowledge entry confirmed");
  assert.equal(activitySummary(event("FINDING_REOPENED", null, "Finding reopened")), "Reviewed item reopened");
});

test("local and Supabase-shaped events display the same copy", () => {
  for (const type of ["FINDING_RESOLVED", "CLAIM_VERIFIED"]) {
    const local = event(type, null, "local summary");
    const supabase = event(type, { entityType: "finding" }, "remote summary");
    assert.equal(activitySummary(local), activitySummary(supabase));
    assert.equal(isStructuredActivity(local), true);
  }
  assert.equal(isStructuredActivity(event("LEGACY", null)), false);
  assert.equal(activitySummary(event("LEGACY", null, "active contracts")), "active contracts");
});

test("attention names confirmed differing values without a click", () => {
  const finding = { subject: "Daily Repayment", title: "Values differ",
    claims: [{ attribute: "Calculation Divisor", value: "27", status: "ACTIVE" },
      { attribute: "Calculation Divisor", value: "30", status: "ACTIVE" }] } as ReviewFinding;
  assert.equal(attentionSentence(finding), "Daily Repayment — Calculation Divisor has two confirmed values: 27 and 30.");
  assert.match(attentionSentence({ ...finding, claims: [...finding.claims,
    { ...finding.claims[0]!, value: "31" }] }), /has 3 confirmed values: 27, 30 and 1 more/);
});
