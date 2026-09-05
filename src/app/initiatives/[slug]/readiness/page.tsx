import type { Metadata } from "next";

import { EmptyState, EMPTY } from "@/components/primitives/EmptyState";
import { ReadinessBlock } from "@/components/initiative/ReadinessBlock";
import { getIntelligence } from "@/lib/data/fixtures";
import styles from "../workspace.module.css";

export const metadata: Metadata = { title: "Readiness" };

export default async function ReadinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const readiness = getIntelligence(slug)?.readiness ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.tabIntro}>
        <p className={styles.tabIntroText}>
          Readiness is derived from evidence, not from a checklist. Each domain
          shows what has been confirmed, what is open, what remains unknown, and
          what would actually change its state. Approval and readiness are not
          treated as the same thing.
        </p>
      </div>

      {readiness.length === 0 ? (
        <EmptyState
          message={EMPTY.readiness}
          hint="No evidence has been connected to this initiative, so no domain can be evaluated."
        />
      ) : (
        readiness.map((assessment) => (
          <ReadinessBlock key={assessment.domain} assessment={assessment} />
        ))
      )}
    </div>
  );
}
