import test from "node:test";
import assert from "node:assert/strict";
import { SEED_CLAIMS, SEED_CLAIM_EVIDENCE } from "../data/fixtures/claims.ts";
import { SEED_EVIDENCE } from "../data/fixtures/evidence.ts";
import { runReview } from "./engine.ts";

test("Merchant Flex Finance retains its accepted conflict and supersession identities", () => {
  const claims = SEED_CLAIMS.map((claim) => ({
    ...claim,
    evidence: SEED_CLAIM_EVIDENCE
      .filter((link) => link.claimId === claim.id)
      .map((link) => SEED_EVIDENCE.find((item) => item.id === link.evidenceId))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
  }));
  const findings = runReview("11111111-1111-4111-8111-111111111111", claims);
  assert.equal(findings.filter((finding) => finding.type === "CONFLICT").length, 1);
  assert.equal(findings.filter((finding) => finding.type === "SUPERSEDED").length, 1);
  const conflict = findings.find((finding) => finding.type === "CONFLICT")!;
  assert.equal(conflict.fingerprint, "f2f628a25ea8bcf38ef8db92896bbcc1f61b20e159c3d7635ed85c98dd84f5ca");
  assert.equal(conflict.detectedOn, "2026-08-21T00:00:00.000Z");
});
