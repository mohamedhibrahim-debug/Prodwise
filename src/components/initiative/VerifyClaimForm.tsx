"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/primitives/Button";
import styles from "@/app/initiatives/[slug]/sources/evidence-form.module.css";

interface State { error: string | null }
function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="primary" disabled={pending}>{pending ? "Confirming…" : "Confirm Knowledge"}</Button>;
}

export function VerifyClaimForm({
  action,
  slug,
  claimId,
  expectedUpdatedAt,
}: {
  action: (state: State, data: FormData) => Promise<State>;
  slug: string;
  claimId: string;
  expectedUpdatedAt: string;
}) {
  const [state, submit] = useActionState(action, { error: null });
  return (
    <form action={submit} className={styles.form}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="claimId" value={claimId} />
      <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
      <div className={styles.field}>
        <label className={styles.label} htmlFor="basis">Confirmation basis</label>
        <select className={styles.select} id="basis" name="basis" defaultValue="EVIDENCE">
          <option value="EVIDENCE">Linked Source</option>
          <option value="DIRECT_KNOWLEDGE">Direct knowledge</option>
        </select>
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="note">Confirmation note</label>
        <textarea className={styles.textarea} id="note" name="note" rows={4} maxLength={2000} />
        <p className={styles.hint}>Required when the basis is direct knowledge.</p>
      </div>
      {state.error ? <p className={styles.error} role="alert">{state.error}</p> : null}
      <div className={styles.actions}><Submit /></div>
    </form>
  );
}
