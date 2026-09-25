import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveSetup, type SetupInput } from "./setup.ts";

const source = (boundary: string) => ({ boundary, createdAt: "2026-01-01T00:00:00Z" }) as SetupInput["evidence"][number];
const entry = (status: string, boundaries: string[] = []) => ({ status, evidence: boundaries.map(source) }) as SetupInput["claims"][number];
const progress = (evidence: SetupInput["evidence"], claims: SetupInput["claims"]) => deriveSetup({ evidence, claims, findings: [] });

test("setup requires an in-scope source, a Knowledge entry, and a sourced Confirmed entry", () => {
  const empty = progress([], []);
  assert.equal(empty.mode, "setup");
  assert.equal(empty.current, "sources");
  assert.deepEqual(empty.steps.map((step) => step.state), ["current", "waiting", "waiting", "descriptive"]);
  assert.equal(progress([source("CURRENT_SCOPE")], []).current, "record");
  const withEntry = progress([source("CURRENT_SCOPE")], [entry("UNVERIFIED")]);
  assert.equal(withEntry.current, "confirm");
  assert.equal(withEntry.complete, false);
  const confirmedWithoutSource = progress([source("CURRENT_SCOPE")], [entry("ACTIVE")]);
  assert.equal(confirmedWithoutSource.complete, false);
  assert.equal(confirmedWithoutSource.current, "confirm");
  const confirmedWithSource = progress([source("CURRENT_SCOPE")], [entry("ACTIVE", ["CURRENT_SCOPE"])]);
  assert.equal(confirmedWithSource.complete, true);
  assert.equal(confirmedWithSource.mode, "operating");
  assert.equal(confirmedWithSource.current, null);
});

test("only CURRENT_SCOPE and FUTURE_PHASE sources satisfy setup", () => {
  for (const boundary of ["HISTORICAL", "RELATED", "EXCLUDED"]) {
    assert.equal(progress([source(boundary)], [entry("ACTIVE", [boundary])]).complete, false);
  }
  assert.equal(progress([source("FUTURE_PHASE")], [entry("ACTIVE", ["FUTURE_PHASE"])]).complete, true);
});

test("losing a required condition restores setup without hiding attention", () => {
  const input: SetupInput = { evidence: [source("CURRENT_SCOPE")], claims: [entry("ACTIVE", ["CURRENT_SCOPE"])],
    findings: [{ status: "OPEN", actionable: true }] };
  assert.equal(deriveSetup(input).facts.decisionsOpen, 1);
  input.claims = [entry("ACTIVE")];
  const after = deriveSetup(input);
  assert.equal(after.mode, "setup");
  assert.equal(after.facts.decisionsOpen, 1);
});
