"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  reopenFindingAction,
  resolveFindingAction,
  type FindingFormState,
} from "@/app/initiatives/[slug]/review/actions";
import styles from "./FindingRow.module.css";

const EMPTY: FindingFormState = { error: null };

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.submit} disabled={pending}>
      {pending ? busy : label}
    </button>
  );
}

/**
 * Resolving records a person's decision about a finding. It does not change
 * Product Memory, and the form says so before it is submitted — otherwise
 * "Resolved" reads as "the data was corrected".
 *
 * Collapsed by default, so the action sits as one quiet control in the finding's
 * action row rather than as a permanently open form competing with the values.
 *
 * Only rendered for actionable findings, and only when writes are enabled. The
 * real control is server-side: the action re-derives the fingerprint and refuses
 * anything that is not a currently-derived, actionable finding on this
 * initiative. Hiding the form is convenience, not security.
 */
export function ResolveFindingForm({
  slug,
  fingerprint,
  contentDigest,
  resolved,
}: {
  slug: string;
  fingerprint: string;
  contentDigest: string;
  resolved: boolean;
}) {
  const [resolveState, resolve] = useActionState(resolveFindingAction, EMPTY);
  const [reopenState, reopen] = useActionState(reopenFindingAction, EMPTY);
  const error = resolveState.error ?? reopenState.error;

  if (resolved) {
    return (
      <form action={reopen} className={styles.resolveDisclosure}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="fingerprint" value={fingerprint} />
        {error ? <p className={styles.error}>{error}</p> : null}
        <Submit label="Reopen finding" busy="Reopening…" />
      </form>
    );
  }

  return (
    <details className={styles.resolveDisclosure} open={Boolean(error)}>
      <summary className={styles.resolveTrigger}>Mark resolved</summary>

      <form action={resolve} className={styles.resolveForm}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="fingerprint" value={fingerprint} />
        {/* What the reader actually saw. Checked server-side so a decision
            cannot be recorded against a finding that changed while they typed. */}
        <input type="hidden" name="contentDigest" value={contentDigest} />

        <label
          htmlFor={`resolution-${fingerprint}`}
          className={styles.resolveLabel}
        >
          Record what was decided
        </label>
        <textarea
          id={`resolution-${fingerprint}`}
          name="resolution"
          rows={2}
          required
          className={styles.resolveInput}
          /* Echoed back by the action on failure. React resets an uncontrolled
             field once the action settles, so without this a rejected submit
             emptied the box the user had just filled in. The key forces a
             remount so the restored value actually takes. */
          key={resolveState.resolution ?? "empty"}
          defaultValue={resolveState.resolution ?? ""}
          placeholder="e.g. Confirmed with Finance that 27 is authoritative; MFF-133 to be corrected."
        />

        <p className={styles.resolveCaption}>
          This records your decision. It does not change the claims — they will
          still record exactly what they record now.
        </p>

        {error ? <p className={styles.error}>{error}</p> : null}
        <Submit label="Save decision" busy="Saving…" />
      </form>
    </details>
  );
}
