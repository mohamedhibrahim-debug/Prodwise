import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ButtonLink } from "@/components/primitives/Button";
import { EmptyState, EMPTY } from "@/components/primitives/EmptyState";
import { EvidenceRow } from "@/components/initiative/EvidenceRow";
import { getRepository } from "@/lib/data";
import {
  CONNECTION_STATE_LABEL,
  EVIDENCE_RELATION_LABEL,
  EVIDENCE_RELATION_NOTE,
} from "@/lib/domain/labels";
import { EVIDENCE_RELATIONS } from "@/lib/domain/types";
import styles from "../workspace.module.css";
import evidenceStyles from "./evidence.module.css";

export const metadata: Metadata = { title: "Evidence" };
export const dynamic = "force-dynamic";

export default async function EvidencePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const repo = getRepository();
  const initiative = await repo.getInitiativeBySlug(slug);
  if (!initiative) notFound();

  const [evidence, sources] = await Promise.all([
    repo.listEvidence(initiative.id),
    repo.listSources(initiative.id),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.tabIntro}>
        <div className={evidenceStyles.introRow}>
          <p className={styles.tabIntroText}>
            Evidence is the source material Prodwise reasons over. Every item
            carries one boundary classification, set by you — getting the
            boundary right is what makes every later conclusion trustworthy.
          </p>
          <ButtonLink
            href={`/initiatives/${slug}/evidence/new`}
            variant="primary"
          >
            Add Evidence
          </ButtonLink>
        </div>

        {sources.length > 0 ? (
          <p className={evidenceStyles.sources}>
            <span className={evidenceStyles.sourcesLabel}>Sources</span>
            {sources.map((source) => (
              <span key={source.id} className={evidenceStyles.source}>
                {source.name}
                <span className={evidenceStyles.sourceState}>
                  {CONNECTION_STATE_LABEL[source.connectionState]}
                </span>
              </span>
            ))}
          </p>
        ) : null}
      </div>

      {evidence.length === 0 ? (
        <EmptyState
          message={EMPTY.evidence}
          hint="Add evidence manually to start building this initiative's boundary. Automatic discovery from connected systems arrives in a later phase."
        />
      ) : (
        /* All five boundaries are always rendered, including empty ones: the
           classification model is the point of this screen, and hiding a bucket
           would hide part of the decision the user is making. */
        EVIDENCE_RELATIONS.map((relation) => {
          const items = evidence.filter((e) => e.boundary === relation);

          return (
            <section key={relation} className={styles.group}>
              <div className={styles.groupHead}>
                <h2 className={styles.groupTitle}>
                  {EVIDENCE_RELATION_LABEL[relation]}
                </h2>
                <span className={styles.groupCount}>{items.length}</span>
              </div>
              <p className={styles.groupNote}>
                {EVIDENCE_RELATION_NOTE[relation]}
              </p>
              {items.length === 0 ? (
                <p className={evidenceStyles.groupEmpty}>
                  Nothing is currently classified here.
                </p>
              ) : (
                <ul>
                  {items.map((item) => (
                    <EvidenceRow key={item.id} item={item} slug={slug} />
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
