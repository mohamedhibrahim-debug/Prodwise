import { notFound } from "next/navigation";

import { Section } from "@/components/primitives/Section";
import { Timestamp } from "@/components/primitives/Meta";
import {
  AttentionList,
  DomainStateList,
  NextBestActionBlock,
  RecentChanges,
} from "@/components/initiative/OverviewBlocks";
import { getRepository } from "@/lib/data";
import { getIntelligence } from "@/lib/data/fixtures";
import styles from "./workspace.module.css";

export const dynamic = "force-dynamic";

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const repo = getRepository();
  const initiative = await repo.getInitiativeBySlug(slug);
  if (!initiative) notFound();

  const intelligence = getIntelligence(slug);
  const activity = await repo.listActivity(initiative.id, 6);

  return (
    <div className={styles.page}>
      {/* The one-sentence answer to "where is this initiative?" */}
      <div className={styles.summary}>
        <p className={styles.summaryText}>
          {initiative.stateSummary ??
            "No evidence has been connected yet, so the current state of this initiative cannot be determined."}
        </p>
        {initiative.description ? (
          <p className={styles.description}>{initiative.description}</p>
        ) : null}
        {intelligence ? (
          <div className={styles.summaryMeta}>
            <Timestamp
              iso={intelligence.lastEvaluatedAt}
              prefix="Evidence last evaluated"
              withTime
            />
          </div>
        ) : null}
      </div>

      <Section
        title="Needs Your Attention"
        numeral="01"
        aside={
          intelligence && intelligence.attention.length > 3
            ? `Showing 3 of ${intelligence.attention.length}`
            : undefined
        }
      >
        <AttentionList
          items={intelligence?.attention ?? []}
          hasEvidence={(intelligence?.evidence.length ?? 0) > 0}
        />
      </Section>

      {/* Next Best Action sits directly under Needs Your Attention so the
          first viewport answers all three questions: where are we, what needs
          attention, what should I do next. Current State follows as detail. */}
      <Section title="Next Best Action" numeral="02">
        <NextBestActionBlock action={intelligence?.nextBestAction ?? null} />
      </Section>

      <Section
        title="Current State"
        numeral="03"
        description="Only domains relevant to this initiative are shown."
      >
        <DomainStateList domains={intelligence?.domains ?? []} />
      </Section>

      <Section title="Recent Changes" numeral="04">
        <RecentChanges entries={activity} />
      </Section>
    </div>
  );
}
