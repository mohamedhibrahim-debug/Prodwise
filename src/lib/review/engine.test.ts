import test from "node:test";
import assert from "node:assert/strict";

import type { ClaimWithEvidence, EvidenceRecord } from "../domain/types.ts";
import { runReview } from "./engine.ts";

/* ── Fixtures ─────────────────────────────────────────────────────────────
   Plain data in, plain data out. The engine touches no database, no clock and
   no environment, so these tests need none of them. */

const INIT = "init-1";
const T0 = "2026-06-01T00:00:00.000Z";

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

function evidence(id: string, sourceReference: string): EvidenceRecord {
  return {
    id,
    initiativeId: INIT,
    sourceId: null,
    title: "Evidence " + sourceReference,
    sourceType: "DOCUMENT",
    sourceReference,
    sourceUrl: null,
    contentSummary: null,
    boundary: "CURRENT_SCOPE",
    occurredAt: null,
    capturedAt: T0,
    lastVerifiedAt: null,
    createdBy: null,
    createdAt: T0,
    updatedAt: T0,
  };
}

/** The real seeded pair: divisor 27 (MFF-118) vs 30 (MFF-133). */
function divisorPair(): ClaimWithEvidence[] {
  return [
    claim({ id: "c-27", value: "27", evidence: [evidence("e-1", "MFF-118")] }),
    claim({ id: "c-30", value: "30", evidence: [evidence("e-2", "MFF-133")] }),
  ];
}

const conflicts = (cs: ClaimWithEvidence[]) =>
  runReview(INIT, cs).filter((f) => f.type === "CONFLICT");
const superseded = (cs: ClaimWithEvidence[]) =>
  runReview(INIT, cs).filter((f) => f.type === "SUPERSEDED");

/* ── True positives ──────────────────────────────────────────────────────── */

test("27 vs 30, same subject/attribute/phase, both ACTIVE -> exactly 1 CONFLICT", () => {
  const found = conflicts(divisorPair());
  assert.equal(found.length, 1);

  const f = found[0]!;
  assert.equal(f.claims.length, 2);
  assert.deepEqual(
    f.claims.map((c) => c.claimId),
    ["c-27", "c-30"],
    "claims are ordered by id so column order is stable",
  );
  assert.equal(f.actionable, true);
  assert.equal(f.severity, null, "no severity is invented");
  assert.equal(f.confidence, null, "a deterministic rule has no confidence");
  assert.deepEqual(f.domains, ["FINANCE"]);
  assert.equal(f.phase, "Phase 1");
  assert.match(f.explanation, /27 \(MFF-118\)/);
  assert.match(f.explanation, /30 \(MFF-133\)/);
  assert.match(f.explanation, /not determined which value is correct/);
});

test("the explanation never asserts a contradiction or a winner", () => {
  const f = conflicts(divisorPair())[0]!;
  for (const banned of [/contradicts/i, /incorrect/i, /should be/i, /the correct value/i]) {
    assert.doesNotMatch(f.explanation, banned);
  }
});

test("three differing ACTIVE values -> ONE grouped conflict, not three pairs", () => {
  const found = conflicts([
    claim({ id: "a", value: "27" }),
    claim({ id: "b", value: "30" }),
    claim({ id: "c", value: "31" }),
  ]);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.claims.length, 3);
  assert.match(found[0]!.explanation, /^These three active claims do not record the same value/);
});

test("SUPERSEDED claim with a replacement -> 1 finding naming it", () => {
  const found = superseded([
    claim({
      id: "old",
      status: "SUPERSEDED",
      supersededByClaimId: "new",
      value: "Traditional + Islamic",
    }),
    claim({ id: "new", value: "Islamic Only" }),
  ]);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.actionable, false, "history is never actionable");
  assert.match(found[0]!.explanation, /replacement is recorded/);
  assert.match(found[0]!.explanation, /Islamic Only/);
});

test("SUPERSEDED claim with no replacement -> honest wording, no invented successor", () => {
  const found = superseded([claim({ id: "old", status: "SUPERSEDED" })]);
  assert.equal(found.length, 1);
  assert.match(found[0]!.explanation, /No replacement has been recorded/);
  assert.match(found[0]!.explanation, /does not infer a successor/);
});

/* ── False positives: none of these may raise a CONFLICT ──────────────────── */

test("an explicit supersession pair is history, not a conflict", () => {
  assert.equal(
    conflicts([
      claim({
        id: "old",
        status: "SUPERSEDED",
        supersededByClaimId: "new",
        value: "Traditional",
      }),
      claim({ id: "new", value: "Islamic" }),
    ]).length,
    0,
  );
});

test("gate 7 holds even if the status invariant is relaxed", () => {
  // Both ACTIVE but linked by supersession: gate 5 would let this through, so
  // this proves gate 7 is doing independent work.
  assert.equal(
    conflicts([
      claim({ id: "old", value: "27", supersededByClaimId: "new" }),
      claim({ id: "new", value: "30" }),
    ]).length,
    0,
  );
});

