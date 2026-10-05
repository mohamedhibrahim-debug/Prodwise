'use client';
import { useFormAction } from '@/components/forms/useFormAction';
import { ScopeField } from '@/components/auth/WorkspaceScope';
import { autoSyncAction } from '@/app/initiatives/[slug]/sources/auto-sync/actions';
import type { AutoSyncView } from '@/lib/connectors/auto-sync';
import { formatDateTime } from '@/lib/domain/labels';
import styles from './connectors.module.css';

export function AutoSyncControl({ slug, itemId, job, available, canWrite }: { slug: string; itemId: string; job?: AutoSyncView; available: boolean; canWrite: boolean }) {
  const [state, action, pending, keepFormAction] = useFormAction(autoSyncAction, { error: null, message: null });
  const active = job?.status === 'ACTIVE';
  const overdue = job?.overdue;
  return <form action={action} onReset={keepFormAction} aria-busy={pending}>
    <ScopeField /><input type="hidden" name="slug" value={slug} /><input type="hidden" name="itemId" value={itemId} /><input type="hidden" name="revision" value={job?.revision ?? 0} />
    <label className={styles.syncMeta}><input key={`${job?.revision ?? 0}-${active}-${pending}`} type="checkbox" name="enabled" defaultChecked={active} disabled={pending || !canWrite || (!available && !active)} onChange={e => e.currentTarget.form?.requestSubmit()} /> Auto-sync / every 15 minutes</label>
    <p className={styles.syncMeta}>{!available ? 'Background runner unavailable on this installation.' : overdue ? 'Check overdue. Background runner may be offline.' : job?.status === 'ATTENTION' ? 'Paused: account or source access needs attention.' : active ? 'Enabled' : 'Paused'}{job ? ` / ${job.ownerLabel}` : ''}</p>
    {job?.lastSuccessAt && <p className={styles.syncMeta}>Last successful check {formatDateTime(job.lastSuccessAt)}</p>}
    {job?.lastError && <p className={styles.syncDetail}>Last check: {job.lastError}. Earlier snapshots are kept.</p>}
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}
    {state.message && <p className={styles.refreshNote} role="status">{state.message}</p>}
  </form>;
}
