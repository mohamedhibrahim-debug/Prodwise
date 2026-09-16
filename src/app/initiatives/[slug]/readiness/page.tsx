import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmptyState, EMPTY } from "@/components/primitives/EmptyState";
import { ReadinessBlock } from "@/components/initiative/ReadinessBlock";
import { getIntelligence } from "@/lib/data/fixtures";
import { getRepository } from "@/lib/data";
import styles from "../workspace.module.css";

export const metadata: Metadata = { title: "Readiness" };

export default async function ReadinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const initiative = await getRepository().getInitiativeBySlug(slug);
  if (!initiative) notFound();
  const readiness = initiative.isDemo
    ? getIntelligence(slug)?.readiness ?? []
    : [];

  return (
    <div className={styles.page}>
      <div className={styles.tabIntro}>
        {/* Nothing computes readiness yet. These assessments are fixtures, and
            the copy must not imply they were derived from anything. */}
        <p className={styles.tabIntroText}>
          {readiness.length > 0 ? <>Demo assessments — illustrative only, and not yet derived from this
          initiative&rsquo;s evidence or Product Memory. Each domain shows what
          has been confirmed, what is open, what remains unknown, and what would
          change its state. Approval and readiness are not treated as the same
          thing.</> : <>Readiness is not assessed. Readiness criteria and evidence-backed
          assessments are not available yet.</>}
        </p>
      </div>

      {readiness.length === 0 ? (
        <EmptyState
          message={EMPTY.readiness}
          hint="Recording sources and claims does not automatically establish readiness."
        />
      ) : (
        readiness.map((assessment) => (
          <ReadinessBlock key={assessment.domain} assessment={assessment} />
        ))
      )}
    </div>
  );
}
