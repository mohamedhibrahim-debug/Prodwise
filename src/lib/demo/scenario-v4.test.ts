import test from "node:test";
import assert from "node:assert/strict";
import { canonicalDemoDataV3 } from "./scenario-v3.ts";
import { canonicalDemoDataV4, DEMO_V4_CUTOFF, DEMO_V4_VERSION, V4_INITIATIVES } from "./scenario-v4.ts";
import { DEMO_DATASET_LABEL } from "./canonical.ts";
import { freezeInput, factFor, dayDifference, cairoDay } from "../delivery/model.ts";
import { buildPortfolioProjection } from "../workspace/portfolio.ts";
import { metricView, metricCoverage } from "../analysis/metric-view.ts";
import { runReview } from "../review/engine.ts";

const identity = { workspaceId: "d4000000-0000-4000-8000-000000000002", organizationId: "d4000000-0000-4000-8000-000000000001", reviewerMemberId: "d4000000-0000-4000-8000-000000000003", reviewerUserId: "d4000000-0000-4000-8000-000000000004" };
const demo = canonicalDemoDataV4(identity);
const s = demo.productStore;
const today = cairoDay(DEMO_V4_CUTOFF);
const facts = demo.deliveryState.facts;
const bySlug = (slug: string) => { const i = s.initiatives.find(x => x.slug === slug); if (!i) throw new Error(slug); return i; };
const fact = (slug: string, kind: Parameters<typeof factFor>[2]) => factFor(facts, bySlug(slug).id, kind);

test("V4 is deterministic, labelled, and keeps every V3 initiative", () => {
  assert.equal(demo.version, DEMO_V4_VERSION);
  assert.equal(DEMO_DATASET_LABEL, "Demo dataset V4");
  assert.equal(JSON.stringify(canonicalDemoDataV4(identity)), JSON.stringify(demo));
  const v3 = canonicalDemoDataV3(identity);
  for (const i of v3.productStore.initiatives) assert.ok(s.initiatives.some(x => x.id === i.id && x.slug === i.slug && x.name === i.name), i.slug);
  for (const m of v3.metrics) assert.ok(demo.metrics.some(x => x.id === m.id), m.name);
});

test("density: about 24 active initiatives across the seven personas and every business line, two archived", () => {
  const active = s.initiatives.filter(i => !i.archivedAt);
  assert.equal(active.length, 24);
  assert.equal(s.initiatives.filter(i => i.archivedAt).length, 2);
  assert.equal(new Set(active.map(i => i.businessLine)).size, 5);
  const owners = new Set(active.map(i => factFor(facts, i.id, "OWNER")?.value.memberId).filter(Boolean));
  for (const p of demo.personas) assert.ok(owners.has(p.memberId), `${p.displayName} owns an initiative`);
  assert.ok(active.some(i => i.name.length > 60), "a long initiative name");
  assert.ok(s.evidence.length >= 60 && s.claims.length >= 75 && s.commitments.length >= 25 && s.openQuestions.length >= 12 && s.relationships.length >= 12, "records grew with the initiatives");
});

