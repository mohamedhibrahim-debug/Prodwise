import Link from "next/link";
import { UnestablishedState } from "@/components/primitives/UnestablishedState";
import { SeverityMark } from "@/components/primitives/SeverityMark";
import { Timestamp } from "@/components/primitives/Meta";
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
 * right: what is it, what needs attention, what to do next.
 *
 * The metadata line is deliberately quiet. It previously carried four separate
 * 11px uppercase semibold objects — state pill, business line, demo badge,
 * timestamp — which read as a band of noise rather than a hierarchy. Only the
 * state keeps emphasis; the rest is plain text, because none of it is what a
 * reader is scanning for.
 */
export function InitiativeRow({ initiative, intelligence }: InitiativeRowProps) {
  const top = intelligence?.attention
    .slice()
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))[0];

  const remaining = (intelligence?.attention.length ?? 0) - (top ? 1 : 0);
  const nba = intelligence?.nextBestAction ?? null;

  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <div className={styles.rowTop}>
          <Link href={`/initiatives/${initiative.slug}`} className={styles.name}>
            {initiative.name}
          </Link>
          <UnestablishedState />
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

        {/* One quiet line of plain text. Stage, portfolio context and freshness
            are orientation, not scan targets, so they no longer compete with
            the attention line above them. */}
        <div className={styles.rowMeta}>
          <span>{STAGE_LABEL[initiative.stage]}</span>
          <span className={styles.metaSep} aria-hidden="true">
            ·
          </span>
          <span>{BUSINESS_LINE_LABEL[initiative.businessLine]}</span>
          <span className={styles.metaSep} aria-hidden="true">
            ·
          </span>
          <Timestamp iso={initiative.updatedAt} prefix="updated" />
          {initiative.isDemo ? (
            <>
              <span className={styles.metaSep} aria-hidden="true">
                ·
              </span>
              {/* Still stated on every seeded row — synthetic data must always
                  be labelled — but as plain text rather than a fourth badge. */}
              <span className={styles.demoNote}>demo data</span>
            </>
          ) : null}
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
