import { SeverityMark } from "@/components/primitives/SeverityMark";
import { CategoryTag, Reference, Timestamp } from "@/components/primitives/Meta";
import { DOMAIN_LABEL, FINDING_LABEL } from "@/lib/domain/labels";
import type { ReviewFinding } from "@/lib/domain/types";
import styles from "./FindingRow.module.css";

/**
 * One review finding.
 *
 * Category is a neutral chip; severity carries the colour. That separation
 * keeps CONFLICT/GAP/UNKNOWN/SUPERSEDED/RISK readable as kinds rather than as
 * an implied ranking.
 */
export function FindingRow({ finding }: { finding: ReviewFinding }) {
  return (
    <li className={styles.row}>
      <div className={styles.head}>
        <h3 className={styles.title}>{finding.title}</h3>
        <div className={styles.meta}>
          {finding.status === "RESOLVED" ? (
            <span className={styles.resolvedTag}>Resolved</span>
          ) : null}
          <CategoryTag>{FINDING_LABEL[finding.type]}</CategoryTag>
          <SeverityMark severity={finding.severity} />
          <Timestamp iso={finding.detectedOn} prefix="Detected" />
        </div>
      </div>

      <p className={styles.explanation}>
        <strong>{finding.subject}</strong> · {DOMAIN_LABEL[finding.domain]} —{" "}
        {finding.explanation}
      </p>

      {finding.claims.length > 0 ? (
        <div className={styles.claims}>
          {finding.claims.map((claim) => (
            <div key={claim.label} className={styles.claim}>
              <div className={styles.claimLabel}>{claim.label}</div>
              <p className={styles.claimValue}>{claim.value}</p>
              <div className={styles.claimSource}>
                <Reference>{claim.source}</Reference>
                <Timestamp iso={claim.sourceDate} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {finding.resolution ? (
        <p className={styles.resolution}>{finding.resolution}</p>
      ) : null}
    </li>
  );
}
