import { StatePill } from "@/components/primitives/StatePill";
import { SeverityMark } from "@/components/primitives/SeverityMark";
import { EmptyState, EMPTY } from "@/components/primitives/EmptyState";
import { ConfidenceNote, Timestamp } from "@/components/primitives/Meta";
import { DOMAIN_LABEL } from "@/lib/domain/labels";
import { severityRank } from "@/lib/domain/ordering";
import type {
  ActivityEntry,
  AttentionItem,
  DomainAssessment,
  NextBestAction,
} from "@/lib/domain/types";
import styles from "./Overview.module.css";

/**
 * Needs your attention — at most three, most severe first.
 *
 * `hasEvidence` decides which empty state is honest. "No issues were detected
 * in the connected evidence" is a claim about a review that happened; it must
 * not be shown when nothing has been connected to review (truth rule 4).
 */
export function AttentionList({
  items,
  hasEvidence,
}: {
  items: AttentionItem[];
  hasEvidence: boolean;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        message={hasEvidence ? EMPTY.findings : EMPTY.evidence}
        inset
      />
    );
  }

  const top = [...items]
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, 3);

  return (
    <ul className={styles.attentionList}>
      {top.map((item) => (
        <li key={item.id} className={styles.attentionItem}>
          <SeverityMark severity={item.severity} />
          <div>
            <p className={styles.attentionTitle}>{item.title}</p>
            <p className={styles.attentionDetail}>{item.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Current state, showing only the domains relevant to this initiative. */
export function DomainStateList({ domains }: { domains: DomainAssessment[] }) {
  if (domains.length === 0) {
    return <EmptyState message={EMPTY.domains} inset />;
  }

  return (
    <ul className={styles.domainList}>
      {domains.map((d) => (
        <li key={d.domain} className={styles.domainRow}>
          <span className={styles.domainName}>{DOMAIN_LABEL[d.domain]}</span>
          <StatePill state={d.state} />
          <span className={styles.domainNote}>{d.note}</span>
        </li>
      ))}
    </ul>
  );
}

/** The one primary recommendation, with its full reasoning. */
export function NextBestActionBlock({ action }: { action: NextBestAction | null }) {
  if (!action) {
    return <EmptyState message={EMPTY.action} inset />;
  }

  return (
    <div className={styles.nba}>
      <p className={styles.nbaAction}>{action.action}</p>
      <p className={styles.nbaWhy}>{action.whyNow}</p>

      <div className={styles.nbaGrid}>
        <div>
          <dt className={styles.nbaTerm}>Evidence</dt>
          <dd className={styles.evidenceList}>
            {action.evidence.map((e) => (
              <span key={e} className={styles.evidenceItem}>
                <span className={styles.evidenceDash} aria-hidden="true">
                  —
                </span>
                <span>{e}</span>
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt className={styles.nbaTerm}>Impact if ignored</dt>
          <dd className={styles.nbaValue}>{action.impactIfIgnored}</dd>
        </div>
        <div>
          <dt className={styles.nbaTerm}>Suggested owner</dt>
          <dd className={styles.nbaValue}>{action.suggestedOwner}</dd>
          <dd className={styles.nbaValue}>
            <ConfidenceNote confidence={action.confidence} />
          </dd>
        </div>
      </div>
    </div>
  );
}

export function RecentChanges({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState message={EMPTY.activity} inset />;
  }

  return (
    <ul className={styles.changeList}>
      {entries.map((entry) => (
        <li key={entry.id} className={styles.changeRow}>
          <Timestamp iso={entry.occurredAt} />
          <span className={styles.changeSummary}>{entry.summary}</span>
        </li>
      ))}
    </ul>
  );
}
