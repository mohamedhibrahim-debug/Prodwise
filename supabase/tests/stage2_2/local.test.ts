import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const originalCwd = process.cwd();
const directory = mkdtempSync(join(tmpdir(), "prodwise-s22-local-"));
process.chdir(directory);
process.env.DEMO_WRITE_ENABLED = "true";
process.env.VERCEL_ENV = "development";

const { localRepository } = await import("../../../src/lib/data/local-repository.ts");
const { writeStoreAtomic, readStore, writeStore } = await import("../../../src/lib/data/store.ts");
const { runReview } = await import("../../../src/lib/review/engine.ts");
const { decideConflict, assignConfirmer } = await import("../../../src/lib/decisions/decide.ts");

const initiativeId = "11111111-1111-4111-8111-111111111111";
const actor = { id: null, label: "Local reviewer" };
after(() => {
  process.chdir(originalCwd);
  rmSync(directory, { recursive: true, force: true });
});

test("local adapter decides, audits and retains prior decision through re-emergence", async () => {
    const claims = await localRepository.listClaims(initiativeId);
    const finding = runReview(initiativeId, claims).find((item) => item.type === "CONFLICT")!;
    const chosen = claims.find((claim) => claim.id === finding.claims.find((ref) => ref.value === "27")!.claimId)!;
    const before = structuredClone(chosen);
    await assignConfirmer(localRepository, { initiativeId, fingerprint: finding.fingerprint,
      label: "Finance owner", actor });
    const result = await decideConflict(localRepository, { initiativeId,
      fingerprint: finding.fingerprint, contentDigest: finding.contentDigest,
      outcome: "CHOSE_EXISTING", chosenClaimId: chosen.id, correctedValue: null,
      decisionDomain: null, rationale: "Checked with owner", actor });
    assert.equal(result.chosenClaimId, chosen.id);
    assert.equal(result.decisionClaimId, null);
    assert.deepEqual(await localRepository.getClaim(chosen.id), before);
    const after = await localRepository.listClaims(initiativeId);
    assert.equal(runReview(initiativeId, after).filter((item) => item.type === "CONFLICT").length, 0);
    assert.ok(runReview(initiativeId, after).some((item) => item.type === "SUPERSEDED"));
    const state = (await localRepository.listFindingStates(initiativeId))[0]!;
    assert.equal(state.confirmedWith, "Finance owner");
    assert.equal(state.confirmerLabel, null);
    await assert.rejects(localRepository.setFindingState(initiativeId, finding.fingerprint, {
      ruleId: finding.ruleId, contentDigest: finding.contentDigest, subject: finding.subject,
      attribute: finding.claims[0]!.attribute, phase: finding.phase,
      valuesRecorded: "27 | 30", resolution: "Note" }), /DECISION_IMMUTABLE/);
    await assert.rejects(localRepository.reopenFindingState(initiativeId, finding.fingerprint, actor),
      /DECISION_IMMUTABLE/);
    await assert.rejects(assignConfirmer(localRepository, { initiativeId,
      fingerprint: finding.fingerprint, label: "Another owner", actor }), /DECISION_STANDING/);
    writeStore((store) => {
      const newClaim = { ...store.claims.find((claim) => claim.id === chosen.id)!,
        id: "local-reemerged-30", value: "30", createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(), origin: "HUMAN_ENTRY" as const };
      store.claims.push(newClaim);
    });
    await assignConfirmer(localRepository, { initiativeId,
      fingerprint: finding.fingerprint, label: "Second owner", actor });
    const reemerged = (await localRepository.listFindingStates(initiativeId))[0]!;
    assert.equal(reemerged.confirmedWith, "Finance owner");
    assert.equal(reemerged.confirmerLabel, "Second owner");
    assert.equal(reemerged.outcome, "CHOSE_EXISTING");
    assert.equal((await localRepository.listActivity(initiativeId, 100))
      .filter((entry) => entry.eventType === "FINDING_CONFIRMER_ASSIGNED"
        && entry.payload?.cycle === "REEMERGED").length, 1);
    const firstDecision = (await localRepository.listActivity(initiativeId, 100))
      .find((entry) => entry.eventType === "FINDING_DECIDED")!;
    const currentFinding = runReview(initiativeId, await localRepository.listClaims(initiativeId))
      .find((item) => item.type === "CONFLICT")!;
    const corrected = await decideConflict(localRepository, { initiativeId,
      fingerprint: currentFinding.fingerprint, contentDigest: currentFinding.contentDigest,
      outcome: "CORRECTED_VALUE", chosenClaimId: null, correctedValue: " 28 ",
      decisionDomain: null, rationale: "Confirmed corrected divisor", actor });
    assert.equal(corrected.outcome, "CORRECTED_VALUE");
    const newClaim = (await localRepository.listClaims(initiativeId))
      .find((claim) => claim.id === corrected.decisionClaimId)!;
    assert.equal(newClaim.type, "DECISION");
    assert.equal(newClaim.status, "ACTIVE");
    assert.equal(newClaim.origin, "HUMAN_DECISION");
    assert.equal(newClaim.verificationBasis, "DIRECT_KNOWLEDGE");
    assert.equal(newClaim.verificationNote, "Confirmed corrected divisor");
    assert.deepEqual(newClaim.evidence, []);
    const finalState = (await localRepository.listFindingStates(initiativeId))[0]!;
    assert.equal(finalState.confirmedWith, "Second owner");
    assert.equal(finalState.confirmerLabel, null);
    const activity = await localRepository.listActivity(initiativeId, 100);
    assert.equal(activity.filter((entry) => entry.eventType === "FINDING_DECIDED").length, 2);
    assert.deepEqual(activity.find((entry) => entry.id === firstDecision.id), firstDecision);
    assert.equal(runReview(initiativeId, await localRepository.listClaims(initiativeId))
      .filter((item) => item.type === "CONFLICT").length, 0);
});

test("atomic local writer discards claim changes when audit construction fails", () => {
  const before = structuredClone(readStore());
  assert.throws(() => writeStoreAtomic((store) => {
    store.claims[0]!.status = "SUPERSEDED";
    throw new Error("audit failed");
  }), /audit failed/);
  assert.deepEqual(readStore(), before);
});
