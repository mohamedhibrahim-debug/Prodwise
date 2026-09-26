import Link from "next/link";
import { BUSINESS_LINE_LABEL, STAGE_LABEL, formatDate } from "@/lib/domain/labels";
import type { Initiative } from "@/lib/domain/types";
import { ShellActions } from "./ShellActions";
import { WorkspaceTabs } from "./WorkspaceTabs";
import styles from "./WorkspaceHeader.module.css";

export function WorkspaceHeader({ initiative }: { initiative: Initiative }) {
  return <header className={styles.header}>
    <div className={styles.inner}><div className={styles.identity}>
      <nav aria-label="Breadcrumb"><Link href="/initiatives">Initiatives</Link><span>/</span></nav>
      <h1 data-workspace-title title={initiative.name}>{initiative.name}</h1>
      <span className={styles.meta}>{initiative.slug}</span>
      <span className={styles.meta}>Recorded stage: {STAGE_LABEL[initiative.stage]}</span>
      <span className={styles.meta}>{BUSINESS_LINE_LABEL[initiative.businessLine]}</span>
      <span className={styles.meta}>Updated {formatDate(initiative.updatedAt)}</span>
      {initiative.isDemo ? <span className={styles.meta}>Synthetic demo</span> : null}
    </div><WorkspaceTabs slug={initiative.slug} /><ShellActions /></div>
  </header>;
}
