import test from 'node:test';
import assert from 'node:assert/strict';
import { latestDecisionAt, recordedBeforeDecision } from './decision-followup.ts';

const state = (over: Partial<{ status: 'OPEN' | 'RESOLVED'; outcome: 'CHOSE_EXISTING' | 'CORRECTED_VALUE' | null; resolvedAt: string | null }> = {}) =>
  ({ status: 'RESOLVED' as const, outcome: 'CHOSE_EXISTING' as const, resolvedAt: '2026-09-29T11:25:00Z', ...over });

test('the latest decision is the newest resolved state with a decision outcome', () => {
  assert.equal(latestDecisionAt([]), null);
  assert.equal(latestDecisionAt([state({ outcome: null })]), null, 'a resolution note without a decision is not a decision');
  assert.equal(latestDecisionAt([state({ status: 'OPEN' })]), null, 'a reopened decision is not current');
  assert.equal(latestDecisionAt([state({ resolvedAt: '2026-09-20T10:00:00Z' }), state(), state({ resolvedAt: 'not a date' })]), '2026-09-29T11:25:00Z');
});

test('a fact recorded before the latest decision asks for a check; one recorded after it does not', () => {
  const decided = '2026-09-29T11:25:00Z';
  assert.equal(recordedBeforeDecision({ updatedAt: '2026-09-24T08:00:00Z' }, decided), decided);
  assert.equal(recordedBeforeDecision({ updatedAt: '2026-09-29T12:00:00Z' }, decided), null);
  assert.equal(recordedBeforeDecision({ updatedAt: decided }, decided), null, 'same instant is not "before"');
  assert.equal(recordedBeforeDecision(null, decided), null, 'no fact recorded, nothing to question');
  assert.equal(recordedBeforeDecision({ updatedAt: '2026-09-24T08:00:00Z' }, null), null, 'no decision, no prompt');
});
