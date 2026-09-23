import test from "node:test";
import assert from "node:assert/strict";
import { upgradeStoreShape } from "./store-upgrade.ts";

test("local store upgrade is idempotent and preserves claim timestamps", () => {
  const legacy = {
    initiatives: [], evidence: [], sources: [], findingStates: [],
    activity: [{ id: "a", initiativeId: "i", eventType: "X", summary: "x", occurredAt: "t" }],
    claims: [{
      id: "c", initiativeId: "i", type: "RISK", status: "UNVERIFIED",
      subject: "s", attribute: "a", value: "v", domain: "RISK", phase: null,
      confidence: null, supersededByClaimId: null, createdBy: null,
      createdAt: "created-raw", updatedAt: "updated-raw",
    }],
    claimEvidence: [{ claimId: "c", evidenceId: "e", createdAt: "linked-raw" }],
  };
  const once = upgradeStoreShape(legacy as never);
  const twice = upgradeStoreShape(structuredClone(once));
  assert.deepEqual(twice, once);
  assert.equal(once.claims[0]!.origin, "LEGACY");
  assert.equal(once.claims[0]!.updatedAt, "updated-raw");
  assert.equal(once.claimEvidence[0]!.locator, null);
  assert.equal(once.activity[0]!.entityType, null);
});
