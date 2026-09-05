import { CategoryTag, Reference, Timestamp } from "@/components/primitives/Meta";
import {
  CLAIM_STATUS_LABEL,
  CLAIM_TYPE_LABEL,
  DOMAIN_LABEL,
} from "@/lib/domain/labels";
import type { MemoryClaim } from "@/lib/domain/types";
import styles from "./ClaimRow.module.css";

/**
 * A single unit of Product Memory, rendered as a structured claim —
 * subject · attribute · value · domain · phase · status · source · date —
 * so the page reads as knowledge rather than as a list of documents.
 */
export function ClaimRow({ claim }: { claim: MemoryClaim }) {
  const statusClass =
    styles[`status${claim.status}` as keyof typeof styles] ?? "";

  return (
    <li className={styles.row}>
      <div className={styles.head}>
        <h3 className={styles.subject}>{claim.subject}</h3>
        <span className={styles.attribute}>{claim.attribute}</span>
        <span className={styles.spacer} />
        {claim.flag ? <span className={styles.flag}>{claim.flag}</span> : null}
        <CategoryTag>{CLAIM_TYPE_LABEL[claim.type]}</CategoryTag>
        <span className={`${styles.status} ${statusClass}`}>
          {CLAIM_STATUS_LABEL[claim.status]}
        </span>
      </div>

      <p
        className={`${styles.value} ${claim.status === "SUPERSEDED" ? styles.supersededValue : ""}`}
      >
        {claim.value}
      </p>

      {claim.relationship ? (
        <p className={styles.relationship}>{claim.relationship}</p>
      ) : null}

      <div className={styles.facts}>
        <span className={styles.fact}>
          Domain <b>{DOMAIN_LABEL[claim.domain]}</b>
        </span>
        <span className={styles.fact}>
          Phase <b>{claim.phase}</b>
        </span>
        <Reference>{claim.source}</Reference>
        <Timestamp iso={claim.sourceDate} />
      </div>
    </li>
  );
}
