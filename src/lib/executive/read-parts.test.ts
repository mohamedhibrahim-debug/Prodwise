import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readReportingParts } from './read-parts';
import { emptyExecutiveState, type PerformanceRow } from './types';

const row = (key: string) => ({ key } as PerformanceRow);
test('paged reporting preserves order and limits concurrency for a large snapshot', async () => {
  let active = 0, peak = 0;
  const state = await readReportingParts({ state: emptyExecutiveState(), rowCount: 102250, revision: 0 }, async (offset, revision) => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setImmediate(resolve)); active--;
    return { revision, rows: Array.from({ length: Math.min(5000, 102250-offset) }, (_, i) => row(String(offset+i))) };
  });
  assert.equal(peak, 4); assert.equal(state.rows.length, 102250);
  state.rows.forEach((item, i) => assert.equal(item.key, String(i)));
});
test('paged reporting refuses stale, truncated and oversized snapshots', async () => {
  const header = { state: emptyExecutiveState(), rowCount: 1, revision: 0 };
  await assert.rejects(readReportingParts(header, async () => ({ revision: 1, rows: [row('1')] })), /changed/);
  await assert.rejects(readReportingParts(header, async () => ({ revision: 0, rows: [] })), /changed/);
  await assert.rejects(readReportingParts({ ...header, rowCount: 300001 }, async () => { throw Error('must not fetch'); }), /Invalid/);
});
test('empty reporting needs no row requests and retains metadata', async () => {
  const state = emptyExecutiveState();
  assert.deepEqual(await readReportingParts({ state, rowCount: 0, revision: 0 }, async () => { throw Error('must not fetch'); }), state);
});
