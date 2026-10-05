import { randomUUID } from 'node:crypto';

export const SYNC_INTERVAL_MS = 15 * 60_000;
export const SYNC_LEASE_MS = 5 * 60_000;
export interface JiraSyncJob {
  id: string;
  workspaceId: string;
  organizationId: string;
  initiativeId: string;
  itemId: string;
  userId: string;
  ownerLabel: string;
  connectionId: string;
  connectionGrantedAt: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'ATTENTION';
  nextRunAt: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  failures: number;
  leaseToken: string | null;
  leaseUntil: string | null;
  revision: number;
}
export function claimDueJob(jobs: JiraSyncJob[], now: string): JiraSyncJob | null {
  const job = jobs.filter(j => j.status === 'ACTIVE' && j.nextRunAt <= now && (!j.leaseUntil || j.leaseUntil <= now))
    .sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt) || a.id.localeCompare(b.id))[0];
  if (!job) return null;
  Object.assign(job, { leaseToken: randomUUID(), leaseUntil: new Date(Date.parse(now) + SYNC_LEASE_MS).toISOString(), lastAttemptAt: now, revision: job.revision + 1 });
  return structuredClone(job);
}
export function ownsLease(job: JiraSyncJob, claim: JiraSyncJob, now: string): boolean {
  return job.id === claim.id && job.status === 'ACTIVE' && job.revision === claim.revision && !!job.leaseToken && job.leaseToken === claim.leaseToken && !!job.leaseUntil && job.leaseUntil > now;
}
export function finishJob(job: JiraSyncJob, now: string, error: string | null, permanent = false): void {
  const failures = error ? job.failures + 1 : 0;
  Object.assign(job, { status: permanent ? 'ATTENTION' : 'ACTIVE', failures, lastError: error,
    lastSuccessAt: error ? job.lastSuccessAt : now,
    nextRunAt: new Date(Date.parse(now) + (error ? Math.min(6 * 60 * 60_000, SYNC_INTERVAL_MS * 2 ** Math.min(failures - 1, 5)) : SYNC_INTERVAL_MS)).toISOString(),
    leaseToken: null, leaseUntil: null, revision: job.revision + 1 });
}
export function pauseJob(job: JiraSyncJob): void {
  Object.assign(job, { status: 'PAUSED', leaseToken: null, leaseUntil: null, revision: job.revision + 1 });
}
