import Link from "next/link";
import { BUSINESS_LINE_LABEL, STAGE_LABEL } from "@/lib/domain/labels";
import type { InstrumentSnapshot } from "@/lib/workspace/instrument";
import { initiativeCode } from "@/lib/workspace/instrument";
import styles from "@/app/initiatives/initiatives.module.css";

export function InitiativeRow({ snapshot }: { snapshot: InstrumentSnapshot }) {
  const { initiative } = snapshot;
  const conflicts = snapshot.findings.filter(f => f.type === "CONFLICT" && f.status === "OPEN" && f.actionable).length;
  return <li className={styles.row}>
    <span className={styles.code}>{initiativeCode(initiative.knownReferences)}</span>
    <Link href={`/initiatives/${initiative.slug}`} className={styles.name}>{initiative.name}</Link>
    <span>{STAGE_LABEL[initiative.stage]}</span>
    <span>{BUSINESS_LINE_LABEL[initiative.businessLine]}</span>
    <span className={conflicts ? styles.conflict : styles.quiet}>{conflicts} open conflict{conflicts === 1 ? "" : "s"}</span>
    <span className={styles.demo}>{initiative.isDemo ? "Demo" : "—"}</span>
  </li>;
}
