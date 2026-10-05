import test from 'node:test';
import assert from 'node:assert/strict';
import { claimDueJob, finishJob, ownsLease, pauseJob, SYNC_INTERVAL_MS, SYNC_LEASE_MS, type JiraSyncJob } from './auto-sync-model.ts';
import { validWorkerSecret } from './worker-auth.ts';

const now = '2026-10-05T10:00:00.000Z';
const later = (ms: number) => new Date(Date.parse(now) + ms).toISOString();
const job = (): JiraSyncJob => ({ id: 'job', workspaceId: 'ws', organizationId: 'org', initiativeId: 'initiative', itemId: 'item', userId: 'user', ownerLabel: 'Owner', connectionId: 'connection', connectionGrantedAt: now, status: 'ACTIVE', nextRunAt: now, lastAttemptAt: null, lastSuccessAt: null, lastError: null, failures: 0, leaseToken: null, leaseUntil: null, revision: 1 });

test('claim is durable, excludes a second runner and does not mutate returned lease', () => {
  const jobs = [job()]; const claim = claimDueJob(jobs, now)!;
  assert.equal(ownsLease(jobs[0]!, claim, now), true);
  assert.equal(claimDueJob(jobs, now), null);
  claim.status = 'PAUSED'; assert.equal(jobs[0]!.status, 'ACTIVE');
});
test('paused and future jobs are not claimed', () => {
  const a = job(), b = job(); a.status = 'PAUSED'; b.nextRunAt = later(1);
  assert.equal(claimDueJob([a, b], now), null);
});
test('expired lease can recover, but the old worker cannot publish', () => {
  const jobs = [job()], first = claimDueJob(jobs, now)!;
  assert.equal(ownsLease(jobs[0]!, first, later(SYNC_LEASE_MS)), false);
  const second = claimDueJob(jobs, later(SYNC_LEASE_MS))!;
  assert.notEqual(first.leaseToken, second.leaseToken);
  assert.equal(ownsLease(jobs[0]!, first, later(SYNC_LEASE_MS)), false);
  assert.equal(ownsLease(jobs[0]!, second, later(SYNC_LEASE_MS)), true);
});
test('pause invalidates an in-flight lease', () => {
  const jobs = [job()], claim = claimDueJob(jobs, now)!;
  pauseJob(jobs[0]!);
  assert.equal(ownsLease(jobs[0]!, claim, now), false);
  assert.equal(jobs[0]!.leaseToken, null);
});
test('transient failures back off with cap and preserve last success', () => {
  const j = job(); j.lastSuccessAt = now;
  finishJob(j, now, 'RATE_LIMITED'); assert.equal(j.nextRunAt, later(SYNC_INTERVAL_MS));
  finishJob(j, now, 'PROVIDER_UNAVAILABLE'); assert.equal(j.nextRunAt, later(2 * SYNC_INTERVAL_MS));
  for (let i = 0; i < 12; i++) finishJob(j, now, 'SYNC_FAILED');
  assert.equal(j.nextRunAt, later(6 * 60 * 60_000)); assert.equal(j.lastSuccessAt, now);
  finishJob(j, now, null); assert.equal(j.failures, 0); assert.equal(j.lastError, null); assert.equal(j.nextRunAt, later(SYNC_INTERVAL_MS));
});
test('permanent access failures require explicit re-enable', () => {
  const j = job(); finishJob(j, now, 'ACCESS_REVOKED', true);
  assert.equal(j.status, 'ATTENTION'); assert.equal(claimDueJob([j], later(86400_000)), null);
});
test('worker refuses missing, short, malformed and incorrect secrets', () => {
  const secret = 'a'.repeat(40);
  assert.equal(validWorkerSecret(`Bearer ${secret}`, secret), true);
  for (const header of [null, secret, `Bearer ${secret}x`, `Bearer ${'b'.repeat(40)}`]) assert.equal(validWorkerSecret(header, secret), false);
  assert.equal(validWorkerSecret('Bearer short', 'short'), false);
  assert.equal(validWorkerSecret('Bearer undefined', undefined), false);
});
