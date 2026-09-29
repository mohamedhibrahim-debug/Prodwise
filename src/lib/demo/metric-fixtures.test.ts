import test from "node:test";
import assert from "node:assert/strict";
import { canonicalDemoDataV3, DEMO_V3_CUTOFF } from "./scenario-v3.ts";

const identity = { workspaceId: "d3000000-0000-4000-8000-000000000002", organizationId: "d3000000-0000-4000-8000-000000000001", reviewerMemberId: "d3000000-0000-4000-8000-000000000003", reviewerUserId: "d3000000-0000-4000-8000-000000000004" };
const demo = canonicalDemoDataV3(identity);
const metrics = demo.metrics;

test("the V3 Demo carries synthetic metrics for most live-relevant initiatives, keeping the V2 pair", () => {
  assert.equal(metrics.length, 24);
  const initiatives = new Set(metrics.map(m => m.initiativeId));
  assert.equal(initiatives.size, 9);
  const archived = demo.productStore.initiatives.filter(i => i.archivedAt).map(i => i.id);
  for (const m of metrics) {
    assert.ok(demo.productStore.initiatives.some(i => i.id === m.initiativeId && i.isDemo), m.name);
    assert.ok(!archived.includes(m.initiativeId), "no metrics on archived initiatives");
  }
  assert.deepEqual(metrics.slice(0, 2).map(m => m.name), ["Median onboarding time", "First transaction within seven days"]);
});

test("every metric satisfies the 0017 storage constraints and is visibly synthetic", () => {
  const ids = new Set<string>();
  for (const m of metrics) {
    for (const id of [m.id, ...m.observations.map(o => o.id)]) { assert.ok(!ids.has(id), `duplicate id ${id}`); ids.add(id); }
    assert.equal(m.workspaceId, identity.workspaceId);
    assert.equal(m.origin, "SYNTHETIC_DEMO");
    assert.match(m.sourceLabel, /^Synthetic /);
    assert.ok(m.name.trim().length >= 1 && m.name.length <= 160);
    assert.ok(m.definition.trim().length >= 1 && m.definition.length <= 2000);
    assert.ok(m.unit.trim().length >= 1 && m.unit.length <= 40);
    assert.ok(m.formula.trim().length >= 1 && m.formula.length <= 2000);
    const noTarget = m.targetValue === null && m.targetComparator === null && m.targetApprovedAt === null;
    const approved = m.targetValue !== null && m.targetComparator !== null && m.targetApprovedAt !== null && Boolean(m.targetOwnerLabel?.trim());
    assert.ok(noTarget || approved, `${m.name} target consistency`);
    if (approved) { assert.match(m.targetOwnerLabel!, /^Synthetic /); assert.match(m.targetNote ?? "", /Synthetic/); }
    assert.ok(m.updatedAt <= DEMO_V3_CUTOFF);
    const periods = new Set<string>();
    for (const o of m.observations) {
      assert.ok(o.periodEnd >= o.periodStart);
      assert.ok(!periods.has(o.periodStart + o.periodEnd)); periods.add(o.periodStart + o.periodEnd);
      assert.ok(o.capturedAt <= DEMO_V3_CUTOFF, `${m.name} captured after the cutoff`);
      assert.ok(o.capturedAt.slice(0, 10) > o.periodEnd, "captured after the period closes");
      assert.equal(o.origin, "SYNTHETIC_DEMO");
      assert.match(o.note, /^Synthetic observation\./);
      if (o.value === null) assert.match(o.note, /not recorded|Not recorded/);
    }
  }
});

test("missing-is-not-zero and target-absent paths are demonstrated by records", () => {
  const nulls = metrics.flatMap(m => m.observations.filter(o => o.value === null));
  assert.ok(nulls.length >= 5);
  assert.ok(!metrics.some(m => m.observations.some(o => o.value === 0)), "no synthetic zero stands in for a missing value");
  assert.ok(metrics.filter(m => m.targetValue === null).length >= 5);
  assert.ok(metrics.some(m => m.targetValue !== null && m.observations.length === 0), "a configured pre-launch metric has no observations yet");
  assert.ok(metrics.filter(m => m.observations.length).every(m => m.observations.length >= 2));
  assert.ok(metrics.filter(m => m.observations.length >= 6).length >= 18);
});

test("related synthetic measures stay internally consistent", () => {
  const byName = (name: string) => metrics.find(m => m.name === name)!;
  const gtv = byName("Tap-to-Pay gross transaction value"), count = byName("Tap-to-Pay accepted transactions"), atv = byName("Average Tap-to-Pay transaction value");
  gtv.observations.forEach((o, i) => assert.equal(Math.round(o.value! / count.observations[i]!.value!), atv.observations[i]!.value));
  const rate = byName("Tap-to-Pay transaction success rate");
  assert.ok(rate.observations.every(o => o.value === null || (o.value > 90 && o.value < 100)));
  const raised = byName("Complaints raised from the terminal"), routed = byName("Complaints routed correctly on first assignment");
  raised.observations.forEach((o, i) => assert.equal(o.value === null, routed.observations[i]!.value === null));
});