test("every Roadmap condition in the brief is carried by a recorded fact, never by display logic", () => {
  const p = buildPortfolioProjection({ source: demo.source, state: demo.deliveryState, workspaceId: identity.workspaceId, asOf: DEMO_V4_CUTOFF, relationships: s.relationships });
  const row = (slug: string) => p.rows.find(r => r.initiative.slug === slug)!;
  // Development start, Target Live, Actual Live full and partial, delivered work.
  assert.equal(fact("merchant-app-arabic-localisation", "DEV_STARTED")?.value.date, "2026-05-04");
  assert.equal(fact("merchant-app-arabic-localisation", "ACTUAL_LIVE")?.value.extent, "FULL");
  assert.ok(fact("merchant-app-arabic-localisation", "ACTUAL_LIVE")!.value.date! < fact("merchant-app-arabic-localisation", "TARGET_LIVE")!.value.date!, "delivered before its target");
  assert.equal(fact("terminal-firmware-rollout", "ACTUAL_LIVE")?.value.extent, "PARTIAL");
  // Approaching targets (≤ 14 days) and an overdue one with no Actual Live.
  const approaching = p.rows.filter(r => r.target?.value.date && r.actual?.value.extent !== "FULL" && dayDifference(today, r.target.value.date) >= 0 && dayDifference(today, r.target.value.date) <= 14);
  assert.ok(approaching.length >= 3, `approaching ${approaching.length}`);
  assert.equal(row("bill-payment-refund-desk").timing.kind, "NEEDS_UPDATE");
  assert.ok(row("bill-payment-refund-desk").attention.some(a => a.kind === "PAST_TARGET") && row("bill-payment-refund-desk").attention.some(a => a.kind === "PAST_MILESTONE") && row("bill-payment-refund-desk").attention.some(a => a.kind === "BLOCKER"));
  // Moved targets, later and earlier, each with its recorded event.
  assert.equal(row("dispute-resolution-portal").targetMovement?.days, 21);
  assert.equal(row("merchant-loyalty-points").targetMovement?.days, -13);
  assert.ok(demo.deliveryState.events.some(e => e.initiativeId === bySlug("merchant-loyalty-points").id && e.after.kind === "TARGET_LIVE" && e.before?.value.date === "2026-11-10" && e.after.value.date === "2026-10-28"));
  // Milestone next to its target (marker collision case) and a late dependency with a date impact.
  assert.equal(fact("dispute-resolution-portal", "NEXT_MILESTONE")?.value.date, "2026-10-04");
  assert.ok(row("supplier-payment-financing").attention.some(a => a.kind === "DEPENDENCY"), "late dependency counted as attention");
  // Every active initiative has a dated Target Live, spread across Q3 2026 to Q1 2027 rather than one month.
  const active = p.rows.filter(r => !r.initiative.archivedAt);
  assert.ok(active.every(r => r.target?.value.date), `unscheduled ${active.filter(r => !r.target?.value.date).map(r => r.initiative.slug)}`);
  const months = new Map<string, number>(); for (const r of active) { const m = r.target!.value.date!.slice(0, 7); months.set(m, (months.get(m) ?? 0) + 1); }
  assert.ok(months.size >= 8 && Math.max(...months.values()) <= active.length / 2, `target months ${[...months]}`);
  // A once-unknown target stays in history as its earlier revision.
  assert.ok(demo.deliveryState.events.some(e => e.initiativeId === bySlug("merchant-onboarding-kiosk").id && e.after.kind === "TARGET_LIVE" && e.before?.value.unknown && e.after.value.date === "2027-02-22"));
  // Archived records keep their history.
  assert.ok(bySlug("merchant-statement-archive").archivedAt && fact("merchant-statement-archive", "ACTUAL_LIVE"));
});

