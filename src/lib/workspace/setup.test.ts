import assert from "node:assert/strict";
import { test } from "node:test";

import { deriveSetup, type SetupInput } from "./setup.ts";

const ev = (boundary: string, createdAt = "2026-01-01T00:00:00Z") =>
  ({ boundary, createdAt }) as SetupInput["evidence"][number];
const claim = (status: string) =>
  ({ status }) as SetupInput["claims"][number];
const finding = (status: "OPEN" | "RESOLVED", actionable: boolean) => ({
  status,
  actionable,
});

const states = (input: SetupInput) =>
  deriveSetup(input).steps.map((s) => `${s.key}:${s.state}`);

test("a new initiative is in setup mode with Connect Sources current", () => {
  const p = deriveSetup({ evidence: [], claims: [], findings: [] });
  assert.equal(p.mode, "setup");
  assert.equal(p.current, "sources");
  assert.equal(p.complete, false);
  assert.equal(p.doneCount, 0);
  assert.deepEqual(states({ evidence: [], claims: [], findings: [] }), [
    "sources:current",
    "memory:waiting",
    "decisions:waiting",
    "readiness:not_assessed",
    "status:not_assessed",
  ]);
});

test("exactly one step is current at a time", () => {
  const inputs: SetupInput[] = [
    { evidence: [], claims: [], findings: [] },
    { evidence: [ev("CURRENT_SCOPE")], claims: [], findings: [] },
    {
      evidence: [ev("CURRENT_SCOPE")],
      claims: [claim("ACTIVE")],
      findings: [finding("OPEN", true)],
    },
  ];
  for (const input of inputs) {
    const current = deriveSetup(input).steps.filter(
      (s) => s.state === "current",
    );
    assert.equal(current.length, 1);
  }
});

test("only CURRENT_SCOPE and FUTURE_PHASE evidence satisfies Connect Sources", () => {
  for (const boundary of ["HISTORICAL", "RELATED", "EXCLUDED"]) {
    const p = deriveSetup({ evidence: [ev(boundary)], claims: [], findings: [] });
    assert.equal(p.current, "sources", boundary);
    assert.equal(p.facts.evidenceTotal, 1);
    assert.equal(p.facts.evidenceInScope, 0);
  }
  const future = deriveSetup({
    evidence: [ev("FUTURE_PHASE")],
    claims: [],
    findings: [],
  });
  assert.equal(future.current, "memory");
});

test("unverified claims are not trusted knowledge", () => {
  const p = deriveSetup({
    evidence: [ev("CURRENT_SCOPE")],
    claims: [claim("UNVERIFIED"), claim("DRAFT")],
    findings: [],
  });
  assert.equal(p.mode, "setup");
  assert.equal(p.current, "memory");
  assert.equal(p.facts.claimsUnverified, 1);
});

test("an ACTIVE claim switches to operating without implying setup is complete", () => {
  const p = deriveSetup({
    evidence: [ev("CURRENT_SCOPE")],
    claims: [claim("ACTIVE")],
    findings: [finding("OPEN", true)],
  });
  assert.equal(p.mode, "operating");
  assert.equal(p.current, "decisions");
  assert.equal(p.complete, false);
});

test("decisions are not done while memory is empty, even with nothing open", () => {
  const p = deriveSetup({
    evidence: [ev("CURRENT_SCOPE")],
    claims: [],
    findings: [],
  });
  const decisions = p.steps.find((s) => s.key === "decisions");
  assert.equal(decisions?.state, "waiting");
});

test("history and resolved findings are not open decisions", () => {
  const p = deriveSetup({
    evidence: [ev("CURRENT_SCOPE")],
    claims: [claim("ACTIVE"), claim("SUPERSEDED")],
    findings: [finding("OPEN", false), finding("RESOLVED", true)],
  });
  assert.equal(p.facts.decisionsOpen, 0);
  assert.equal(p.facts.claimsSuperseded, 1);
  assert.equal(p.current, null);
});

test("readiness and status are never done, so setup is never complete yet", () => {
  const p = deriveSetup({
    evidence: [ev("CURRENT_SCOPE")],
    claims: [claim("ACTIVE")],
    findings: [],
  });
  assert.equal(p.doneCount, 3);
  assert.equal(p.complete, false);
  assert.equal(p.current, null);
  assert.deepEqual(
    p.steps.slice(3).map((s) => s.state),
    ["not_assessed", "not_assessed"],
  );
});

test("a step can be done out of order without becoming current", () => {
  // Claims recorded before any evidence is confirmed in scope.
  const p = deriveSetup({ evidence: [], claims: [claim("ACTIVE")], findings: [] });
  assert.equal(p.current, "sources");
  assert.equal(p.steps.find((s) => s.key === "memory")?.state, "done");
});

test("last added is the latest evidence createdAt", () => {
  const p = deriveSetup({
    evidence: [
      ev("CURRENT_SCOPE", "2026-02-01T00:00:00Z"),
      ev("RELATED", "2026-03-05T00:00:00Z"),
    ],
    claims: [],
    findings: [],
  });
  assert.equal(p.facts.evidenceLastAddedAt, "2026-03-05T00:00:00Z");
});

test("withdrawing the last active claim returns to setup without changing input", () => {
  const input: SetupInput = {
    evidence: [ev("CURRENT_SCOPE")],
    claims: [claim("REJECTED"), claim("SUPERSEDED")],
    findings: [finding("OPEN", false)],
  };
  const before = structuredClone(input);
  const p = deriveSetup(input);
  assert.equal(p.mode, "setup");
  assert.equal(p.current, "memory");
  assert.equal(p.facts.decisionsOpen, 0);
  assert.deepEqual(input, before);
});
