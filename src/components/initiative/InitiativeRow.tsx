import Link from "next/link";
import { StatePill } from "@/components/primitives/StatePill";
import { SeverityMark } from "@/components/primitives/SeverityMark";
import { DemoBadge, Timestamp } from "@/components/primitives/Meta";
import { BUSINESS_LINE_LABEL, STAGE_LABEL } from "@/lib/domain/labels";
import { severityRank } from "@/lib/domain/ordering";
import type { Initiative, InitiativeIntelligence } from "@/lib/domain/types";
import styles from "@/app/initiatives/initiatives.module.css";

interface InitiativeRowProps {
  initiative: Initiative;
  intelligence: InitiativeIntelligence | null;
}

/**
 * One initiative as a structured row — not a card. The row answers, left to
 * right: what is it, where is it, what needs attention, what should I do next.
 */
export function InitiativeRow({ initiative, intelligence }: InitiativeRowProps) {
  const top = intelligence?.attention
    .slice()
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))[0];

  const remaining = (intelligence?.attention.length ?? 0) - (top ? 1 : 0);
  const nba = intelligence?.nextBestAction ?? null;

  return (
    <li
      className={`${styles.row} ${styles[`row${initiative.overallState}`]}`}
    >
      <div className={styles.rowMain}>
        <div className={styles.rowTop}>
          <Link
            href={`/initiatives/${initiative.slug}`}
            className={styles.name}
          >
            {initiative.name}
          </Link>
          <span className={styles.stage}>{STAGE_LABEL[initiative.stage]}</span>
        </div>

        {top ? (
          <p className={styles.attention}>
            <SeverityMark severity={top.severity} />
            <span>
              {top.title}
              {remaining > 0
                ? remaining === 1
                  ? " · 1 other item needs attention"
                  : ` · ${remaining} other items need attention`
                : ""}
            </span>
          </p>
        ) : (
          <p className={`${styles.attention} ${styles.attentionNone}`}>
            {intelligence
              ? "No material review issues were detected in the currently connected evidence."
              : "No related evidence has been confirmed yet."}
          </p>
        )}

        <div className={styles.rowMeta}>
          <StatePill state={initiative.overallState} />
          {/* Portfolio context, sitting with the other metadata rather than
              competing with state. */}
          <span className={styles.businessLine}>
            {BUSINESS_LINE_LABEL[initiative.businessLine]}
          </span>
          {initiative.isDemo ? <DemoBadge /> : null}
          <Timestamp iso={initiative.updatedAt} prefix="Updated" />
        </div>
      </div>

      <div className={styles.rowSide}>
        <span className={styles.nbaLabel}>Next best action</span>
        {nba ? (
          <span className={styles.nba}>{nba.action}</span>
        ) : (
          <span className={styles.nbaNone}>
            Not available until evidence has been connected.
          </span>
        )}
      </div>
    </li>
  );
}
