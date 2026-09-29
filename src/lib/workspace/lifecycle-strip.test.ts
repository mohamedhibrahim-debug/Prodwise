import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../domain/types.ts';
import { lifecycleDistribution, stagePosition } from './lifecycle-strip.ts';

const row = (stage: (typeof STAGES)[number], archivedAt: string | null = null) => ({ initiative: { stage, archivedAt } });

test('every stage is listed in lifecycle order, counting only active initiatives', () => {
  const out = lifecycleDistribution([row('DELIVERY'), row('DELIVERY'), row('DISCOVERY'), row('MONITORING', '2026-09-01T00:00:00Z')]);
  assert.deepEqual(out.map(s => s.stage), [...STAGES]);
  assert.equal(out.reduce((n, s) => n + s.count, 0), 3);
  assert.equal(out.find(s => s.stage === 'DELIVERY')!.count, 2);
  assert.equal(out.find(s => s.stage === 'MONITORING')!.count, 0);
});

test('an empty workspace still yields eight zero rows, never an empty list', () => {
  const out = lifecycleDistribution([]);
  assert.equal(out.length, 8);
  assert.ok(out.every(s => s.count === 0));
});

test('stage position splits the lifecycle around the recorded stage', () => {
  const p = stagePosition('VALIDATION');
  assert.equal(p.index, 4);
  assert.deepEqual(p.earlier, ['DISCOVERY', 'DEFINITION', 'ALIGNMENT', 'DELIVERY']);
  assert.deepEqual(p.later, ['RELEASE_PREPARATION', 'LIVE_VALIDATION', 'MONITORING']);
  assert.deepEqual(stagePosition('DISCOVERY').earlier, []);
  assert.deepEqual(stagePosition('MONITORING').later, []);
});
