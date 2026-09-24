import test from "node:test";
import assert from "node:assert/strict";
import { submitDecisionForm } from "./submit.ts";
import { decisionError, STALE_DECISION_MESSAGE, CHOOSE_EXISTING_MESSAGE } from "./ui.ts";
import { SEED_CLAIMS, SEED_CLAIM_EVIDENCE } from "../data/fixtures/claims.ts";
import { SEED_EVIDENCE } from "../data/fixtures/evidence.ts";
import { runReview } from "../review/engine.ts";
import type { Repository } from "../data/repository.ts";
import type { ResolveConflictPlan } from "../domain/types.ts";

const initiativeId = "11111111-1111-4111-8111-111111111111";
const claims = SEED_CLAIMS.map((c) => ({ ...c, evidence: SEED_CLAIM_EVIDENCE
  .filter((l) => l.claimId === c.id).map((l) => SEED_EVIDENCE.find((e) => e.id === l.evidenceId)!) }));
const finding = runReview(initiativeId, claims).find((f) => f.type === "CONFLICT")!;
function fixture() {
  const writes: ResolveConflictPlan[] = [];
  const refreshes: string[] = [];
  const repo = { getInitiativeBySlug: async () => ({ id: initiativeId, slug: "merchant-flex-finance" }),
    listClaims: async () => structuredClone(claims), listFindingStates: async () => [],
    resolveConflict: async (plan: ResolveConflictPlan) => { writes.push(plan); return {}; },
  } as unknown as Repository;
  const form = new FormData();
  for (const [key, value] of Object.entries({ slug: "merchant-flex-finance", fingerprint: finding.fingerprint,
    contentDigest: finding.contentDigest, choice: "existing", chosenClaimId: finding.claims.find((c) => c.value === "27")!.claimId,
    rationale: "Confirmed with Finance" })) form.set(key, value);
  return { form, writes, refreshes, deps: { repo, actor: { id: null, label: "Demo reviewer" },
    assertWrite: () => {}, refresh: (slug: string) => refreshes.push(slug) } };
}
test("UI existing-value submission delegates the exact decision and refreshes only after persistence", async () => {
  const f = fixture();
  assert.deepEqual(await submitDecisionForm(f.form, f.deps, "decision"), { error: null, saved: true });
  assert.equal(f.writes[0]!.outcome, "CHOSE_EXISTING");
  assert.equal(f.writes[0]!.chosenClaimId, f.form.get("chosenClaimId"));
  assert.equal(f.writes[0]!.correctedValue, null);
  assert.deepEqual(f.refreshes, ["merchant-flex-finance"]);
});
test("UI corrected-value submission creates a corrected decision plan", async () => {
  const f = fixture(); f.form.set("choice", "corrected"); f.form.set("correctedValue", "28");
  assert.equal((await submitDecisionForm(f.form, f.deps, "decision")).error, null);
  assert.equal(f.writes[0]!.outcome, "CORRECTED_VALUE");
  assert.equal(f.writes[0]!.correctedValue, "28");
  assert.equal(f.writes[0]!.chosenClaimId, null);
});
test("UI refuses normalized duplicates server-side without persistence or refresh", async () => {
  const f = fixture(); f.form.set("choice", "corrected"); f.form.set("correctedValue", " ２７. ");
  assert.equal((await submitDecisionForm(f.form, f.deps, "decision")).error, CHOOSE_EXISTING_MESSAGE);
  assert.equal(f.writes.length, 0); assert.equal(f.refreshes.length, 0);
});
test("UI stale error is safe and leaves the submitted values intact", async () => {
  const f = fixture(); f.form.set("contentDigest", "old");
  assert.equal((await submitDecisionForm(f.form, f.deps, "decision")).error, STALE_DECISION_MESSAGE);
  assert.equal(f.form.get("rationale"), "Confirmed with Finance");
  assert.equal(f.writes.length, 0); assert.equal(f.refreshes.length, 0);
});
test("UI write-disabled boundary blocks decision and confirmer direct submissions", async () => {
  for (const kind of ["decision", "confirmer"] as const) {
    const f = fixture(); f.deps.assertWrite = () => { throw new Error("WRITE_DISABLED"); };
    f.deps.repo.getInitiativeBySlug = async () => { throw new Error("Must not reach repository"); };
    assert.match((await submitDecisionForm(f.form, f.deps, kind)).error!, /changes are disabled/);
    assert.equal(f.writes.length, 0); assert.equal(f.refreshes.length, 0);
  }
});
test("UI translates named refusals and never returns raw RPC text", () => {
  for (const code of ["CLAIM_STALE", "FINDING_STALE", "DECISION_STANDING", "DECISION_NOT_REOPENABLE",
    "CHOOSE_EXISTING_VALUE", "INVALID_CONFIRMER", "DECISION_IMMUTABLE"]) {
    const copy = decisionError(new Error(`RPC failed: ${code}`));
    assert.doesNotMatch(copy, /RPC|[A-Z]+_[A-Z]+/);
    assert.notEqual(copy, "Could not save this change. Reload and try again.");
  }
  assert.equal(decisionError(new Error("SQL secret details")), "Could not save this change. Reload and try again.");
});
