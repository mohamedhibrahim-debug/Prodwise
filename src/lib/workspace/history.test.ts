import test from "node:test";
import assert from "node:assert/strict";
import { collapseBursts, type HistoryEvent } from "./history.ts";

const e = (id: string, at: string, over: Partial<HistoryEvent> = {}): HistoryEvent => ({ id, at, category: "SOURCES", label: "Source linked", sentence: "Source item mapped to initiative", actor: "Lina Haddad", rationale: null, href: null, hrefLabel: null, provenance: null, ...over });

test("a same-minute burst of identical entries reads as one line with its count", () => {
  const out = collapseBursts([e("1", "2026-09-20T10:00:05Z"), e("2", "2026-09-20T10:00:03Z"), e("3", "2026-09-20T10:00:01Z"), e("4", "2026-09-19T10:00:00Z")]);
  assert.equal(out.length, 2);
  assert.equal(out[0]!.sentence, "3 source items mapped to this initiative");
  assert.equal(out[1]!.sentence, "Source item mapped to initiative");
  assert.ok(!("count" in out[0]!) && !("baseSentence" in out[0]!));
});

test("different people, sentences or minutes are never merged", () => {
  const out = collapseBursts([e("1", "2026-09-20T10:00:05Z"), e("2", "2026-09-20T10:00:03Z", { actor: "Nour Zaki" }), e("3", "2026-09-20T10:00:01Z", { sentence: "Other" }), e("4", "2026-09-20T10:01:00Z")]);
  assert.equal(out.length, 4);
});

test("confirmed proposals read as what was added, not as an internal type", async () => {
  const { activitySummary } = await import("./copy.ts");
  const at = (summary: string) => activitySummary({ id: "x", workspaceId: "w", initiativeId: "i", eventType: "AI_PROPOSAL_CONFIRMED", summary, occurredAt: "2026-09-25T10:00:00Z", entityType: null, entityId: null, payload: null, actorLabel: null } as never);
  assert.equal(at("Human confirmed open_question proposal from Steering sync"), "Open question added from Steering sync");
  assert.equal(at("Human confirmed risk proposal from Steering sync · unverified Knowledge"), "Risk added from Steering sync · awaiting verification");
  assert.equal(at("Human confirmed evidence proposal from Pilot email"), "Proposal accepted from Pilot email");
});
