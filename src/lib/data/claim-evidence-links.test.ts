import test from "node:test";
import assert from "node:assert/strict";
import { partitionEvidenceLinks } from "./claim-evidence-links.ts";

test("unchanged claim-evidence links preserve their exact anchors", () => {
  const kept = {
    evidenceId: "evidence-kept",
    locator: "Section 4.2",
    excerpt: "The exact recorded excerpt.",
  };
  const removed = {
    evidenceId: "evidence-removed",
    locator: "Page 9",
    excerpt: "Historical excerpt.",
  };

  const result = partitionEvidenceLinks(
    [kept, removed],
    ["evidence-kept", "evidence-added"],
  );

  assert.equal(result.retained.length, 1);
  assert.strictEqual(result.retained[0], kept);
  assert.deepEqual(result.retained[0], {
    evidenceId: "evidence-kept",
    locator: "Section 4.2",
    excerpt: "The exact recorded excerpt.",
  });
  assert.deepEqual(result.removed, [removed]);
  assert.deepEqual(result.addedEvidenceIds, ["evidence-added"]);
});
