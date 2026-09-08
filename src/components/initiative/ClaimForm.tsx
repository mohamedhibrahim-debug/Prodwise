"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { Button } from "@/components/primitives/Button";
import {
  CLAIM_STATUS_LABEL,
  CLAIM_TYPE_LABEL,
  DOMAIN_LABEL,
  EVIDENCE_RELATION_LABEL,
  EVIDENCE_SOURCE_TYPE_LABEL,
} from "@/lib/domain/labels";
import {
  CLAIM_STATUSES,
  CLAIM_TYPES,
  DOMAINS,
  type ClaimWithEvidence,
  type EvidenceRecord,
} from "@/lib/domain/types";
import styles from "@/app/initiatives/[slug]/evidence/evidence-form.module.css";
import claimStyles from "./ClaimForm.module.css";

interface FormState {
  error: string | null;
}

interface ClaimFormProps {
  slug: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  /** Evidence on this initiative, for the provenance picker. */
  evidence: EvidenceRecord[];
  /** Present when editing. */
  claim?: ClaimWithEvidence;
  /** Other claims on this initiative, offered as a replacement. */
  replacementOptions?: ClaimWithEvidence[];
}

const initialState: FormState = { error: null };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

/**
 * Add / edit a claim.
 *
 * Creation asks for the knowledge and nothing else — no status, no confidence.
 * A new claim is always UNVERIFIED, because nobody has checked it yet, and
 * confidence is only ever displayed for migrated records.
 */
export function ClaimForm({
  slug,
  action,
  submitLabel,
  evidence,
  claim,
  replacementOptions = [],
}: ClaimFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const isEdit = Boolean(claim);

  const linkedIds = new Set(claim?.evidence.map((e) => e.id) ?? []);

  // Excluded evidence is not offered for NEW links, but one that was linked
  // before it was excluded stays in the list — checked, and unlinkable only by
  // deliberate choice. Dropping it silently would rewrite provenance history.
  const selectable = evidence.filter(
    (e) => e.boundary !== "EXCLUDED" || linkedIds.has(e.id),
  );

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="slug" value={slug} />
      {claim ? <input type="hidden" name="claimId" value={claim.id} /> : null}

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}

      <div className={styles.pair}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="type">
            Type
          </label>
          <select
            id="type"
            name="type"
            required
            className={styles.select}
            defaultValue={claim?.type ?? "REQUIREMENT"}
          >
            {CLAIM_TYPES.map((t) => (
              <option key={t} value={t}>
                {CLAIM_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="domain">
            Domain
          </label>
          <select
            id="domain"
            name="domain"
            required
            className={styles.select}
            defaultValue={claim?.domain ?? "PRODUCT"}
          >
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {DOMAIN_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.pair}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="subject">
            Subject
          </label>
          <input
            id="subject"
            name="subject"
            type="text"
            required
            maxLength={160}
            autoComplete="off"
            className={styles.input}
            defaultValue={claim?.subject ?? ""}
            placeholder="e.g. Daily Repayment"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="attribute">
            Attribute
          </label>
          <input
            id="attribute"
            name="attribute"
            type="text"
            required
            maxLength={160}
            autoComplete="off"
            className={styles.input}
            defaultValue={claim?.attribute ?? ""}
            placeholder="e.g. Calculation Divisor"
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="value">
          Value
        </label>
        <textarea
          id="value"
          name="value"
          rows={2}
          required
          className={styles.textarea}
          defaultValue={claim?.value ?? ""}
          placeholder="e.g. 27"
        />
      </div>

      <div className={styles.optionalHead}>
        <span className={styles.optionalLabel}>
          {isEdit ? "Status, phase and provenance" : "Optional details"}
        </span>
      </div>

      <div className={styles.pair}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="phase">
            Phase
          </label>
          <input
            id="phase"
            name="phase"
            type="text"
            maxLength={80}
            autoComplete="off"
            className={styles.input}
            defaultValue={claim?.phase ?? ""}
            placeholder="e.g. Phase 1"
          />
        </div>

        {isEdit ? (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              required
              className={styles.select}
              defaultValue={claim?.status ?? "UNVERIFIED"}
            >
              {CLAIM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CLAIM_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Status</span>
            <p className={claimStyles.staticValue}>Unverified</p>
            <p className={styles.hint}>
              New claims start unverified — nobody has checked this yet. That is
              not the same as it being wrong. Change it later from Edit.
            </p>
          </div>
        )}
      </div>

      {isEdit ? (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="supersededByClaimId">
            Superseded by
          </label>
          <select
            id="supersededByClaimId"
            name="supersededByClaimId"
            className={styles.select}
            defaultValue={claim?.supersededByClaimId ?? ""}
          >
            <option value="">No known replacement</option>
            {/* Same identification as the relation display: a value alone does
                not identify a claim. */}
            {replacementOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.subject} · {c.attribute} · {c.value.slice(0, 60)}
              </option>
            ))}
          </select>
          <p className={styles.hint}>
            Only applies when the status is Superseded. A claim may be superseded
            without a known replacement — nothing is invented to fill this in.
          </p>
        </div>
      ) : null}

      {claim?.confidence ? (
        <div className={styles.field}>
          <span className={styles.label}>Confidence</span>
          <p className={claimStyles.staticValue}>
            {claim.confidence.charAt(0) + claim.confidence.slice(1).toLowerCase()}
          </p>
          <p className={styles.hint}>
            Recorded on this migrated claim. Confidence is not assigned by hand
            in this phase.
          </p>
        </div>
      ) : null}

      {/* ── Provenance ──────────────────────────────────────────────────── */}
      <div className={styles.field}>
        <span className={styles.label}>Supporting evidence</span>
        {selectable.length === 0 ? (
          <p className={styles.hint}>
            No evidence has been recorded on this initiative yet. A claim does
            not need evidence to be created.
          </p>
        ) : (
          <>
            <ul className={claimStyles.evidenceList}>
              {selectable.map((e) => {
                const wasExcluded = e.boundary === "EXCLUDED";
                return (
                  <li key={e.id} className={claimStyles.evidenceOption}>
                    <label className={claimStyles.checkRow}>
                      <input
                        type="checkbox"
                        name="evidenceIds"
                        value={e.id}
                        defaultChecked={linkedIds.has(e.id)}
                        className={claimStyles.checkbox}
                      />
                      <span className={claimStyles.checkBody}>
                        <span className={claimStyles.checkTop}>
                          <span className={claimStyles.evidenceTitle}>
                            {e.title}
                          </span>
                          {e.sourceReference ? (
                            <span className={claimStyles.evidenceRef}>
                              {e.sourceReference}
                            </span>
                          ) : null}
                          <span className={claimStyles.evidenceKind}>
                            {EVIDENCE_SOURCE_TYPE_LABEL[e.sourceType]}
                          </span>
                          <span
                            className={
                              wasExcluded
                                ? claimStyles.excludedTag
                                : claimStyles.boundaryTag
                            }
                          >
                            {wasExcluded
                              ? "Excluded evidence"
                              : EVIDENCE_RELATION_LABEL[e.boundary]}
                          </span>
                        </span>
                        {wasExcluded ? (
                          <span className={claimStyles.excludedNote}>
                            Linked before this evidence was excluded. It stays
                            linked unless you uncheck it.
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className={styles.hint}>
              Excluded evidence cannot be added as new support, because it sits
              outside the initiative boundary.
            </p>
          </>
        )}
      </div>

      <div className={styles.actions}>
        <SubmitButton label={submitLabel} />
        <Link href={`/initiatives/${slug}/memory`}>
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
