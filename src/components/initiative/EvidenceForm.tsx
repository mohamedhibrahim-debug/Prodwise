"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { Button } from "@/components/primitives/Button";
import {
  EVIDENCE_RELATION_LABEL,
  EVIDENCE_RELATION_NOTE,
  EVIDENCE_SOURCE_TYPE_LABEL,
} from "@/lib/domain/labels";
import {
  EVIDENCE_RELATIONS,
  EVIDENCE_SOURCE_TYPES,
  type EvidenceRecord,
  type EvidenceRelation,
} from "@/lib/domain/types";
import styles from "@/app/initiatives/[slug]/evidence/evidence-form.module.css";

interface FormState {
  error: string | null;
}

interface EvidenceFormProps {
  slug: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  /** Present when editing. */
  evidence?: EvidenceRecord;
}

const initialState: FormState = { error: null };

/** YYYY-MM-DD for a date input, from a stored instant. */
function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

/**
 * Add / edit evidence.
 *
 * Three required fields — title, source type, boundary — and nothing else is
 * mandatory. Everything below the divider is optional metadata that improves the
 * record without blocking capture. No upload, no parsing, no OCR: Phase 2
 * captures a described source, not its bytes.
 */
export function EvidenceForm({
  slug,
  action,
  submitLabel,
  evidence,
}: EvidenceFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  // The help text under the boundary select follows the selection. It used to
  // be pinned to the Current Scope wording, which was wrong for four of the
  // five values.
  const [boundary, setBoundary] = useState<EvidenceRelation>(
    evidence?.boundary ?? "CURRENT_SCOPE",
  );

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="slug" value={slug} />
      {evidence ? (
        <input type="hidden" name="evidenceId" value={evidence.id} />
      ) : null}

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="title">
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={200}
          autoComplete="off"
          className={styles.input}
          defaultValue={evidence?.title ?? ""}
          placeholder="e.g. Daily Repayment Requirement"
        />
      </div>

      <div className={styles.pair}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="sourceType">
            Source Type
          </label>
          <select
            id="sourceType"
            name="sourceType"
            required
            className={styles.select}
            defaultValue={evidence?.sourceType ?? "DOCUMENT"}
          >
            {EVIDENCE_SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {EVIDENCE_SOURCE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <p className={styles.hint}>
            Jira here is only a source type. Prodwise does not connect to Jira.
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="boundary">
            Boundary Classification
          </label>
          <select
            id="boundary"
            name="boundary"
            required
            className={styles.select}
            value={boundary}
            onChange={(e) => setBoundary(e.target.value as EvidenceRelation)}
          >
            {EVIDENCE_RELATIONS.map((r) => (
              <option key={r} value={r}>
                {EVIDENCE_RELATION_LABEL[r]}
              </option>
            ))}
          </select>
          <p className={styles.hint}>
            {EVIDENCE_RELATION_NOTE[boundary]} You can change this at any time.
          </p>
        </div>
      </div>

      <div className={styles.optionalHead}>
        <span className={styles.optionalLabel}>Optional details</span>
      </div>

      <div className={styles.pair}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="sourceReference">
            Source Reference
          </label>
          <input
            id="sourceReference"
            name="sourceReference"
            type="text"
            maxLength={120}
            autoComplete="off"
            className={styles.input}
            defaultValue={evidence?.sourceReference ?? ""}
            placeholder="e.g. MFF-118"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="occurredAt">
            Date
          </label>
          <input
            id="occurredAt"
            name="occurredAt"
            type="date"
            className={styles.input}
            defaultValue={toDateInput(evidence?.occurredAt)}
          />
          <p className={styles.hint}>
            When the artifact itself is dated. Leave blank if unknown.
          </p>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="sourceUrl">
          URL
        </label>
        <input
          id="sourceUrl"
          name="sourceUrl"
          type="url"
          maxLength={500}
          autoComplete="off"
          className={styles.input}
          defaultValue={evidence?.sourceUrl ?? ""}
          placeholder="https://"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="contentSummary">
          Short Summary
        </label>
        <textarea
          id="contentSummary"
          name="contentSummary"
          rows={3}
          className={styles.textarea}
          defaultValue={evidence?.contentSummary ?? ""}
          placeholder="One or two sentences describing what this evidence says."
        />
      </div>

      <div className={styles.actions}>
        <SubmitButton label={submitLabel} />
        <Link href={`/initiatives/${slug}/evidence`}>
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
