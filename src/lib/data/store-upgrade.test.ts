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

test("store upgrade gives legacy notes empty decision fields and preserves real decisions", () => {
  const base = {
    initiatives: [], evidence: [], sources: [], activity: [], claims: [], claimEvidence: [],
    findingStates: [
      { initiativeId: "i", fingerprint: "legacy", ruleId: "CONFLICT_SAME_ATTRIBUTE_V1",
        contentDigest: "digest", subject: "s", attribute: "a", phase: null,
        valuesRecorded: "27 | 30", status: "RESOLVED", resolution: "Note only",
        resolvedAt: "2026-01-01", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
      { initiativeId: "i", fingerprint: "decided", ruleId: "CONFLICT_SAME_ATTRIBUTE_V1",
        contentDigest: "digest", subject: "s", attribute: "a", phase: null,
        valuesRecorded: "27 | 30", status: "RESOLVED", resolution: "Chose 27",
        resolvedAt: "2026-01-02", createdAt: "2026-01-02", updatedAt: "2026-01-02",
        outcome: "CHOSE_EXISTING", chosenClaimId: "c27", decidedValue: "27",
        confirmedWith: "Finance owner", actorLabel: "Reviewer" },
    ],
  };
  const upgraded = upgradeStoreShape(base as never);
  assert.equal(upgraded.findingStates[0]!.outcome, null);
  assert.equal(upgraded.findingStates[0]!.resolution, "Note only");
  assert.equal(upgraded.findingStates[1]!.outcome, "CHOSE_EXISTING");
  assert.equal(upgraded.findingStates[1]!.chosenClaimId, "c27");
  assert.equal(upgraded.findingStates[1]!.confirmedWith, "Finance owner");
  assert.deepEqual(upgradeStoreShape(structuredClone(upgraded)), upgraded);
});