test("every Analysis condition is carried by a metric record", () => {
  const byName = (name: string) => demo.metrics.find(m => m.name === name)!;
  const views = demo.metrics.map(m => ({ m, v: metricView(m) }));
  const perInitiative = new Map<string, number>();
  for (const m of demo.metrics) perInitiative.set(m.initiativeId, (perInitiative.get(m.initiativeId) ?? 0) + 1);
  assert.ok([...perInitiative.values()].filter(n => n >= 2).length >= 10 && perInitiative.size >= 16, "several metrics per initiative, across most measured initiatives");
  assert.ok(views.some(({ m, v }) => m.targetComparator === "AT_LEAST" && v.status.kind === "MET") && views.some(({ m, v }) => m.targetComparator === "AT_LEAST" && v.status.kind === "NOT_MET"));
  assert.ok(views.some(({ m, v }) => m.targetComparator === "AT_MOST" && v.status.kind === "MET") && views.some(({ m, v }) => m.targetComparator === "AT_MOST" && v.status.kind === "NOT_MET"));
  assert.equal(metricView(byName("Biller reversal files received per business day")).status.kind, "MET", "an EQUAL target that is met");
  const improving = metricView(byName("Terminals on certified firmware"));
  assert.ok(improving.delta!.value > 0 && improving.status.kind === "NOT_MET", "improving but still below target");
  const declining = metricView(byName("Contactless authorisation approval rate"));
  assert.ok(declining.delta!.value < 0 && declining.status.kind === "MET", "declining but still above target");
  assert.ok(demo.metrics.some(m => m.observations.some(o => o.value === null)), "a period recorded as null");
  assert.ok(!demo.metrics.some(m => m.observations.some(o => o.value === 0)), "no synthetic zero stands in for a missing value");
  const staleBefore = new Date(Date.parse(DEMO_V4_CUTOFF) - 42 * 86400000).toISOString();
  const stale = views.filter(({ v }) => v.captured && v.captured < staleBefore), fresh = views.filter(({ v }) => v.captured && v.captured >= staleBefore);
  assert.ok(stale.length >= 2 && fresh.length >= 20, `stale ${stale.length} fresh ${fresh.length}`);
  assert.ok(demo.metrics.some(m => m.observations.length >= 10) && demo.metrics.some(m => m.observations.length > 0 && m.observations.length <= 3), "dense and sparse series");
  const fresh_target = byName("Top-up completion time");
  assert.ok(fresh_target.targetApprovedAt! > "2026-09-20" && fresh_target.observations.length === 0, "a newly approved target with no observation yet");
  assert.ok(demo.metrics.some(m => m.definition.length > 500), "a long definition");
  assert.ok(demo.metrics.filter(m => m.targetValue === null).length >= 6, "metrics without an approved target");
  const coverage = metricCoverage(demo.metrics);
  assert.ok(coverage.met > 0 && coverage.notMet > 0 && coverage.notAssessed > 0 && coverage.noTarget > 0);
  for (const m of demo.metrics) {
    assert.equal(m.workspaceId, identity.workspaceId); assert.equal(m.origin, "SYNTHETIC_DEMO"); assert.ok(m.updatedAt <= DEMO_V4_CUTOFF);
    assert.ok(s.initiatives.some(i => i.id === m.initiativeId && !i.archivedAt), `${m.name} belongs to an active initiative`);
    const approved = m.targetValue !== null && m.targetComparator !== null && m.targetApprovedAt !== null && Boolean(m.targetOwnerLabel?.trim());
    const none = m.targetValue === null && m.targetComparator === null && m.targetApprovedAt === null;
    assert.ok(approved || none, `${m.name} target consistency`);
    for (const o of m.observations) { assert.ok(o.capturedAt <= DEMO_V4_CUTOFF && o.capturedAt.slice(0, 10) > o.periodEnd); if (o.value === null) assert.match(o.note, /not recorded/i); }
  }
});

test("nothing happens after the scenario date; the open Draft matches the records it froze; Finals include what existed then", () => {
  const cutoff = Date.parse(DEMO_V4_CUTOFF);
  for (const e of s.activity) assert.ok(Date.parse(e.occurredAt) <= cutoff, e.eventType);
  for (const e of demo.deliveryState.events) assert.ok(Date.parse(e.occurredAt) <= cutoff);
  const draft = demo.deliveryState.reviews.find(r => r.status === "DRAFT")!;
  assert.equal(freezeInput(demo.source, demo.deliveryState, identity.workspaceId, demo.cutoff).digest, draft.input.digest);
  assert.equal(draft.sections.length, 24);
  const w38 = demo.deliveryState.reviews.find(r => r.week === "2026-W38")!;
  assert.equal(w38.status, "FINAL");
  assert.ok(w38.sections.some(x => x.initiativeId === bySlug("agent-float-top-up").id), "an initiative created in July is in the W38 Final");
  assert.ok(!w38.sections.some(x => x.initiativeId === bySlug("merchant-statement-archive").id), "an initiative archived before W38 is not");
  for (const r of s.relationships) assert.ok(s.initiatives.some(i => i.id === r.fromInitiativeId) && s.initiatives.some(i => i.id === r.toInitiativeId));
  for (const a of s.commitments) assert.ok(s.initiatives.some(i => i.id === a.initiativeId));
  for (const t of s.riskTracking) assert.ok(s.claims.some(c => c.id === t.claimId && c.type === "RISK"));
  for (const l of s.claimEvidence) assert.ok(s.claims.some(c => c.id === l.claimId) && s.evidence.some(e => e.id === l.evidenceId));
  // No V4 addition invents a Knowledge comparison; the V3 story findings stay exactly as they were.
  const v3 = canonicalDemoDataV3(identity);
  const conflicts = (d: typeof demo) => d.source.snapshots.flatMap(x => runReview(x.initiative.id, x.claims)).filter(f => f.type === "CONFLICT").length;
  assert.equal(conflicts(demo), conflicts(v3));
});

