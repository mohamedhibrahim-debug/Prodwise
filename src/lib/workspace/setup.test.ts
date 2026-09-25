import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveSetup, type SetupInput } from "./setup.ts";

const source = (boundary: string) => ({ boundary, createdAt: "2026-01-01T00:00:00Z" }) as SetupInput["evidence"][number];
const entry = (status: string) => ({ status }) as SetupInput["claims"][number];
const progress = (evidence: SetupInput["evidence"], claims: SetupInput["claims"]) => deriveSetup({ evidence, claims, findings: [] });

test("setup requires an eligible Source, an entry, and a Confirmed entry independently", () => {
  const empty = progress([], []);
  assert.equal(empty.mode, "setup");
  assert.equal(empty.current, "sources");
  assert.deepEqual(empty.steps.map((step) => step.state), ["current", "waiting", "waiting", "descriptive"]);
  assert.equal(progress([source("CURRENT_SCOPE")], []).current, "record");
  const withEntry = progress([source("CURRENT_SCOPE")], [entry("UNVERIFIED")]);
  assert.equal(withEntry.current, "confirm");
  assert.equal(withEntry.complete, false);
  assert.equal(progress([], [entry("ACTIVE")]).mode, "setup");
  const directKnowledge = progress([source("CURRENT_SCOPE")], [entry("ACTIVE")]);
  assert.equal(directKnowledge.complete, true);
  assert.equal(directKnowledge.mode, "operating");
  assert.equal(directKnowledge.current, null);
});

test("only CURRENT_SCOPE and FUTURE_PHASE sources satisfy setup", () => {
  for (const boundary of ["HISTORICAL", "RELATED", "EXCLUDED"]) {
    assert.equal(progress([source(boundary)], [entry("ACTIVE")]).complete, false);
  }
  assert.equal(progress([source("FUTURE_PHASE")], [entry("ACTIVE")]).complete, true);
});

test("losing a required condition restores setup without hiding attention", () => {
  const input: SetupInput = { evidence: [source("CURRENT_SCOPE")], claims: [entry("ACTIVE")],
    findings: [{ status: "OPEN", actionable: true }] };
  assert.equal(deriveSetup(input).facts.decisionsOpen, 1);
  input.evidence = [];
  const after = deriveSetup(input);
  assert.equal(after.mode, "setup");
  assert.equal(after.facts.decisionsOpen, 1);
});
