"use client";

import { useActionState } from "react";
import { updateEvidenceAnchorAction } from "@/app/initiatives/[slug]/memory/actions";
import styles from "@/app/initiatives/[slug]/sources/evidence-form.module.css";
import { Button } from "@/components/primitives/Button";

export function EvidenceAnchorForm({
  slug, claimId, evidenceId, locator, excerpt,
}: {
  slug: string; claimId: string; evidenceId: string;
  locator: string | null; excerpt: string | null;
}) {
  const [state, action, pending] = useActionState(updateEvidenceAnchorAction, { error: null });
  return (
    <form action={action}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="claimId" value={claimId} />
      <input type="hidden" name="evidenceId" value={evidenceId} />
      <label className={styles.label}>Locator
        <input className={styles.input} name="locator" defaultValue={locator ?? ""} placeholder="Page, section, ticket field…" />
      </label>
      <label className={styles.label}>Excerpt
        <textarea className={styles.textarea} name="excerpt" defaultValue={excerpt ?? ""} maxLength={2000} rows={2} />
      </label>
      {state.error ? <p className={styles.error} role="alert">{state.error}</p> : null}
      {state.saved ? <p role="status">Anchor saved.</p> : null}
      <Button type="submit" variant="ghost" disabled={pending}>{pending ? "Saving…" : "Save anchor"}</Button>
    </form>
  );
}
