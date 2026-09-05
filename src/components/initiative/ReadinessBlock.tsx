import { StatePill } from "@/components/primitives/StatePill";
import { DOMAIN_LABEL } from "@/lib/domain/labels";
import type { ReadinessAssessment } from "@/lib/domain/types";
import styles from "./ReadinessBlock.module.css";

function Column({
  label,
  items,
  variant,
  glyph,
  emptyText,
}: {
  label: string;
  items: string[];
  variant: "satisfied" | "issue" | "unknown";
  glyph: string;
  emptyText: string;
}) {
  return (
    <div>
      <div className={styles.colLabel}>{label}</div>
      <div className={styles.list}>
        {items.length === 0 ? (
          <p className={styles.none}>{emptyText}</p>
        ) : (
          items.map((item) => (
            <p key={item} className={`${styles.item} ${styles[variant]}`}>
              <span className={styles.glyph} aria-hidden="true">
                {glyph}
              </span>
              <span>{item}</span>
            </p>
          ))
        )}
      </div>
    </div>
  );
}

function count(n: number, singular: string): string {
  if (n === 0) return `No ${singular}s`;
  return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

/**
 * Readiness for one domain.
 *
 * Deliberately not a checklist and never a percentage: what is satisfied, what
 * is open, what is unknown, and what would actually change the state.
 *
 * Rendered as a native <details> so it collapses without JavaScript, keeps
 * keyboard and screen-reader semantics for free, and needs no client bundle.
 * Domains that need action (BLOCKED, AT_RISK) open by default; settled ones
 * (READY, UNKNOWN) start collapsed so the page stays scannable.
 */
export function ReadinessBlock({
  assessment,
}: {
  assessment: ReadinessAssessment;
}) {
  const needsAttention =
    assessment.state === "BLOCKED" || assessment.state === "AT_RISK";

  return (
    <details className={styles.block} open={needsAttention}>
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
        <h2 className={styles.domain}>{DOMAIN_LABEL[assessment.domain]}</h2>
        <StatePill state={assessment.state} />
        <span className={styles.counts}>
          {count(assessment.openIssues.length, "open issue")}
          <span className={styles.countSep} aria-hidden="true">
            ·
          </span>
          {count(assessment.unknowns.length, "unknown")}
        </span>
      </summary>

      <div className={styles.body}>
        <div className={styles.columns}>
          <Column
            label="Evidence satisfied"
            items={assessment.evidenceSatisfied}
            variant="satisfied"
            glyph="✓"
            emptyText="Nothing confirmed yet."
          />
          <Column
            label="Open issues"
            items={assessment.openIssues}
            variant="issue"
            glyph="!"
            emptyText="None."
          />
          <Column
            label="Unknown"
            items={assessment.unknowns}
            variant="unknown"
            glyph="?"
            emptyText="None."
          />
        </div>

        <div className={styles.resolution}>
          <div className={styles.resolutionLabel}>
            What would make this ready
          </div>
          <p className={styles.resolutionText}>
            {assessment.whatWouldMakeThisReady}
          </p>
        </div>
      </div>
    </details>
  );
}
