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

/**
 * Readiness for one domain.
 *
 * Deliberately not a checklist and never a percentage: what is satisfied, what
 * is open, what is unknown, and what would actually change the state.
 */
export function ReadinessBlock({
  assessment,
}: {
  assessment: ReadinessAssessment;
}) {
  return (
    <section className={styles.block}>
      <div className={styles.head}>
        <h2 className={styles.domain}>{DOMAIN_LABEL[assessment.domain]}</h2>
        <StatePill state={assessment.state} />
      </div>

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
    </section>
  );
}
