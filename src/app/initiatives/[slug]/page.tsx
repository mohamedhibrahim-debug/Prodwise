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
  const [activity, evidence] = await Promise.all([
    repo.listActivity(initiative.id, 6),
    repo.listEvidence(initiative.id),
  ]);

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
            {/* Nothing evaluates evidence. This is a fixture constant, and the
                freshness pattern is reserved for real timestamps (§16) — so it
                must not claim an evaluation run that never happened. */}
            <Timestamp
              iso={intelligence.lastEvaluatedAt}
              prefix="Demo intelligence authored"
              withTime
            />
          </div>
        ) : null}
      </div>

      {/* Order is set in CSS, not markup. Desktop reads Attention -> Next Best
          Action; below 780px the recommendation is lifted first, so the primary
          action arrives immediately after orientation rather than after a long
          finding list. The numerals swap with it. */}
      <div className={styles.sectionFlow}>
        <Section
          title="Needs Your Attention"
          numeral="01"
          mobileNumeral="02"
          className={styles.orderAttention}
          aside={
            intelligence && intelligence.attention.length > 3
              ? `Showing 3 of ${intelligence.attention.length}`
              : undefined
          }
          /* These are hand-authored demo items, and they are NOT the derived
             Review findings — they may describe the same subject and even
             rank it, while Review deliberately assigns no severity at all.
             Without saying so, one screen appears to contradict the other. */
          description={
            intelligence
              ? "Demo items — illustrative only, and not the derived Review findings on the Review tab."
              : undefined
          }
        >
          {/* "Nothing was detected" is a claim about a review that happened.
              It is now answered by real connected evidence, not by fixtures. */}
          <AttentionList
            items={intelligence?.attention ?? []}
            hasEvidence={evidence.length > 0}
          />
        </Section>

        <Section
          title="Next Best Action"
          numeral="02"
          mobileNumeral="01"
          className={styles.orderAction}
          description={
            intelligence
              ? "Demo recommendation — not generated from this initiative's evidence or Product Memory."
              : undefined
          }
        >
          <NextBestActionBlock action={intelligence?.nextBestAction ?? null} />
        </Section>

        <Section
          title="Current State"
          numeral="03"
          className={styles.orderState}
          description={
            intelligence
              ? "Demo assessment — not derived from this initiative's data. Only domains relevant to this initiative are shown."
              : "Only domains relevant to this initiative are shown."
          }
        >
          <DomainStateList domains={intelligence?.domains ?? []} />
        </Section>

        <Section
          title="Recent Changes"
          numeral="04"
          className={styles.orderChanges}
        >
          <RecentChanges entries={activity} />
        </Section>
      </div>
    </div>
  );
}
