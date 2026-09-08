import Link from "next/link";

import { isDemoWriteEnabled, WRITE_DISABLED_MESSAGE } from "@/lib/env";
import { Reference, Timestamp } from "@/components/primitives/Meta";
import {
  EVIDENCE_SOURCE_TYPE_LABEL,
  EVIDENCE_RELATION_LABEL,
  formatDate,
  formatVerified,
} from "@/lib/domain/labels";
import type { EvidenceRecord } from "@/lib/domain/types";
import { EvidenceControls } from "./EvidenceControls";
import styles from "./EvidenceRow.module.css";

/**
 * One evidence record.
 *
 * The row shows only what helps a PM judge the item without opening it: title,
 * source type, reference, when it happened, and how fresh the verification is.
 * Everything else lives behind the disclosure, so the grouped lists stay
 * scannable.
 *
 * There is no "classified because" line. Phase 2 has no classifier — a human
 * sets the boundary — and printing a system-sounding rationale would imply
 * reasoning that does not exist.
 */
export function EvidenceRow({
  item,
  slug,
}: {
  item: EvidenceRecord;
  slug: string;
}) {
  return (
    <li className={styles.row}>
      <div className={styles.head}>
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
              <span className={styles.titleLine}>
                <span className={styles.title}>{item.title}</span>
                {item.sourceReference ? (
                  <Reference>{item.sourceReference}</Reference>
                ) : null}
                <span className={styles.kind}>
                  {EVIDENCE_SOURCE_TYPE_LABEL[item.sourceType]}
                </span>
              </span>
              <span className={styles.metaLine}>
                {item.occurredAt ? (
                  <span>Dated {formatDate(item.occurredAt)}</span>
                ) : (
                  <span>Date unknown</span>
                )}
                <span className={styles.metaSep} aria-hidden="true">
                  ·
                </span>
                <span>{formatVerified(item.lastVerifiedAt)}</span>
              </span>
            </span>
          </summary>

          <div className={styles.detail}>
            {item.contentSummary ? (
              <p className={styles.summaryText}>{item.contentSummary}</p>
            ) : (
              <p className={styles.summaryMuted}>No summary was recorded.</p>
            )}

            <dl className={styles.factGrid}>
              <div>
                <dt className={styles.factTerm}>Captured</dt>
                <dd className={styles.factValue}>
                  <Timestamp iso={item.capturedAt} />
                </dd>
              </div>
              <div>
                <dt className={styles.factTerm}>Dated</dt>
                <dd className={styles.factValue}>
                  {item.occurredAt ? formatDate(item.occurredAt) : "Unknown"}
                </dd>
              </div>
              <div>
                <dt className={styles.factTerm}>Last verified</dt>
                <dd className={styles.factValue}>
                  {item.lastVerifiedAt ? formatDate(item.lastVerifiedAt) : "Unknown"}
                </dd>
              </div>
              {item.sourceUrl ? (
                <div>
                  <dt className={styles.factTerm}>Link</dt>
                  <dd className={styles.factValue}>
                    <a
                      className={styles.link}
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {item.sourceUrl}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>

            {isDemoWriteEnabled ? (
              <Link
                href={`/initiatives/${slug}/evidence/${item.id}/edit`}
                className={styles.editLink}
              >
                Edit evidence
              </Link>
            ) : (
              <p title={WRITE_DISABLED_MESSAGE}>Read-only · Demo mode</p>
            )}
          </div>
        </details>

        {isDemoWriteEnabled ? (
          <EvidenceControls
            evidenceId={item.id}
            slug={slug}
            boundary={item.boundary}
            title={item.title}
          />
        ) : (
          <p className={styles.controls}>
            {EVIDENCE_RELATION_LABEL[item.boundary]} · Read-only
          </p>
        )}
      </div>
    </li>
  );
}
