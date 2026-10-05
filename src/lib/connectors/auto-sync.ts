import 'server-only';
import { randomUUID } from 'node:crypto';
import { authorizeBusiness, AccessError, type WorkspaceAccess } from '@/lib/auth/core';
import { requireBusinessWriteAccess, requireWorkspaceAccess } from '@/lib/auth/access';
import { isLocalAuth, localAuthStore } from '@/lib/auth/service';
import { withRepositoryContext } from '@/lib/auth/repository-context';
import { readStore, writeStoreAtomic, type StoreShape } from '@/lib/data/store';
import { isDemoWriteEnabled } from '@/lib/env';
import { workspacePresentation } from '@/lib/workspace/context';
import { getConnection, localConnectionMatches } from './connections';
import { backgroundJiraSnapshot } from './service';
import { applyConnectorSnapshot, applySourceCheck } from './local-import';
import { ConnectorError } from './types';
import { claimDueJob, finishJob, ownsLease, pauseJob, type JiraSyncJob } from './auto-sync-model';
import { configureHostedSync, hostedSyncJobs, runHostedSync } from './auto-sync-hosted';

export const syncWorkerSecret = () => isLocalAuth() ? process.env.JIRA_SYNC_SECRET : process.env.CRON_SECRET;
export function autoSyncAvailable(): boolean {
  return process.env.JIRA_AUTO_SYNC_ENABLED === 'true' && (syncWorkerSecret()?.length ?? 0) >= 32 && isDemoWriteEnabled;
}
function requireRunner() { if (!autoSyncAvailable()) throw new Error('Background sync is not configured for this installation.'); }
function sourceFor(s: StoreShape, workspaceId: string, initiativeId: string, itemId: string) {
  const initiative = s.initiatives.find(i => i.workspaceId === workspaceId && i.id === initiativeId);
  const sync = s.sourceItemSyncs?.find(x => x.workspaceId === workspaceId && x.initiativeId === initiativeId && x.itemId === itemId && x.connector === 'JIRA');
  const item = s.sourceItems?.find(x => x.workspaceId === workspaceId && x.id === itemId);
  const container = s.sourceContainers?.find(x => x.workspaceId === workspaceId && x.id === item?.containerId);
  if (!initiative || initiative.archivedAt || !sync || !item || !container || !s.sourceMappings?.some(x => x.workspaceId === workspaceId && x.initiativeId === initiativeId && x.itemId === itemId && !x.unlinkedAt)) throw new ConnectorError('NO_ACCESS');
  return { item, container, sync };
}
async function nonDemo(ctx: WorkspaceAccess) { if ((await workspacePresentation(ctx)).isDemo) throw new ConnectorError('DEMO_ORGANIZATION'); }
export type AutoSyncView = Pick<JiraSyncJob, 'itemId' | 'status' | 'ownerLabel' | 'lastAttemptAt' | 'lastSuccessAt' | 'lastError' | 'nextRunAt' | 'revision'> & { mine: boolean; overdue: boolean };
export async function readAutoSync(initiativeId: string): Promise<{ available: boolean; jobs: AutoSyncView[] }> {
  const ctx = await requireWorkspaceAccess();
  // Existing installations without migration 0048 remain readable while the feature is off.
  if (!isLocalAuth() && process.env.JIRA_AUTO_SYNC_ENABLED !== 'true') return { available: false, jobs: [] };
  const jobs = isLocalAuth() ? await withRepositoryContext(ctx, async () => (readStore().jiraSyncJobs ?? []).filter(x => x.workspaceId === ctx.workspaceId && x.initiativeId === initiativeId)) : await hostedSyncJobs(ctx, initiativeId);
  return { available: autoSyncAvailable(), jobs: jobs.map(x => ({ itemId: x.itemId, status: x.status, ownerLabel: x.ownerLabel, lastAttemptAt: x.lastAttemptAt, lastSuccessAt: x.lastSuccessAt, lastError: x.lastError, nextRunAt: x.nextRunAt, revision: x.revision, mine: x.userId === ctx.actor.id, overdue: x.status === 'ACTIVE' && Date.now() - Date.parse(x.nextRunAt) > 5 * 60_000 })) };
}
export async function configureAutoSync(initiativeId: string, itemId: string, enabled: boolean, revision: number): Promise<void> {
  const ctx = await requireBusinessWriteAccess(); await nonDemo(ctx);
  if (enabled) requireRunner();
  if (!isLocalAuth()) return configureHostedSync(ctx, initiativeId, itemId, enabled, revision);
  const connection = enabled ? await getConnection(ctx.organizationId, ctx.actor.id, 'JIRA') : null;
  // Require an explicit stored connection even for synthetic fixtures.
  if (enabled && connection?.status !== 'CONNECTED') throw new ConnectorError('NOT_CONNECTED');
  await withRepositoryContext(ctx, async () => writeStoreAtomic(s => {
    authorizeBusiness(localAuthStore(ctx.workspaceId).contextForBackground(ctx.actor.id), isDemoWriteEnabled);
    sourceFor(s, ctx.workspaceId, initiativeId, itemId);
    const jobs = (s.jiraSyncJobs ??= []);
    const current = jobs.find(x => x.workspaceId === ctx.workspaceId && x.initiativeId === initiativeId && x.itemId === itemId);
    if ((current?.revision ?? 0) !== revision) throw new Error('Sync settings changed. Reload before trying again.');
    if (!enabled) { if (current) pauseJob(current); return; }
    if (!localConnectionMatches(ctx.organizationId, ctx.actor.id, connection!.id, connection!.connectedAt)) throw new ConnectorError('NOT_CONNECTED');
    if (current && current.userId !== ctx.actor.id && current.status === 'ACTIVE') throw new Error('Pause the existing sync before switching its connected account.');
    const grant: JiraSyncJob = { id: current?.id ?? randomUUID(), workspaceId: ctx.workspaceId, organizationId: ctx.organizationId, initiativeId, itemId, userId: ctx.actor.id, ownerLabel: ctx.actor.label,
      connectionId: connection!.id, connectionGrantedAt: connection!.connectedAt, status: 'ACTIVE', nextRunAt: new Date().toISOString(), lastAttemptAt: current?.lastAttemptAt ?? null, lastSuccessAt: current?.lastSuccessAt ?? null,
      lastError: null, failures: 0, leaseToken: null, leaseUntil: null, revision: (current?.revision ?? 0) + 1 };
    if (current) Object.assign(current, grant); else jobs.push(grant);
  }));
}
async function jobAccess(job: JiraSyncJob): Promise<WorkspaceAccess> {
  const ctx = localAuthStore(job.workspaceId).contextForBackground(job.userId);
  authorizeBusiness(ctx, isDemoWriteEnabled); await nonDemo(ctx);
  if (ctx.organizationId !== job.organizationId) throw new ConnectorError('NO_ACCESS');
  const connection = await getConnection(job.organizationId, job.userId, 'JIRA');
  if (!connection || connection.status !== 'CONNECTED' || connection.id !== job.connectionId || connection.connectedAt !== job.connectionGrantedAt) throw new ConnectorError('NOT_CONNECTED');
  return ctx;
}
/** Secret-authenticated runner only. One job per tick, durable lease, no browser session. */
export async function runAutoSync(): Promise<{ outcome: 'IDLE' | 'SAVED' | 'UNCHANGED' | 'FAILED' | 'STALE'; code?: string }> {
  requireRunner();
  if (!isLocalAuth()) return runHostedSync();
  const claim = writeStoreAtomic(s => claimDueJob(s.jiraSyncJobs ?? [], new Date().toISOString()));
  if (!claim) return { outcome: 'IDLE' };
  try {
    const ctx = await jobAccess(claim);
    const source = sourceFor(readStore(), claim.workspaceId, claim.initiativeId, claim.itemId);
    const snapshot = await backgroundJiraSnapshot(ctx, source.item.reference, source.container.providerWorkspace);
    // Re-read connection and authorization after network I/O, before atomic publication.
    await jobAccess(claim);
    requireRunner();
    return await withRepositoryContext(ctx, async () => writeStoreAtomic(s => {
      authorizeBusiness(localAuthStore(claim.workspaceId).contextForBackground(claim.userId), isDemoWriteEnabled);
      const now = new Date().toISOString(), current = s.jiraSyncJobs?.find(x => x.id === claim.id);
      if (!current || !ownsLease(current, claim, now)) return { outcome: 'STALE' as const };
      if (!localConnectionMatches(claim.organizationId, claim.userId, claim.connectionId, claim.connectionGrantedAt)) throw new ConnectorError('NOT_CONNECTED');
      const latest = sourceFor(s, claim.workspaceId, claim.initiativeId, claim.itemId);
      // A manual refresh may have finished while Jira was being read. Do not replace its result.
      if (latest.sync.revision !== source.sync.revision) {
        finishJob(current, now, 'CHECK_SUPERSEDED');
        return { outcome: 'STALE' as const };
      }
      const result = applyConnectorSnapshot(s, ctx, { initiativeId: claim.initiativeId, mode: 'REFRESH', role: 'GENERAL', requestId: randomUUID(), snapshot }, now);
      finishJob(current, now, null);
      return { outcome: result.changed ? 'SAVED' as const : 'UNCHANGED' as const };
    }));
  } catch (error) {
    const code = error instanceof ConnectorError ? error.code : error instanceof AccessError ? 'ACCESS_REVOKED' : 'SYNC_FAILED';
    const permanent = error instanceof AccessError || ['NOT_CONNECTED', 'NEEDS_RECONNECT', 'NO_ACCESS', 'NOT_FOUND', 'DEMO_ORGANIZATION', 'NOT_CONFIGURED', 'INVALID_REQUEST', 'UNSUPPORTED', 'VIEW_ONLY', 'SCOPE_REFUSED'].includes(code);
    writeStoreAtomic(s => {
      const now = new Date().toISOString(), current = s.jiraSyncJobs?.find(x => x.id === claim.id);
      if (!current || !ownsLease(current, claim, now)) return;
      finishJob(current, now, code, permanent);
      // Preserve the earlier snapshot, and record provider failure only while the grant is valid.
      try {
        const ctx = localAuthStore(claim.workspaceId).contextForBackground(claim.userId);
        authorizeBusiness(ctx, isDemoWriteEnabled); sourceFor(s, claim.workspaceId, claim.initiativeId, claim.itemId);
        if (error instanceof ConnectorError && ['NOT_FOUND', 'NO_ACCESS', 'PROVIDER_UNAVAILABLE', 'RATE_LIMITED'].includes(code)) applySourceCheck(s, ctx, claim.initiativeId, claim.itemId, code === 'NOT_FOUND' ? 'NOT_FOUND' : code === 'NO_ACCESS' ? 'NO_ACCESS' : 'FAILED', now);
      } catch { /* Access loss stops the job without editing the source. */ }
    });
    return { outcome: 'FAILED', code };
  }
}
