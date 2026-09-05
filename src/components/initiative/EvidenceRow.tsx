import { Reference, Timestamp } from "@/components/primitives/Meta";
import { EVIDENCE_KIND_LABEL } from "@/lib/domain/labels";
import type { EvidenceItem } from "@/lib/domain/types";
import styles from "./EvidenceRow.module.css";

export function EvidenceRow({ item }: { item: EvidenceItem }) {
  return (
    <li className={styles.row}>
      <div className={styles.refCell}>
        <Reference>{item.reference}</Reference>
        <span className={styles.kind}>{EVIDENCE_KIND_LABEL[item.kind]}</span>
      </div>

      <div>
        <p className={styles.title}>{item.title}</p>
        <p className={styles.summary}>{item.summary}</p>
        <p className={styles.reason}>{item.classificationReason}</p>
      </div>

      <div className={styles.freshness}>
        <Timestamp iso={item.lastSeenAt} prefix="Last seen" />
      </div>
    </li>
  );
}
