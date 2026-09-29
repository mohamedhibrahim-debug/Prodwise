'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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
 *
 * After a save the row says so where it was, and a notice with a link back to
 * the commitment stays in view: reopening is an ordinary edit in the editor
 * (a status change with a note), which keeps revision safety, so there is no
 * separate undo path here.
 */
export function CompleteCommitment({ slug, commitment: a, returnHref }: { slug: string; commitment: Commitment; returnHref?: string }) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [state, action, pending, keep] = useFormAction(commitmentAction, { error: null as string | null, id: undefined as string | undefined });
  const router = useRouter(); const error = useRef<HTMLParagraphElement>(null); const done = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (state.error) error.current?.focus(); else if (state.id) { done.current?.focus(); router.refresh(); } }, [state, router]);
  const href = returnHref ?? `/initiatives/${slug}/actions?action=${a.id}`;
  if (state.id && !state.error) return <p ref={done} tabIndex={-1} className={styles.done} role="status">
    <span className={styles.doneMark} aria-hidden="true">✓</span><span>Completed</span>
    <span className={styles.doneNote}>“{a.title.length > 60 ? `${a.title.slice(0, 60)}…` : a.title}” is marked done. <Link prefetch={false} href={href}>Open commitment</Link> to add a note or reopen it.</span>
  </p>;
  return <form action={action} onReset={keep} className={styles.form}>
    <ScopeField />
    <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={a.id} />
    <input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="revision" value={a.revision} />
    <input type="hidden" name="title" value={a.title} /><input type="hidden" name="assigneeMemberId" value={a.assigneeMemberId ?? ''} />
    <input type="hidden" name="dueDate" value={a.dueDate ?? ''} /><input type="hidden" name="evidenceId" value={a.evidenceId ?? ''} />
    <input type="hidden" name="blockedNote" value="" /><input type="hidden" name="status" value="DONE" /><input type="hidden" name="note" value="" />
    <Button type="submit" variant="secondary" size="sm" pending={pending} aria-label={`Complete commitment: ${a.title}`}>Complete</Button>
    {state.error && <p ref={error} tabIndex={-1} role="alert" className={styles.error}>{state.error}</p>}
  </form>;
}
