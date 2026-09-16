import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Section } from "@/components/primitives/Section";
import { StatePill } from "@/components/primitives/StatePill";
import {
  AttentionList,
  DomainStateList,
  NextBestActionBlock,
  RecentChanges,
} from "@/components/initiative/OverviewBlocks";
import { FoundationBand } from "@/components/workspace/FoundationBand";
import { OpenDecisions } from "@/components/workspace/OpenDecisions";
import { SetupRail } from "@/components/workspace/SetupRail";
import { getRepository } from "@/lib/data";
import { getIntelligence } from "@/lib/data/fixtures";
import { compareFindings } from "@/lib/review/engine";
import { loadDecisions } from "@/lib/workspace/decisions";
import { deriveSetup } from "@/lib/workspace/setup";
import styles from "./workspace.module.css";

export const metadata: Metadata = { title: "Status" };
export const dynamic = "force-dynamic";

/**
 * Status.
 *
 * One route, two layouts. Until the initiative holds trusted knowledge (an
 * ACTIVE claim) this IS the setup experience: the pipeline, with one primary
 * action on the first unfinished step. Afterwards it becomes the operating
 * view — but setup progress stays visible, condensed, because readiness and
 * status are not built and switching layout must not read as "set up".
 *
 * Everything on the primary surfaces is real. Authored demo intelligence is
 * confined to one labelled, collapsed block, and only on demo initiatives.
 */
export default async function StatusPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const repo = getRepository();
  const initiative = await repo.getInitiativeBySlug(slug);
  if (!initiative) notFound();

  const [{ claims, findings }, evidence, activity] = await Promise.all([
    loadDecisions(initiative.id),
    repo.listEvidence(initiative.id),
    repo.listActivity(initiative.id, 6),
  ]);

  const progress = deriveSetup({ evidence, claims, findings });
  const open = findings
    .filter((f) => f.status === "OPEN" && f.actionable)
    .sort(compareFindings);

  const demo = initiative.isDemo ? getIntelligence(slug) : null;

  return (
    <div className={styles.page}>
      {progress.mode === "setup" ? (
        <>
          <SetupRail progress={progress} slug={slug} variant="full" />
          <Section title="Recent Changes">
            <RecentChanges entries={activity} />
          </Section>
        </>
      ) : (
        <>
          <SetupRail progress={progress} slug={slug} variant="condensed" />

          <FoundationBand facts={progress.facts} slug={slug} />

          <div className={styles.statusColumns}>
            <Section
              title="Waiting on you"
              aside={
                open.length > 0
                  ? `${open.length} open`
                  : undefined
              }
              className={styles.statusMain}
            >
              <OpenDecisions findings={open} slug={slug} />
            </Section>

            <Section title="Recent Changes" className={styles.statusSide}>
              <RecentChanges entries={activity} />
            </Section>
          </div>
        </>
      )}

      {demo ? (
        <details className={styles.demoScenario}>
          <summary className={styles.demoSummary}>
            <span className={styles.demoTag}>Demo scenario</span>
            Authored illustration — not derived from this initiative&rsquo;s
            evidence or memory
          </summary>
          <div className={styles.demoBody}>
            <Section title="Illustrative overall state">
              <StatePill state={initiative.overallState} />
            </Section>
            {initiative.stateSummary ? (
              <p className={styles.summaryText}>{initiative.stateSummary}</p>
            ) : null}
            <Section title="Illustrative attention items">
              <AttentionList
                items={demo.attention}
                hasEvidence={evidence.length > 0}
              />
            </Section>
            <Section title="Illustrative next best action">
              <NextBestActionBlock action={demo.nextBestAction} />
            </Section>
            <Section title="Illustrative domain states">
              <DomainStateList domains={demo.domains} />
            </Section>
          </div>
        </details>
      ) : null}
    </div>
  );
}
