import Link from "next/link";
import { InitiativeArc } from "@/components/primitives/InitiativeArc";
import { StatePill } from "@/components/primitives/StatePill";
import { DemoBadge, Timestamp } from "@/components/primitives/Meta";
import { BUSINESS_LINE_LABEL, STAGE_LABEL } from "@/lib/domain/labels";
import type { Initiative } from "@/lib/domain/types";
import { WorkspaceTabs } from "./WorkspaceTabs";
import styles from "./WorkspaceHeader.module.css";

export function WorkspaceHeader({ initiative }: { initiative: Initiative }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/initiatives" className={styles.breadcrumb}>
          ← Initiatives
        </Link>

        <div className={styles.titleRow}>
          <div className={styles.identity}>
            {/* Supporting motif only — small, quiet, never a hero graphic. */}
            <InitiativeArc
              stage={initiative.stage}
              size={30}
              className={styles.arc}
            />
            <div>
              <h1 className={styles.name}>{initiative.name}</h1>
              <div className={styles.stageLine}>
                <span className={styles.stage}>
                  {STAGE_LABEL[initiative.stage]}
                </span>
                <span className={styles.stageDivider} aria-hidden="true" />
                {/* Portfolio context. Sits in the quiet metadata line so it
                    never competes with Stage or Overall State. */}
                <span className={styles.businessLine}>
                  {BUSINESS_LINE_LABEL[initiative.businessLine]}
                </span>
                <span className={styles.stageDivider} aria-hidden="true" />
                <Timestamp iso={initiative.updatedAt} prefix="Last updated" />
              </div>
            </div>
          </div>

          <div className={styles.statusGroup}>
            {initiative.isDemo ? <DemoBadge /> : null}
            <StatePill state={initiative.overallState} size="lg" />
          </div>
        </div>

        <WorkspaceTabs slug={initiative.slug} />
      </div>
    </header>
  );
}