test("different phases are not comparable", () => {
  assert.equal(
    conflicts([
      claim({ id: "a", value: "27", phase: "Phase 1" }),
      claim({ id: "b", value: "30", phase: "Phase 2" }),
    ]).length,
    0,
  );
});

test("a stated phase and an absent phase are not comparable", () => {
  assert.equal(
    conflicts([
      claim({ id: "a", value: "27", phase: "Phase 1" }),
      claim({ id: "b", value: "30", phase: null }),
    ]).length,
    0,
  );
});

test("a blank phase is treated as absent, not as a third context", () => {
  assert.equal(
    conflicts([
      claim({ id: "a", value: "27", phase: "   " }),
      claim({ id: "b", value: "30", phase: null }),
    ]).length,
    1,
  );
});

for (const status of ["DRAFT", "REJECTED", "DEFERRED", "UNKNOWN", "UNVERIFIED"] as const) {
  test(status + " vs ACTIVE raises nothing — unchecked is not false", () => {
    assert.equal(
      conflicts([
        claim({ id: "a", value: "27" }),
        claim({ id: "b", value: "30", status }),
      ]).length,
      0,
    );
  });
}

test("same subject, different attribute", () => {
  assert.equal(
    conflicts([
      claim({ id: "a", value: "27", attribute: "Calculation Divisor" }),
      claim({ id: "b", value: "30", attribute: "Rounding Rule" }),
    ]).length,
    0,
  );
});

test("same attribute, different subject (the real Required Capability pair)", () => {
  assert.equal(
    conflicts([
      claim({
        id: "a",
        subject: "Settlement Service",
        attribute: "Required Capability",
        value: "X",
      }),
      claim({
        id: "b",
        subject: "Disbursement Engine",
        attribute: "Required Capability",
        value: "Y",
      }),
    ]).length,
    0,
  );
});

test("identical values", () => {
  assert.equal(
    conflicts([claim({ id: "a", value: "27" }), claim({ id: "b", value: "27" })]).length,
    0,
  );
});

test("formatting-only differences are not disagreements", () => {
  assert.equal(
    conflicts([
      claim({ id: "a", value: "  Islamic   Financing  " }),
      claim({ id: "b", value: "islamic financing." }),
    ]).length,
    0,
  );
  assert.equal(
    conflicts([
      claim({ id: "a", subject: "Daily  Repayment", value: "27" }),
      claim({ id: "b", subject: "daily repayment", value: "27" }),
    ]).length,
    0,
  );
});

test("a single claim conflicts with nothing", () => {
  assert.equal(conflicts([claim({ id: "a" })]).length, 0);
});

test("claims from another initiative are excluded entirely", () => {
  const found = runReview(INIT, [
    claim({ id: "a", value: "27" }),
    claim({ id: "b", value: "30", initiativeId: "other-initiative" }),
  ]);
  assert.equal(found.length, 0);
});

test("blank subject, attribute or value never reaches a finding", () => {
  for (const field of ["subject", "attribute", "value"] as const) {
    assert.equal(
      conflicts([
        claim({ id: "a", value: "27" }),
        claim({ id: "b", value: "30", [field]: "   " }),
      ]).length,
      0,
      "blank " + field + " must be skipped",
    );
  }
});

/* ── Determinism ─────────────────────────────────────────────────────────── */

test("shuffled input produces identical output, order included", () => {
  const cs = [
    claim({ id: "c", value: "31" }),
    claim({ id: "a", value: "27" }),
    claim({ id: "b", value: "30" }),
    claim({ id: "s", status: "SUPERSEDED", subject: "Financing Model" }),
  ];
  const forward = runReview(INIT, cs);
  const reversed = runReview(INIT, [...cs].reverse());
  assert.deepEqual(reversed, forward);
});

test("repeated runs are byte-identical (no clock anywhere)", () => {
  const cs = divisorPair();
  assert.deepEqual(runReview(INIT, cs), runReview(INIT, cs));
});

test("evidence order in the input cannot change the output", () => {
  const withOrder = (ev: EvidenceRecord[]) =>
    runReview(INIT, [
      claim({ id: "c-27", value: "27", evidence: ev }),
      claim({ id: "c-30", value: "30" }),
    ]);
  const a = evidence("e-1", "MFF-118");
  const b = evidence("e-2", "MFF-133");
  assert.deepEqual(withOrder([a, b]), withOrder([b, a]));
});

test("changing a conflicting value changes the fingerprint", () => {
  const before = conflicts(divisorPair())[0]!.fingerprint;
  const after = conflicts([
    claim({ id: "c-27", value: "27" }),
    claim({ id: "c-30", value: "31" }),
  ])[0]!.fingerprint;
  assert.notEqual(before, after);
});

test("an unrelated edit leaves the finding's identity untouched", () => {
  const before = conflicts(divisorPair())[0]!.fingerprint;
  const after = conflicts([
    claim({
      id: "c-27",
      value: "27",
      type: "DECISION",
      updatedAt: "2026-09-09T00:00:00.000Z",
    }),
    claim({ id: "c-30", value: "30" }),
  ])[0]!.fingerprint;
  assert.equal(before, after);
});

