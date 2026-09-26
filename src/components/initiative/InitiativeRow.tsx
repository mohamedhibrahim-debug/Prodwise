import Link from "next/link";
import { BUSINESS_LINE_LABEL, STAGE_LABEL } from "@/lib/domain/labels";
import type { InstrumentSnapshot } from "@/lib/workspace/instrument";
import styles from "@/app/initiatives/initiatives.module.css";

export function InitiativeRow({ snapshot }: { snapshot: InstrumentSnapshot }) {
  const { initiative } = snapshot;
  const conflicts = snapshot.findings.filter(f => f.type === "CONFLICT" && f.status === "OPEN" && f.actionable).length;
  return <li className={styles.row}>
    <div className={styles.identity}><Link href={`/initiatives/${initiative.slug}`} className={styles.name}>{initiative.name}</Link>
      <span className={styles.code}>{initiative.slug}</span>{initiative.isDemo ? <span className={styles.demo}>Synthetic demo</span> : null}</div>
    <span className={styles.stage}>{STAGE_LABEL[initiative.stage]}</span>
    <span className={styles.line}>{BUSINESS_LINE_LABEL[initiative.businessLine]}</span>
    <div className={styles.review}>
      {!snapshot.progress.complete ? <span className={styles.quiet}>Not assessed yet — setup incomplete</span> : <span className={styles.quiet}>Knowledge checks available</span>}
      {conflicts ? <span className={styles.conflict}>{conflicts} {conflicts === 1 ? "mismatch needs" : "mismatches need"} a decision</span>
        : <span className={styles.quiet}>{snapshot.progress.complete ? "No actionable mismatches detected" : "No decisions available under current checks"}</span>}
    </div>
  </li>;
}
