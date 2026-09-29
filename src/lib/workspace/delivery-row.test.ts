import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryRowLayout, horizonX } from './delivery-row.ts';
import { computeWindow, rowMarks, xOf, type RoadmapItem } from './roadmap-layout.ts';

function item(over: Partial<RoadmapItem> = {}): RoadmapItem {
  return { id: 'i1', slug: 'i1', name: 'Initiative', stage: 'Delivery', businessLine: 'MF', businessLineLabel: 'Merchant Finance', ownerId: null, ownerLabel: 'Unassigned', scope: null,
    devStart: '2026-08-03', target: '2026-10-15', targetText: '15 Oct 2026', targetContext: null, actual: null, actualExtent: null, actualText: 'Not recorded',
    milestone: { date: '2026-09-20', dateText: '20 Sept 2026', text: 'UAT sign-off' }, nextStep: null, movement: null, attention: [], dependencies: [], pastTarget: false, ...over };
}

test('the Brief row uses exactly the Roadmap window and marks for the same item', () => {
  const it = item(); const cutoff = '2026-09-26';
  const out = deliveryRowLayout(it, cutoff)!;
  assert.ok(out);
  const w = computeWindow([it], cutoff);
  assert.deepEqual(out.window, w);
  assert.deepEqual(out.marks, rowMarks(it, w));
  assert.equal(out.today, xOf(cutoff, w));
  assert.ok(out.months.length >= 3);
  // Every recorded date sits inside the window, so nothing is drawn off the row.
  for (const d of [it.devStart!, it.target!, it.milestone!.date!, cutoff]) assert.ok(d >= w.start && d < w.end, d);
});

test('no recorded Target Live means no layout: nothing is estimated', () => {
  assert.equal(deliveryRowLayout(item({ target: null }), '2026-09-26'), null);
});

test('a moved target draws its ghost only when the movement lands on the current target', () => {
  const moved = deliveryRowLayout(item({ movement: { from: '2026-09-30', to: '2026-10-15', days: 15 } }), '2026-09-26')!;
  assert.ok(moved.marks.ghost);
  const stale = deliveryRowLayout(item({ movement: { from: '2026-09-30', to: '2026-11-01', days: 32 } }), '2026-09-26')!;
  assert.equal(stale.marks.ghost, null);
});

test('the 28-day horizon places today at 0, the end at 100 and clamps beyond', () => {
  assert.equal(horizonX('2026-09-29', '2026-09-29'), 0);
  assert.equal(horizonX('2026-09-29', '2026-10-13'), 50);
  assert.equal(horizonX('2026-09-29', '2026-10-27'), 100);
  assert.equal(horizonX('2026-09-29', '2026-12-01'), 100);
  assert.equal(horizonX('2026-09-29', '2026-09-01'), 0);
});