test("detectedOn is the latest source updatedAt, never the clock", () => {
  const f = conflicts([
    claim({ id: "a", value: "27", updatedAt: "2026-06-01T00:00:00.000Z" }),
    claim({ id: "b", value: "30", updatedAt: "2026-08-20T10:00:00.000Z" }),
  ])[0]!;
  assert.equal(f.detectedOn, "2026-08-20T10:00:00.000Z");
});

test("an unparseable updatedAt degrades instead of throwing", () => {
  assert.doesNotThrow(() =>
    conflicts([
      claim({ id: "a", value: "27", updatedAt: "not-a-date" }),
      claim({ id: "b", value: "30", updatedAt: "also-bad" }),
    ]),
  );
});

/* ── Fingerprint safety (C1) ─────────────────────────────────────────────── */

test("a delimiter inside a field cannot forge another finding's identity", () => {
  const x = conflicts([
    claim({ id: "a", subject: "Repayment|Divisor", attribute: "Cap", value: "27" }),
    claim({ id: "b", subject: "Repayment|Divisor", attribute: "Cap", value: "30" }),
  ])[0]!;
  const y = conflicts([
    claim({ id: "a", subject: "Repayment", attribute: "Divisor|Cap", value: "27" }),
    claim({ id: "b", subject: "Repayment", attribute: "Divisor|Cap", value: "30" }),
  ])[0]!;
  assert.notEqual(x.fingerprint, y.fingerprint);
});

test("splitting a value into two claims does not inherit the old identity", () => {
  const joined = conflicts([
    claim({ id: "a", value: "27" }),
    claim({ id: "b", value: "30|31" }),
  ])[0]!;
  const split = conflicts([
    claim({ id: "a", value: "27" }),
    claim({ id: "b", value: "30" }),
    claim({ id: "c", value: "31" }),
  ])[0]!;
  assert.notEqual(joined.fingerprint, split.fingerprint);
});

test("two groups differing only by phase are distinguishable (C2)", () => {
  const found = conflicts([
    claim({ id: "a", value: "27", phase: "Phase 1" }),
    claim({ id: "b", value: "30", phase: "Phase 1" }),
    claim({ id: "c", value: "27", phase: null }),
    claim({ id: "d", value: "30", phase: null }),
  ]);
  assert.equal(found.length, 2);
  assert.notEqual(found[0]!.fingerprint, found[1]!.fingerprint);

  const phases = found.map((f) => f.phase).sort();
  assert.deepEqual(phases, ["Phase 1", null], "phase must be carried and differ");
});

test("the fingerprint is scoped to its initiative", () => {
  const a = runReview(
    "init-a",
    divisorPair().map((c) => ({ ...c, initiativeId: "init-a" })),
  );
  const b = runReview(
    "init-b",
    divisorPair().map((c) => ({ ...c, initiativeId: "init-b" })),
  );
  assert.notEqual(a[0]!.fingerprint, b[0]!.fingerprint);
});

test("rewriting a superseded claim's content changes its fingerprint (H12)", () => {
  const before = superseded([claim({ id: "old", status: "SUPERSEDED" })])[0]!.fingerprint;
  const after = superseded([
    claim({
      id: "old",
      status: "SUPERSEDED",
      subject: "Something Else",
      value: "Totally different",
    }),
  ])[0]!.fingerprint;
  assert.notEqual(before, after);
});

/* ── Malformed data ──────────────────────────────────────────────────────── */

test("cyclic supersession does not crash or hang", () => {
  assert.doesNotThrow(() => {
    const found = runReview(INIT, [
      claim({ id: "a", status: "SUPERSEDED", supersededByClaimId: "b" }),
      claim({ id: "b", status: "SUPERSEDED", supersededByClaimId: "a" }),
    ]);
    assert.equal(found.length, 2);
  });
});

test("a replacement pointing outside the initiative says so, and does not lie", () => {
  const f = superseded([
    claim({ id: "old", status: "SUPERSEDED", supersededByClaimId: "elsewhere" }),
  ])[0]!;
  assert.match(f.explanation, /not on this initiative/);
  assert.doesNotMatch(
    f.explanation,
    /No replacement has been recorded/,
    "a recorded-but-invisible replacement must not be reported as absent",
  );
});

test("empty input yields no findings", () => {
  assert.deepEqual(runReview(INIT, []), []);
});

/* ── Known limitation, pinned deliberately ───────────────────────────────── */

test("KNOWN LIMITATION: elaboration is indistinguishable from contradiction", () => {
  // Free-text values carry no type or unit, so the engine can prove only that
  // two strings differ — not that they disagree. This fires, and that is the
  // documented current behaviour. Solving it needs typed or controlled claim
  // values, NOT semantic similarity, which is out of scope for this slice.
  assert.equal(
    conflicts([
      claim({ id: "a", value: "6 months" }),
      claim({ id: "b", value: "6 months of continuous settlement activity" }),
    ]).length,
    1,
  );
});
