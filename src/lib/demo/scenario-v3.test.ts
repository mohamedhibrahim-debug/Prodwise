import test from "node:test";
import assert from "node:assert/strict";
import { canonicalDemoDataV3, DEMO_V3_CUTOFF } from "./scenario-v3.ts";
import { freezeInput } from "../delivery/model.ts";
import { buildPortfolioProjection } from "../workspace/portfolio.ts";
import { runReview } from "../review/engine.ts";

const identity = { workspaceId: "d2000000-0000-4000-8000-000000000002", organizationId: "d2000000-0000-4000-8000-000000000001", reviewerMemberId: "d2000000-0000-4000-8000-000000000003", reviewerUserId: "d2000000-0000-4000-8000-000000000004" };
const demo = canonicalDemoDataV3(identity);
const s = demo.productStore;

test("the enriched Demo is deterministic", () => {
  assert.equal(JSON.stringify(canonicalDemoDataV3(identity)), JSON.stringify(demo));
});

test("density targets are met by canonical records, not by display numbers", () => {
  const active = s.initiatives.filter(i => !i.archivedAt);
  assert.ok(active.length >= 12 && active.length <= 16, `active initiatives ${active.length}`);
  assert.equal(s.initiatives.filter(i => i.archivedAt).length, 1);
  assert.ok(s.evidence.length >= 35 && s.evidence.length <= 60, `evidence ${s.evidence.length}`);
  assert.ok(s.claims.length >= 50 && s.claims.length <= 80, `knowledge ${s.claims.length}`);
  assert.ok(s.commitments.length >= 15 && s.commitments.length <= 25, `commitments ${s.commitments.length}`);
  assert.ok(s.openQuestions.length >= 8 && s.openQuestions.length <= 15, `questions ${s.openQuestions.length}`);
  assert.ok(s.relationships.length >= 6 && s.relationships.length <= 12, `relationships ${s.relationships.length}`);
  const risks = s.claims.filter(c => c.type === "RISK");
  assert.ok(risks.length >= 8 && risks.length <= 15, `risks ${risks.length}`);
  assert.equal(new Set(demo.deliveryState.reviews.map(r => r.status)).size, 2);
  assert.ok(demo.deliveryState.reviews.filter(r => r.status === "FINAL").length >= 2);
});

test("every relationship, commitment, question and risk points at records that exist in the Demo", () => {
  const ids = new Set(s.initiatives.map(i => i.id));
  for (const r of s.relationships) assert.ok(ids.has(r.fromInitiativeId) && ids.has(r.toInitiativeId));
  for (const a of s.commitments) assert.ok(ids.has(a.initiativeId));
  for (const q of s.openQuestions) { assert.ok(ids.has(q.initiativeId)); if (q.answerClaimId) assert.ok(s.claims.some(c => c.id === q.answerClaimId && c.status === "ACTIVE")); }
  for (const t of s.riskTracking) assert.ok(s.claims.some(c => c.id === t.claimId && c.type === "RISK"));
  for (const l of s.claimEvidence) assert.ok(s.claims.some(c => c.id === l.claimId) && s.evidence.some(e => e.id === l.evidenceId));
  for (const p of s.evidenceProposals) { const sub = s.evidenceSubmissions.find(x => x.id === p.submissionId)!; const a = s.evidenceAnchors.find(x => x.id === p.anchorId)!; assert.equal(sub.text.slice(a.start, a.end), a.quote); }
});

test("nothing happens after the scenario cutoff, and the open Draft matches the records it froze", () => {
  const cutoff = Date.parse(DEMO_V3_CUTOFF);
  for (const e of s.activity) assert.ok(Date.parse(e.occurredAt) <= cutoff, e.eventType);
  for (const e of demo.deliveryState.events) assert.ok(Date.parse(e.occurredAt) <= cutoff);
  const draft = demo.deliveryState.reviews.find(r => r.status === "DRAFT")!;
  assert.equal(freezeInput(demo.source, demo.deliveryState, identity.workspaceId, demo.cutoff).digest, draft.input.digest);
});

test("home attention derives from the same records: overdue commitments, late dependencies, open conflicts", () => {
  const p = buildPortfolioProjection({ source: demo.source, state: demo.deliveryState, workspaceId: identity.workspaceId, asOf: DEMO_V3_CUTOFF, relationships: s.relationships });
  const kinds = p.rows.flatMap(r => r.attention.map(a => a.kind));
  assert.ok(kinds.includes("DECISION") && kinds.includes("BLOCKER") && kinds.includes("DEPENDENCY") && kinds.includes("PAST_TARGET"));
  const today = "2026-09-26";
  const overdue = s.commitments.filter(a => a.dueDate && a.dueDate < today && !["DONE", "CANCELLED"].includes(a.status));
  assert.ok(overdue.length >= 2, "at least two overdue commitments exist in canonical records");
  // Story D: the deferred coverage comparison is open again because the compared entries changed.
  const tcp = s.initiatives.find(i => i.slug === "terminal-care-plan")!;
  const finding = runReview(tcp.id, demo.source.snapshots.find(x => x.initiative.id === tcp.id)!.claims).find(f => f.type === "CONFLICT")!;
  const deferral = s.findingDispositions.find(d => d.findingId === finding.fingerprint)!;
  assert.notEqual(deferral.underlyingDigest, finding.contentDigest);
});

test("privacy: the synthetic corpus carries no real organisation, people, keys or addresses", () => {
  const text = JSON.stringify({ s, facts: demo.deliveryState.facts, personas: demo.personas }).toLowerCase();
  for (const banned of ["aman.eg", "rayacorp", "klivvr", "banque", "android25", "ma25-", "ap-17", "amanpmo", "atlassian.net", "docs.google.com", "mail.google.com", "@gmail", "raya "]) assert.ok(!text.includes(banned), `found ${banned}`);
  for (const p of demo.personas) assert.match(p.email, /@example\.demo$/);
});
