import test from "node:test";
import assert from "node:assert/strict";
import { lookupFor } from "./route-lookup.ts";

test("record-bearing routes are recognised; everything else is left to the page", () => {
  assert.deepEqual(lookupFor("/initiatives/mff"), { initiative: "mff" });
  assert.deepEqual(lookupFor("/initiatives/mff/decisions"), { initiative: "mff" });
  assert.deepEqual(lookupFor("/initiatives/mff/evidence/abc"), { initiative: "mff", submission: "abc" });
  assert.deepEqual(lookupFor("/initiatives/mff/evidence/new"), { initiative: "mff" });
  assert.deepEqual(lookupFor("/initiatives/mff/knowledge/abc/edit"), { initiative: "mff", claim: "abc" });
  assert.deepEqual(lookupFor("/sources/abc"), { source: "abc" });
  assert.deepEqual(lookupFor("/analysis/projects/mff"), { initiative: "mff" });
  assert.equal(lookupFor("/initiatives/new"), null);
  assert.equal(lookupFor("/initiatives"), null);
  assert.equal(lookupFor("/weekly-review"), null);
});
