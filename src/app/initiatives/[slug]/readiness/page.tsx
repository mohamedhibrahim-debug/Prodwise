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
        <p className={styles.tabIntroText}>
          Readiness is not assessed. Readiness criteria and evidence-backed
          assessments are not available yet.
        </p>
      </div>

      {readiness.length === 0 ? (
        <EmptyState
          message={EMPTY.readiness}
          hint="Recording sources and claims does not automatically establish readiness."
        />
      ) : (
        <section className={styles.demoBanner} aria-labelledby="readiness-demo-title">
          <h2 id="readiness-demo-title" className={styles.demoTag}>
            Demo Scenario
          </h2>
          <p>
            Authored illustration — not derived from this initiative&rsquo;s
            evidence or Product Memory. Approval and readiness are not treated
            as the same thing.
          </p>
          {readiness.map((assessment) => (
            <ReadinessBlock key={assessment.domain} assessment={assessment} />
          ))}
        </section>
      )}
    </div>
  );
}
