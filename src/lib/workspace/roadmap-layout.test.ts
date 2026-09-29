import assert from 'node:assert/strict';
import test from 'node:test';
import { applyFilters, axis, computeWindow, drawnDates, filtersToQuery, groupItems, monthCount, parseFilters, rowMarks, xOf, type RoadmapItem } from './roadmap-layout.ts';

function item(over: Partial<RoadmapItem> = {}): RoadmapItem {
  return {
    id: 'i1', slug: 'i1', name: 'Alpha', stage: 'Delivery', businessLine: 'BP', businessLineLabel: 'BP', ownerId: 'm1', ownerLabel: 'Nour',
    scope: null, devStart: null, target: null, targetText: 'Not recorded', targetContext: null, actual: null, actualExtent: null, actualText: 'Not recorded',
    milestone: null, nextStep: null, movement: null, attention: [], dependencies: [], pastTarget: false, ...over,
  };
}

test('Window spans recorded dates plus a margin, snapped to whole months', () => {
  const w = computeWindow([item({ devStart: '2026-06-01', target: '2026-10-05' })], '2026-09-26');
  assert.deepEqual(w, { start: '2026-05-01', end: '2026-11-01' });
  assert.equal(monthCount(w), 6);
  assert.equal(computeWindow([item({ devStart: '2026-06-20', target: '2026-10-15' })], '2026-09-26').end, '2026-12-01');
  assert.equal(computeWindow([item({ devStart: '2026-06-20', target: '2026-10-15' })], '2026-09-26').start, '2026-06-01');
});

test('Window with only a cutoff still spans three months and never produces NaN', () => {
  const w = computeWindow([], '2026-09-26');
  assert.equal(monthCount(w), 3);
  assert.equal(w.start, '2026-09-01');
  assert.ok(Number.isFinite(xOf('2026-09-26', w)));
  assert.equal(xOf('2026-09-26', { start: '2026-09-26', end: '2026-09-26' }), 0);
});

test('Unscheduled initiatives contribute no dates and are never placed on the timeline', () => {
  const u = item({ devStart: '2025-01-01', milestone: { date: '2025-02-01', dateText: '1 Feb 2025', text: 'Pilot' } });
  assert.deepEqual(drawnDates(u), []);
  assert.equal(rowMarks(u, { start: '2026-01-01', end: '2026-12-01' }), null);
  const { groups, unscheduled } = groupItems([u, item({ id: 'i2', name: 'Beta', target: '2026-10-01' })], 'businessLine');
  assert.deepEqual(unscheduled.map(i => i.id), ['i1']);
  assert.deepEqual(groups.flatMap(g => g.items.map(i => i.id)), ['i2']);
});

test('A target with no recorded development start draws a marker, never an invented bar', () => {
  const w = { start: '2026-09-01', end: '2026-12-01' };
  const m = rowMarks(item({ target: '2026-10-15' }), w)!;
  assert.equal(m.planned, null);
  assert.equal(m.delivered, null);
  assert.ok(m.target && m.target.x > 0);
  assert.equal(m.live, null);
});

test('Planned and delivered spans only connect recorded dates in order', () => {
  const w = { start: '2026-06-01', end: '2026-11-01' };
  const m = rowMarks(item({ devStart: '2026-06-01', target: '2026-09-10', actual: '2026-09-10', actualExtent: 'FULL' }), w)!;
  assert.equal(m.planned!.x, 0);
  assert.ok(m.delivered);
  assert.equal(m.live!.partial, false);
  const reversed = rowMarks(item({ devStart: '2026-10-01', target: '2026-09-10' }), w)!;
  assert.equal(reversed.planned, null);
});

test('Target movement draws a ghost at the previous target connected to the current one', () => {
  const w = { start: '2026-09-01', end: '2026-11-01' };
  const m = rowMarks(item({ target: '2026-10-15', movement: { from: '2026-10-01', to: '2026-10-15', days: 14 } }), w)!;
  assert.equal(m.ghost!.days, 14);
  assert.ok(m.ghost!.x < m.ghost!.toX);
  assert.ok(m.hit.x <= m.ghost!.x);
});

test('Only late, dated dependencies are drawn; unassessed ones make no noise', () => {
  const w = { start: '2026-09-01', end: '2026-11-01' };
  const deps = [
    { id: 'd1', otherName: 'Insights', otherSlug: 'insights', late: true, text: 'late', neededDate: '2026-10-02', providerDate: '2026-10-14', days: 12 },
    { id: 'd2', otherName: 'KYC', otherSlug: 'kyc', late: false, text: 'Impact not assessed', neededDate: null, providerDate: null, days: null },
  ];
  const m = rowMarks(item({ target: '2026-10-09', dependencies: deps }), w)!;
  assert.deepEqual(m.dependencies.map(d => d.id), ['d1']);
  assert.ok(m.dependencies[0]!.toX > m.dependencies[0]!.fromX);
});

test('Axis months tile the window and quarters merge adjacent months', () => {
  const a = axis({ start: '2026-08-01', end: '2027-02-01' });
  assert.deepEqual(a.months.map(m => m.label), ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan']);
  assert.deepEqual(a.quarters.map(q => q.label), ['Q3 2026', 'Q4 2026', 'Q1 2027']);
  const total = a.months.reduce((n, m) => n + m.width, 0);
  assert.ok(Math.abs(total - 100) < 1e-9);
});

test('Filters keep the existing Roadmap semantics', () => {
  const items = [
    item({ id: 'a', target: '2026-10-01', attention: [{ kind: 'BLOCKER', label: 'Recorded blocker', detail: '', href: '#' }] }),
    item({ id: 'b', ownerId: null, ownerLabel: 'Unassigned', businessLine: 'FS' }),
    item({ id: 'c', target: '2026-10-01', movement: { from: '2026-09-20', to: '2026-10-01', days: 11 } }),
  ];
  const ids = (v: Parameters<typeof applyFilters>[1]) => applyFilters(items, v).map(i => i.id);
  assert.deepEqual(ids({ businessLine: '', owner: '', view: 'attention' }), ['a']);
  assert.deepEqual(ids({ businessLine: '', owner: '', view: 'unknown' }), ['b']);
  assert.deepEqual(ids({ businessLine: '', owner: '', view: 'moved' }), ['c']);
  assert.deepEqual(ids({ businessLine: 'FS', owner: '', view: '' }), ['b']);
  assert.deepEqual(ids({ businessLine: '', owner: 'unassigned', view: '' }), ['b']);
});

test('Grouping by owner orders by target and puts Unassigned last', () => {
  const { groups } = groupItems([
    item({ id: 'x', ownerId: null, ownerLabel: 'Unassigned', target: '2026-09-01' }),
    item({ id: 'y', ownerId: 'm2', ownerLabel: 'Adam', target: '2026-11-01' }),
    item({ id: 'z', ownerId: 'm2', ownerLabel: 'Adam', target: '2026-10-01' }),
  ], 'owner');
  assert.deepEqual(groups.map(g => g.label), ['Adam', 'Unassigned']);
  assert.deepEqual(groups[0]!.items.map(i => i.id), ['z', 'y']);
});

test('Filter URL state round-trips and omits defaults', () => {
  const f = parseFilters({ view: 'moved', group: 'owner', owner: 'm1' });
  assert.equal(filtersToQuery(f, null), '?owner=m1&view=moved&group=owner');
  assert.equal(filtersToQuery(parseFilters({ view: 'bogus' }), null), '');
  assert.equal(filtersToQuery(parseFilters({}), '2026-09-20'), '?cutoff=2026-09-20');
});