test("privacy: the V4 corpus carries no real organisation, people, keys or addresses", () => {
  const text = JSON.stringify({ s, facts, metrics: demo.metrics, personas: demo.personas, initiatives: V4_INITIATIVES }).toLowerCase();
  for (const banned of ["aman.eg", "rayacorp", "klivvr", "banque", "android25", "ma25-", "ap-17", "amanpmo", "atlassian.net", "docs.google.com", "mail.google.com", "@gmail", "raya "]) assert.ok(!text.includes(banned), `found ${banned}`);
  for (const m of demo.metrics) { assert.match(m.sourceLabel, /^Synthetic /); if (m.targetOwnerLabel !== null) assert.match(m.targetOwnerLabel, /^Synthetic /); }
  for (const i of s.initiatives) assert.match(i.description ?? "", /^Synthetic demo scenario\./);
});

test("showcase: Merchant Flex Finance carries a coherent week across every initiative tab, dated between the W38 Final and the Draft", () => {
  const mff = bySlug("merchant-flex-finance"); const mine = <T extends { initiativeId: string }>(rows: T[]) => rows.filter(r => r.initiativeId === mff.id);
  const w38 = demo.deliveryState.reviews.find(r => r.week === "2026-W38")!;
  const added = mine(s.claims).filter(c => c.createdAt > w38.finalizedAt!);
  assert.ok(added.length >= 9 && added.every(c => c.createdAt <= DEMO_V4_CUTOFF), "new Knowledge lands after the last Final and before the cutoff");
  // One decision replaced another: kept as history with its replacement recorded, never deleted.
  const cap25 = mine(s.claims).find(c => c.value === "Limited to 25 merchants in the first month")!;
  const cap40 = mine(s.claims).find(c => c.value === "Limited to 40 merchants in the first month")!;
  assert.equal(cap25.status, "SUPERSEDED"); assert.equal(cap25.supersededByClaimId, cap40.id); assert.equal(cap40.status, "ACTIVE");
  assert.equal(runReview(mff.id, demo.source.snapshots.find(x => x.initiative.id === mff.id)!.claims).filter(f => f.type === "CONFLICT").length, 1, "only the 27-vs-30 divisor conflict; the cap change is a supersession");
  const risks = mine(s.riskTracking); assert.equal(risks.length, 3); assert.ok(risks.every(r => r.ownerMemberId && r.mitigationText));
  assert.ok(risks.filter(r => r.mitigationActionId).every(r => s.commitments.some(a => a.id === r.mitigationActionId && a.initiativeId === mff.id && a.dueDate)));
  const questions = mine(s.openQuestions).filter(q => q.status === "OPEN"); assert.equal(questions.length, 4); assert.equal(questions.filter(q => q.ownerMemberId && q.dueDate).length, 3);
  const actions = mine(s.commitments); assert.equal(actions.length, 5); assert.ok(actions.some(a => a.status === "DONE") && actions.some(a => a.status === "IN_PROGRESS") && actions.some(a => a.status === "OPEN"));
  const metrics = demo.metrics.filter(m => m.initiativeId === mff.id); assert.equal(metrics.length, 2);
  assert.ok(metrics.every(m => m.origin === "SYNTHETIC_DEMO" && m.observations.every(o => o.note.startsWith("Synthetic observation.") && o.capturedAt <= DEMO_V4_CUTOFF)));
  assert.ok(mine(s.evidence).filter(e => e.capturedAt > w38.finalizedAt!).every(e => /^Synthetic /.test(e.contentSummary ?? "")), "every new source is labelled synthetic");
  assert.ok(mine(s.activity).length + mine(demo.deliveryState.events).length >= 80, "History has enough recorded events to show provenance");
});
