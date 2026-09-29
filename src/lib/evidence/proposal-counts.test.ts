import assert from "node:assert/strict";
import { test } from "node:test";
import { needsDecisionText, proposalCounts } from "./proposal-counts.ts";

const p = (id: string, status: string) => ({ id, status }) as Parameters<typeof proposalCounts>[0][number];

test("one consistent set of proposal numbers", () => {
  const counts = proposalCounts([p("a", "PENDING"), p("b", "PENDING"), p("c", "OUTDATED"), p("d", "CONFIRMED"), p("e", "SUPERSEDED_BY_HUMAN_ENTRY"), p("f", "REJECTED")], { b: { label: "x" } });
  assert.deepEqual(counts, { total: 6, accepted: 2, rejected: 1, needsDecision: 2, outdated: 1, alreadyRecorded: 1 });
  // Every proposal lands in exactly one bucket.
  assert.equal(counts.accepted + counts.rejected + counts.needsDecision + counts.alreadyRecorded, counts.total);
});

test("the wording is singular/plural aware and honest at zero", () => {
  assert.equal(needsDecisionText(0), "Nothing needs your decision");
  assert.equal(needsDecisionText(1), "1 needs your decision");
  assert.equal(needsDecisionText(3), "3 need your decision");
});
