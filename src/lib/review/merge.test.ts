import test from "node:test";
import assert from "node:assert/strict";

import type { FindingState, ReviewFinding } from "../domain/types.ts";
import { applyFindingStates } from "./merge.ts";

function finding(over: Partial<ReviewFinding> = {}): ReviewFinding {
  return {
    fingerprint: "fp-1",
    contentDigest: "digest-1",
    initiativeId: "init-1",
    type: "CONFLICT",
    ruleId: "CONFLICT_SAME_ATTRIBUTE_V1",
    status: "OPEN",
    actionable: true,
    title: "Daily Repayment — Calculation Divisor",
    explanation: "…",
    reason: "…",
    subject: "Daily Repayment",
    domains: ["FINANCE"],
    phase: "Phase 1",
    claims: [],
    detectedOn: "2026-06-01T00:00:00.000Z",
    resolution: null,
    resolvedAt: null,
    confidence: null,
    severity: null,
    ...over,
  };
}

function state(over: Partial<FindingState> = {}): FindingState {
  return {
    initiativeId: "init-1",
    fingerprint: "fp-1",
    ruleId: "CONFLICT_SAME_ATTRIBUTE_V1",
    contentDigest: "digest-1",
    subject: "Daily Repayment",
    attribute: "Calculation Divisor",
    phase: "Phase 1",
    valuesRecorded: '["27","30"]',
    status: "RESOLVED",
    resolution: "27 confirmed with Finance.",
    resolvedAt: "2026-07-01T00:00:00.000Z",
    outcome: null, chosenClaimId: null, decisionClaimId: null,
    decidedValue: null, confirmedWith: null, actorId: null, actorLabel: null,
    confirmerLabel: null, confirmerSetAt: null, confirmerSetByLabel: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

test("no state row means OPEN", () => {
  const [f] = applyFindingStates([finding()], []);
  assert.equal(f!.status, "OPEN");
  assert.equal(f!.resolution, null);
});

test("a matching resolved row marks the finding resolved", () => {
  const [f] = applyFindingStates([finding()], [state()]);
  assert.equal(f!.status, "RESOLVED");
  assert.equal(f!.resolution, "27 confirmed with Finance.");
});

test("a state row for a different fingerprint is ignored", () => {
  const [f] = applyFindingStates([finding()], [state({ fingerprint: "other" })]);
  assert.equal(f!.status, "OPEN");
});

test("content changed since resolution -> reopened, note kept as history", () => {
  // The finding still derives under the same fingerprint, but what it contains
  // is no longer what the person decided about.
  const [f] = applyFindingStates(
    [finding({ contentDigest: "digest-2" })],
    [state({ contentDigest: "digest-1" })],
  );
  assert.equal(f!.status, "OPEN", "a stale resolution must not stand");
  assert.equal(
    f!.resolution,
    "27 confirmed with Finance.",
    "the earlier note is carried through, never silently dropped",
  );
});

test("unchanged content stays resolved even when timestamps move", () => {
  // detectedOn later than resolvedAt is NOT staleness on its own — a no-op save
  // bumps updatedAt without changing anything the finding shows.
  const [f] = applyFindingStates(
    [finding({ detectedOn: "2026-09-01T00:00:00.000Z" })],
    [state({ resolvedAt: "2026-07-01T00:00:00.000Z" })],
  );
  assert.equal(f!.status, "RESOLVED");
});

test("a row predating digests is treated as current, not reopened", () => {
  const [f] = applyFindingStates([finding()], [state({ contentDigest: null })]);
  assert.equal(f!.status, "RESOLVED");
});

test("merging never mutates its inputs", () => {
  const original = finding();
  const snapshot = { ...original };
  applyFindingStates([original], [state()]);
  assert.deepEqual(original, snapshot);
});
