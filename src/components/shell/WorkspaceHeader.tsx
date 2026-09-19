import Link from "next/link";
import { BUSINESS_LINE_LABEL, STAGE_LABEL } from "@/lib/domain/labels";
import type { Initiative } from "@/lib/domain/types";
import { ShellActions } from "./ShellActions";
import { WorkspaceTabs } from "./WorkspaceTabs";
import styles from "./WorkspaceHeader.module.css";

export function WorkspaceHeader({ initiative }: { initiative: Initiative }) {
  return <header className={styles.header}>
    <div className={styles.inner}>
      <div className={styles.identity}>
        <nav aria-label="Breadcrumb"><Link href="/initiatives">Initiatives</Link><span>/</span></nav>
        <strong title={initiative.name}>{initiative.name}</strong>
        <span className={styles.meta}>{STAGE_LABEL[initiative.stage]}</span>
        <span className={styles.meta}>{BUSINESS_LINE_LABEL[initiative.businessLine]}</span>
      </div>
      <WorkspaceTabs slug={initiative.slug} />
      <ShellActions />
    </div>
  </header>;
}
