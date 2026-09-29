'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScopeField } from '@/components/auth/WorkspaceScope';
import { useFormAction } from '@/components/forms/useFormAction';
import { Button } from '@/components/primitives/Button';
import { commitmentAction } from '@/app/initiatives/[slug]/actions/actions';
import type { Commitment } from '@/lib/workspace/commitments';
import styles from './CompleteCommitment.module.css';

/**
 * One-click "Complete" for a commitment where it is listed. It submits the
 * existing commitment action with the record's current fields unchanged and
 * status DONE, bound to the revision the person saw, so a concurrent edit is
 * refused by the server exactly as the full editor would be. Callers only
 * render it when the viewer may change status and no blocker is recorded
 * (a blocker must be cleared in the editor first).
 */
export function CompleteCommitment({ slug, commitment: a }: { slug: string; commitment: Commitment }) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [state, action, pending, keep] = useFormAction(commitmentAction, { error: null as string | null, id: undefined as string | undefined });
  const router = useRouter(); const error = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (state.error) error.current?.focus(); else if (state.id) router.refresh(); }, [state, router]);
  if (state.id && !state.error) return <span className={styles.done} role="status">✓ Completed</span>;
  return <form action={action} onReset={keep} className={styles.form}>
    <ScopeField />
    <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={a.id} />
    <input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="revision" value={a.revision} />
    <input type="hidden" name="title" value={a.title} /><input type="hidden" name="assigneeMemberId" value={a.assigneeMemberId ?? ''} />
    <input type="hidden" name="dueDate" value={a.dueDate ?? ''} /><input type="hidden" name="evidenceId" value={a.evidenceId ?? ''} />
    <input type="hidden" name="blockedNote" value="" /><input type="hidden" name="status" value="DONE" /><input type="hidden" name="note" value="" />
    <Button type="submit" variant="secondary" className={styles.button} disabled={pending} aria-label={`Complete commitment: ${a.title}`}>{pending ? 'Saving…' : 'Complete'}</Button>
    {state.error && <p ref={error} tabIndex={-1} role="alert" className={styles.error}>{state.error}</p>}
  </form>;
}
