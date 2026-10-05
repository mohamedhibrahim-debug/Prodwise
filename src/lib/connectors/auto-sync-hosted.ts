import 'server-only';
import { adminClient, backgroundWorkspaceAccess } from '@/lib/auth/service';
import { authorizeBusiness, AccessError, type WorkspaceAccess } from '@/lib/auth/core';
import { isDemoWriteEnabled } from '@/lib/env';
import { workspacePresentation } from '@/lib/workspace/context';
import { sha256Utf8 } from '@/lib/evidence/anchor';
import { getConnection } from './connections';
import { backgroundJiraSnapshot } from './service';
import { ConnectorError, type ProviderSnapshot } from './types';
import type { JiraSyncJob } from './auto-sync-model';

export interface WorkerOutcome { outcome: 'IDLE' | 'SAVED' | 'UNCHANGED' | 'FAILED' | 'STALE'; code?: string }
function fromRow(row: Record<string, unknown>): JiraSyncJob {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), value])) as unknown as JiraSyncJob;
}
export async function hostedSyncJobs(ctx: WorkspaceAccess, initiativeId: string): Promise<JiraSyncJob[]> {
  const { data, error } = await adminClient().from('jira_sync_jobs').select('*').eq('workspace_id', ctx.workspaceId).eq('organization_id', ctx.organizationId).eq('initiative_id', initiativeId).abortSignal(AbortSignal.timeout(10_000));
  if (error) throw new Error('Background sync storage is unavailable.');
  return (data ?? []).map(fromRow);
}
export async function configureHostedSync(ctx: WorkspaceAccess, initiativeId: string, itemId: string, enabled: boolean, revision: number): Promise<void> {
  const { error } = await adminClient().rpc('configure_jira_sync', { p_workspace_id: ctx.workspaceId, p_member_id: ctx.memberId ?? ctx.actor.id, p_initiative_id: initiativeId, p_item_id: itemId, p_enabled: enabled, p_revision: revision }).abortSignal(AbortSignal.timeout(15_000));
  if (!error) return;
  if (error.message.includes('NOT_CONNECTED')) throw new ConnectorError('NOT_CONNECTED');
  if (error.message.includes('STALE_REVISION')) throw new Error('Sync settings changed. Reload before trying again.');
  if (error.message.includes('SYNC_OWNER_CHANGE')) throw new Error('Pause the existing sync before switching its connected account.');
  throw new Error('Sync settings could not be saved. Check your access and source mapping.');
}
async function verifyGrant(job: JiraSyncJob): Promise<WorkspaceAccess> {
  const ctx = await backgroundWorkspaceAccess(job.workspaceId, job.userId);
  authorizeBusiness(ctx, isDemoWriteEnabled);
  if (ctx.organizationId !== job.organizationId || (await workspacePresentation(ctx)).isDemo) throw new ConnectorError('NO_ACCESS');
  const { error } = await adminClient().rpc('jira_sync_actor', { w: job.workspaceId, principal: ctx.memberId ?? ctx.actor.id }).abortSignal(AbortSignal.timeout(10_000));
  if (error) {
    if (/ACCESS_DENIED|EMAIL_NOT_ALLOWED|OWNER_BOOTSTRAP_REQUIRED|VIEW_ONLY|DEMO_ORGANIZATION/.test(error.message)) throw new AccessError('ACCESS_DENIED', 'Background grant is no longer authorized.');
    throw new Error('Grant verification unavailable.');
  }
  const c = await getConnection(job.organizationId, job.userId, 'JIRA');
  if (!c || c.status !== 'CONNECTED' || c.id !== job.connectionId || Date.parse(c.connectedAt ?? '') !== Date.parse(job.connectionGrantedAt ?? '')) throw new ConnectorError('NOT_CONNECTED');
  return ctx;
}
async function sourceFor(job: JiraSyncJob) {
  const db = adminClient();
  const { data: initiative, error: ie } = await db.from('initiatives').select('id,archived_at').eq('id', job.initiativeId).eq('workspace_id', job.workspaceId).abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
  if (ie) throw new Error('Source storage unavailable.');
  if (!initiative || initiative.archived_at) throw new ConnectorError('NO_ACCESS');
  const { data: mapping, error: me } = await db.from('source_mappings').select('id').eq('workspace_id', job.workspaceId).eq('initiative_id', job.initiativeId).eq('item_id', job.itemId).is('unlinked_at', null).abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
  if (me) throw new Error('Source storage unavailable.');
  if (!mapping) throw new ConnectorError('NO_ACCESS');
  const { data: item, error: se } = await db.from('source_items').select('reference,container_id').eq('workspace_id', job.workspaceId).eq('id', job.itemId).abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
  if (se) throw new Error('Source storage unavailable.');
  if (!item) throw new ConnectorError('NO_ACCESS');
  const { data: container, error: ce } = await db.from('source_containers').select('provider_workspace').eq('workspace_id', job.workspaceId).eq('id', item.container_id).eq('provider', 'JIRA').abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
  const { data: sync, error: ye } = await db.from('source_item_syncs').select('revision').eq('workspace_id', job.workspaceId).eq('initiative_id', job.initiativeId).eq('item_id', job.itemId).eq('connector', 'JIRA').abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
  if (ce || ye) throw new Error('Source storage unavailable.');
  if (!container || !sync) throw new ConnectorError('NO_ACCESS');
  return { reference: item.reference as string, providerWorkspace: container.provider_workspace as string, revision: sync.revision as number };
}
async function finish(job: JiraSyncJob, revision: number | null, snapshot: ProviderSnapshot | null, code: string | null): Promise<WorkerOutcome> {
  const { data, error } = await adminClient().rpc('finish_jira_sync', { p_job_id: job.id, p_token: job.leaseToken, p_revision: job.revision, p_sync_revision: revision,
    p_snapshot: snapshot ? { ...snapshot, textSha256: sha256Utf8(snapshot.text), charLength: snapshot.text.length } : null, p_error: code }).abortSignal(AbortSignal.timeout(20_000));
  if (error) throw new Error('Sync completion unavailable.');
  return data as WorkerOutcome;
}
export async function runHostedSync(): Promise<WorkerOutcome> {
  if (!isDemoWriteEnabled) throw new Error('Background writes disabled.');
  const { data, error } = await adminClient().rpc('claim_jira_sync').abortSignal(AbortSignal.timeout(10_000));
  if (error) throw new Error('Sync queue unavailable.');
  if (!data) return { outcome: 'IDLE' };
  const job = fromRow(data as Record<string, unknown>);
  let snapshot: ProviderSnapshot, revision: number;
  try {
    const ctx = await verifyGrant(job), source = await sourceFor(job);
    snapshot = await backgroundJiraSnapshot(ctx, source.reference, source.providerWorkspace);
    await verifyGrant(job);
    revision = source.revision;
  } catch (error) {
    const code = error instanceof ConnectorError ? error.code : error instanceof AccessError ? 'ACCESS_REVOKED' : 'SYNC_FAILED';
    return finish(job, null, null, code);
  }
  // Keep completion outside the catch: an uncertain commit must not be overwritten as failure.
  return finish(job, revision, snapshot, null);
}
