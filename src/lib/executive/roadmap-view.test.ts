import test from 'node:test';
import assert from 'node:assert/strict';
import { planVarianceDays } from './roadmap-view.ts';

test('roadmap variance uses actual before forecast and retains signed days', () => {
  const target = { value: '2027-04-10', precision: 'DAY' as const };
  assert.equal(planVarianceDays({ target, actual: '2027-04-12', forecast: '2027-04-20' }), 2);
  assert.equal(planVarianceDays({ target, actual: null, forecast: '2027-04-08' }), -2);
  assert.equal(planVarianceDays({ target, actual: '2027-04-10', forecast: null }), 0);
});

test('roadmap variance remains unknown without a precise target or a recorded end', () => {
  assert.equal(planVarianceDays({ target: null, actual: '2027-04-12', forecast: null }), null);
  assert.equal(planVarianceDays({ target: { value: '2027-04', precision: 'MONTH' }, actual: '2027-04-12', forecast: null }), null);
  assert.equal(planVarianceDays({ target: { value: '2027-04-10', precision: 'DAY' }, actual: null, forecast: null }), null);
});
