import type { Metadata } from "next";

import { EmptyState, EMPTY } from "@/components/primitives/EmptyState";
import { EvidenceRow } from "@/components/initiative/EvidenceRow";
import { getIntelligence } from "@/lib/data/fixtures";
import { EVIDENCE_RELATION_LABEL } from "@/lib/domain/labels";
import { EVIDENCE_RELATIONS } from "@/lib/domain/types";
import styles from "../workspace.module.css";

export const metadata: Metadata = { title: "Evidence" };

/** What each bucket means, so the boundary decision is legible. */
const RELATION_NOTE: Record<string, string> = {
  CURRENT_SCOPE: "Artifacts that define what is being delivered in this phase.",
  FUTURE_PHASE:
    "Related work explicitly deferred to a later phase. It does not block the current release.",
  HISTORICAL:
    "Superseded artifacts, retained so earlier positions remain inspectable.",
  RELATED:
    "Artifacts that reference this initiative but have not been confirmed as part of its scope.",
  EXCLUDED:
    "Artifacts reviewed and confirmed as belonging to a different initiative.",
};

export default async function EvidencePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const evidence = getIntelligence(slug)?.evidence ?? [];

  if (evidence.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.tabIntro}>
          <p className={styles.tabIntroText}>
            Evidence is the source material Prodwise reasons over. Each item is
            classified against the initiative boundary.
          </p>
        </div>
        <EmptyState
          message={EMPTY.evidence}
          hint="Jira and Google Drive discovery arrive in a later phase. Until then, evidence is not connected automatically."
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.tabIntro}>
        <p className={styles.tabIntroText}>
          Evidence is the source material Prodwise reasons over. Each item is
          classified against the initiative boundary, and every classification
          states its reason so it can be inspected — and, in a later phase,
          corrected.
        </p>
      </div>

      {EVIDENCE_RELATIONS.map((relation) => {
        const items = evidence.filter((e) => e.relation === relation);
        if (items.length === 0) return null;

        return (
          <section key={relation} className={styles.group}>
            <div className={styles.groupHead}>
              <h2 className={styles.groupTitle}>
                {EVIDENCE_RELATION_LABEL[relation]}
              </h2>
              <span className={styles.groupCount}>{items.length}</span>
            </div>
            <p className={styles.groupNote}>{RELATION_NOTE[relation]}</p>
            <ul>
              {items.map((item) => (
                <EvidenceRow key={item.id} item={item} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
