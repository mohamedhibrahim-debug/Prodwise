import test from "node:test";
import assert from "node:assert/strict";
import { glance, TONE } from "./presentation.ts";
import type { Notification } from "./model.ts";

const n = (fingerprint: string, at: string, forMe = true, type: Notification["type"] = "COMMITMENT_OVERDUE"): Notification =>
  ({ fingerprint, type, kind: "DUE", title: `t-${fingerprint}`, detail: `d-${fingerprint}`, initiativeId: "i", initiativeName: "Initiative", href: "/x", at, forMe });

test("groups by recency against the page's today, newest first", () => {
  const items = [n("a", "2026-09-29T08:00:00Z"), n("b", "2026-09-25T08:00:00Z"), n("c", "2026-09-01T08:00:00Z")];
  const g = glance(items, new Set(), { scope: "mine", unreadOnly: false, today: "2026-09-29" });
  assert.deepEqual(g.groups.map(x => [x.key, x.items.map(i => i.fingerprint)]), [["today", ["a"]], ["week", ["b"]], ["earlier", ["c"]]]);
});
test("for me vs everything, unread only, and counts that do not depend on the view", () => {
  const items = [n("a", "2026-09-29T08:00:00Z"), n("b", "2026-09-28T08:00:00Z", false)];
  const read = new Set(["a"]);
  const mine = glance(items, read, { scope: "mine", unreadOnly: true, today: "2026-09-29" });
  assert.equal(mine.total, 0); assert.deepEqual(mine.unread, { mine: 0, all: 1 });
  const all = glance(items, read, { scope: "all", unreadOnly: false, today: "2026-09-29" });
  assert.equal(all.total, 2); assert.equal(all.groups.flatMap(g => g.items).find(i => i.fingerprint === "a")!.unread, false);
});
test("the list is capped and carries no workspace identifiers or links", () => {
  const items = Array.from({ length: 40 }, (_, i) => n(`f${i}`, `2026-09-${String(10 + (i % 19)).padStart(2, "0")}T08:00:00Z`));
  const g = glance(items, new Set(), { scope: "mine", unreadOnly: false, today: "2026-09-29", limit: 30 });
  const flat = g.groups.flatMap(x => x.items);
  assert.equal(flat.length, 30); assert.equal(g.total, 40);
  for (const item of flat) { assert.equal("href" in item, false); assert.equal("initiativeId" in item, false); }
});
test("every type has a tone, glyph and label", () => {
  for (const t of Object.values(TONE)) { assert.ok(t.glyph && t.label && t.tone); }
});
