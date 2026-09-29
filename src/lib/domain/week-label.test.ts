import test from 'node:test';
import assert from 'node:assert/strict';
import { weekLabel } from './labels.ts';

test('an ISO week reads as the product writes it elsewhere, with the year only when it differs', () => {
  assert.equal(weekLabel('2026-W39'), 'W39');
  assert.equal(weekLabel('2026-W39', '2026'), 'W39');
  assert.equal(weekLabel('2025-W52', '2026'), 'W52 2025');
  assert.equal(weekLabel('not a week'), 'not a week');
});
