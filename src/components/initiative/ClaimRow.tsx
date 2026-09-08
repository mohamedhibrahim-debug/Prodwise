import Link from "next/link";

import { isDemoWriteEnabled, WRITE_DISABLED_MESSAGE } from "@/lib/env";
import { CategoryTag, Reference } from "@/components/primitives/Meta";
import {
  CLAIM_STATUS_LABEL,
  CLAIM_TYPE_LABEL,
  DOMAIN_LABEL,
  EVIDENCE_RELATION_LABEL,
  EVIDENCE_SOURCE_TYPE_LABEL,
  formatDate,
  formatVerified,
} from "@/lib/domain/labels";
import type { ClaimWithEvidence } from "@/lib/domain/types";
import styles from "./ClaimRow.module.css";

interface ClaimRowProps {
  claim: ClaimWithEvidence;
  slug: string;
  /** The claim that replaced this one, when it has been recorded. */
  supersededBy?: ClaimWithEvidence;
  /** Claims this one replaced — derived from the reverse relation. */
  supersedes?: ClaimWithEvidence[];
}

/**
 * Names a related claim unambiguously.
 *
 * A value alone is not an identity — "Superseded by 27" tells the reader
 * nothing about what 27 refers to, and two claims can share a value. The full
 * address subject · attribute · value is what actually identifies a claim.
 */
function identify(claim: ClaimWithEvidence): string {
  return `${claim.subject} · ${claim.attribute} · ${claim.value}`;
}

/**
 * One unit of Product Memory.
 *
 * Leads with the knowledge itself — subject · attribute · value — then its
 * classification. Provenance, confidence and supersession sit behind that, and
 * the full evidence list is behind the disclosure, so the grouped views stay
 * scannable.
 *
 * Nothing here asserts a relationship between claims beyond supersession, which
 * a human set. Phase 3 records knowledge; it does not judge it.
 */
export function ClaimRow({
  claim,
  slug,
  supersededBy,
  supersedes = [],
}: ClaimRowProps) {
  const statusClass = styles[`status${claim.status}`] ?? "";
  const isSuperseded = claim.status === "SUPERSEDED";

  return (
    <li className={styles.row}>
      <details className={styles.disclosure}>
        <summary className={styles.summary}>
          <svg
            className={styles.chevron}
            width="10"
            height="10"
            viewBox="0 0 10 10"
            aria-hidden="true"
          >
            <path
              d="M3 1.5 L7 5 L3 8.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <span className={styles.main}>
            <span className={styles.head}>
              <span className={styles.subject}>{claim.subject}</span>
              <span className={styles.attribute}>{claim.attribute}</span>
              <span className={styles.spacer} />
              <CategoryTag>{CLAIM_TYPE_LABEL[claim.type]}</CategoryTag>
              <span className={`${styles.status} ${statusClass}`}>
                {CLAIM_STATUS_LABEL[claim.status]}
              </span>
            </span>

            <span
              className={`${styles.value} ${isSuperseded ? styles.supersededValue : ""}`}
            >
              {claim.value}
            </span>

            <span className={styles.facts}>
              <span className={styles.fact}>
                Domain <b>{DOMAIN_LABEL[claim.domain]}</b>
              </span>
              {claim.phase ? (
                <span className={styles.fact}>
                  Phase <b>{claim.phase}</b>
                </span>
              ) : null}
              <span className={styles.fact}>
                {claim.evidence.length === 0 ? (
                  <span className={styles.noEvidence}>No evidence linked</span>
                ) : (
                  <>
                    Evidence{" "}
                    <b>
                      {claim.evidence.length}{" "}
                      {claim.evidence.length === 1 ? "record" : "records"}
                    </b>
                  </>
                )}
              </span>
              {claim.confidence ? (
                <span className={styles.fact}>
                  Confidence <b>{claim.confidence.toLowerCase()}</b>
                </span>
              ) : null}
            </span>

            {supersededBy ? (
              <span className={styles.relation}>
                Superseded by <b>{identify(supersededBy)}</b>
              </span>
            ) : null}
            {supersedes.map((c) => (
              <span key={c.id} className={styles.relation}>
                Supersedes <b>{identify(c)}</b>
              </span>
            ))}
          </span>
        </summary>

        <div className={styles.detail}>
          <div className={styles.detailLabel}>Evidence</div>
          {claim.evidence.length === 0 ? (
            <p className={styles.detailMuted}>
              No evidence linked. This claim has not been connected to a source
              record yet — it is not, on that basis, incorrect.
            </p>
          ) : (
            <ul className={styles.evidenceList}>
              {claim.evidence.map((e) => (
                <li key={e.id} className={styles.evidenceItem}>
                  <span className={styles.evidenceTop}>
                    <span className={styles.evidenceTitle}>{e.title}</span>
                    {e.sourceReference ? (
                      <Reference>{e.sourceReference}</Reference>
                    ) : null}
                    <span className={styles.evidenceKind}>
                      {EVIDENCE_SOURCE_TYPE_LABEL[e.sourceType]}
                    </span>
                    {/* Evidence excluded after it was linked stays visible and
                        is marked, so provenance history is never rewritten. */}
                    <span
                      className={
                        e.boundary === "EXCLUDED"
                          ? styles.excludedTag
                          : styles.boundaryTag
                      }
                    >
                      {e.boundary === "EXCLUDED"
                        ? "Excluded evidence"
                        : EVIDENCE_RELATION_LABEL[e.boundary]}
                    </span>
                  </span>
                  <span className={styles.evidenceMeta}>
                    {e.occurredAt ? `Dated ${formatDate(e.occurredAt)}` : "Date unknown"}
                    <span className={styles.metaSep} aria-hidden="true">
                      ·
                    </span>
                    {formatVerified(e.lastVerifiedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {isDemoWriteEnabled ? (
            <Link
              href={`/initiatives/${slug}/memory/${claim.id}/edit`}
              className={styles.editLink}
            >
              Edit claim
            </Link>
          ) : (
            <p title={WRITE_DISABLED_MESSAGE}>Read-only · Demo mode</p>
          )}
        </div>
      </details>
    </li>
  );
}
