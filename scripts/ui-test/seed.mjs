// Test fixtures only; run before the isolated server starts.
import { readStore, writeStoreAtomic } from "../../src/lib/data/store.ts";
import { localRepository } from "../../src/lib/data/local-repository.ts";
import { runReview } from "../../src/lib/review/engine.ts";
import { decideConflict, assignConfirmer } from "../../src/lib/decisions/decide.ts";
const initiativeId = "11111111-1111-4111-8111-111111111111";
const actor = { id: null, label: "Demo reviewer" };
const localRepositoryClaims = await localRepository.listClaims(initiativeId);
const mismatch = runReview(initiativeId, localRepositoryClaims).find((f) => f.type === "CONFLICT");
const scenario = process.argv[2];
readStore();
if (scenario === "reemerged") {
  await assignConfirmer(localRepository, { initiativeId, fingerprint: mismatch.fingerprint, actor, label: "First owner" });
  await decideConflict(localRepository, { initiativeId, fingerprint: mismatch.fingerprint,
    contentDigest: mismatch.contentDigest, actor, outcome: "CHOSE_EXISTING",
    chosenClaimId: mismatch.claims.find((c) => c.value === "27").claimId,
    correctedValue: null, decisionDomain: null, rationale: "Prior decision rationale" });
  writeStoreAtomic((store) => {
    const old = store.claims.find((c) => c.subject === "Daily Repayment" && c.value === "30");
    store.claims.push({ ...old, id: "dddd0001-0000-4000-8000-000000000099", status: "ACTIVE", supersededByClaimId: null });
  });
  await assignConfirmer(localRepository, { initiativeId, fingerprint: mismatch.fingerprint, actor, label: "New owner" });
} else if (scenario === "legacy") {
  await assignConfirmer(localRepository, { initiativeId, fingerprint: mismatch.fingerprint, actor, label: "Hidden legacy owner" });
  await localRepository.setFindingState(initiativeId, mismatch.fingerprint, {
    ruleId: mismatch.ruleId, contentDigest: mismatch.contentDigest, subject: mismatch.subject,
    attribute: mismatch.claims[0].attribute, phase: mismatch.phase, valuesRecorded: "27 | 30",
    resolution: "Legacy review note" });
} else if (scenario === "refusals") {
  // A mixed-domain mismatch exercises the corrected decision's domain input.
  writeStoreAtomic((store) => {
    const competitor = store.claims.find((c) => c.subject === "Daily Repayment" && c.value === "30");
    competitor.domain = "TECHNICAL";
  });
} else {
  // Persist the lazy seed without modifying any fixture values.
  writeStoreAtomic(() => {});
}
