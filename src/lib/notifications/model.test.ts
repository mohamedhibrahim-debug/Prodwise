import test from "node:test";
import assert from "node:assert/strict";
import { canonicalDemoDataV3, DEMO_V3_CUTOFF } from "../demo/scenario-v3.ts";
import { buildPortfolioProjection } from "../workspace/portfolio.ts";
import { deriveNotifications, unreadCount, type NotificationInput } from "./model.ts";

const identity = { workspaceId: "d2000000-0000-4000-8000-000000000002", organizationId: "d2000000-0000-4000-8000-000000000001", reviewerMemberId: "d2000000-0000-4000-8000-000000000003", reviewerUserId: "d2000000-0000-4000-8000-000000000004" };
const demo = canonicalDemoDataV3(identity), s = demo.productStore;
const lina = demo.personas.find(p => p.key === "lina")!;
function input(over: Partial<NotificationInput> = {}): NotificationInput {
  const p = buildPortfolioProjection({ source: demo.source, state: demo.deliveryState, workspaceId: identity.workspaceId, asOf: DEMO_V3_CUTOFF, relationships: s.relationships });
  return { asOf: DEMO_V3_CUTOFF, me: { userId: lina.userId, memberId: lina.memberId, canFinalizeReviews: false }, rows: p.rows, commitments: s.commitments, questions: s.openQuestions, riskEvents: s.riskEvents, activity: s.activity, deliveryEvents: demo.deliveryState.events, reviews: demo.deliveryState.reviews, connectors: [], ...over };
}

test("notifications derive from the same records as Home attention, one per thing", () => {
  const all = deriveNotifications(input());
  const types = new Set(all.map(n => n.type));
  for (const t of ["DECISION_NEEDED", "DEPENDENCY_DATE", "COMMITMENT_OVERDUE", "TARGET_MOVED", "RISK_OPENED", "DECISION_REOPENED", "WEEKLY_REVIEW_DUE"] as const) assert.ok(types.has(t), `missing ${t}`);
  assert.equal(new Set(all.map(n => n.fingerprint)).size, all.length, "fingerprints are unique");
  const p = buildPortfolioProjection({ source: demo.source, state: demo.deliveryState, workspaceId: identity.workspaceId, asOf: DEMO_V3_CUTOFF, relationships: s.relationships });
  const decisions = p.rows.flatMap(r => r.attention.filter(a => a.kind === "DECISION")).length;
  assert.equal(all.filter(n => n.type === "DECISION_NEEDED").length, decisions, "one decision notification per Home decision attention");
  assert.ok(all.filter(n => n.type === "TARGET_MOVED").every(n => !/\d{4}-\d{2}-\d{2}/.test(n.detail)), "dates are display dates");
  // Target moves: one per initiative (the latest), only inside the event window.
  const moved = all.filter(n => n.type === "TARGET_MOVED");
  assert.equal(new Set(moved.map(n => n.initiativeId)).size, moved.length);
  assert.ok(moved.every(n => Date.parse(n.at) >= Date.parse(DEMO_V3_CUTOFF) - 14 * 86_400_000));
  assert.ok(all.every(n => n.href.startsWith("/") && !n.href.startsWith("//")), "deep links stay inside Prodwise");
  const deps = all.filter(n => n.type === "DEPENDENCY_DATE");
  assert.equal(new Set(deps.map(n => n.detail)).size, deps.length, "one notification per dependency fact, not one per side");
});

test("owner-aware: 'for me' means assigned to me or unassigned on an initiative I own", () => {
  const all = deriveNotifications(input());
  const mine = all.filter(n => n.forMe);
  assert.ok(mine.length > 0 && mine.length < all.length);
  const byOwner = new Map(input().rows.map(r => [r.initiative.id, r.ownerId]));
  for (const n of mine.filter(n => n.type === "DECISION_NEEDED")) assert.equal(byOwner.get(n.initiativeId!), lina.memberId);
  for (const n of all.filter(n => n.type === "COMMITMENT_OVERDUE" && n.forMe)) {
    const c = s.commitments.find(c => n.href.endsWith(c.id))!;
    assert.ok(c.assigneeMemberId === lina.memberId || (!c.assigneeMemberId && byOwner.get(c.initiativeId) === lina.memberId));
  }
  assert.equal(all.find(n => n.type === "WEEKLY_REVIEW_DUE")!.forMe, false, "Review finalization is for those who can finalize");
  assert.equal(deriveNotifications(input({ me: { userId: lina.userId, memberId: lina.memberId, canFinalizeReviews: true } })).find(n => n.type === "WEEKLY_REVIEW_DUE")!.forMe, true);
});

test("read marks: a changed record is unread again; unchanged stays read", () => {
  const all = deriveNotifications(input());
  const read = new Set(all.map(n => n.fingerprint));
  assert.equal(unreadCount(all, read, "all"), 0);
  const overdue = s.commitments.find(c => all.some(n => n.type === "COMMITMENT_OVERDUE" && n.href.endsWith(c.id)))!;
  const moved = s.commitments.map(c => c.id === overdue.id ? { ...c, dueDate: "2026-09-01" } : c);
  const again = deriveNotifications(input({ commitments: moved }));
  assert.equal(unreadCount(again, read, "all"), 1, "the moved due date is new; everything else stays read");
});

test("done work, archived initiatives and old events produce nothing; reconnect is personal", () => {
  const done = s.commitments.map(c => ({ ...c, status: "DONE" as const }));
  assert.equal(deriveNotifications(input({ commitments: done })).filter(n => n.kind === "DUE" && n.type.startsWith("COMMITMENT")).length, 0);
  const archived = s.initiatives.find(i => i.archivedAt)!;
  assert.ok(deriveNotifications(input()).every(n => n.initiativeId !== archived.id));
  const later = new Date(Date.parse(DEMO_V3_CUTOFF) + 60 * 86_400_000).toISOString();
  assert.equal(deriveNotifications(input({ asOf: later })).filter(n => n.kind === "CHANGED").length, 0, "events expire from the inbox after the window");
  const r = deriveNotifications(input({ connectors: [{ label: "Jira", status: "NEEDS_RECONNECT" }] })).find(n => n.type === "CONNECTOR_RECONNECT")!;
  assert.equal(r.forMe, true); assert.equal(r.href, "/account/connections");
});
