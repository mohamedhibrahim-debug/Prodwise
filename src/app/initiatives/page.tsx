import type { Metadata } from "next";

import { DemoWriteLink } from "@/components/primitives/DemoWriteLink";
import { isDemoWriteEnabled, WRITE_DISABLED_MESSAGE } from "@/lib/env";
import { EmptyState } from "@/components/primitives/EmptyState";
import { InitiativeRow } from "@/components/initiative/InitiativeRow";
import { getRepository } from "@/lib/data";
import { getIntelligence } from "@/lib/data/fixtures";
import {
  BusinessLineFilter,
  countByBusinessLine,
  parseBusinessLine,
} from "@/components/initiative/BusinessLineFilter";
import { BUSINESS_LINE_LABEL } from "@/lib/domain/labels";
import { attentionRank } from "@/lib/domain/ordering";
import styles from "./initiatives.module.css";

export const metadata: Metadata = { title: "Initiatives" };
export const dynamic = "force-dynamic";

export default async function InitiativesPage({
  searchParams,
}: {
  searchParams: Promise<{ line?: string }>;
}) {
  const { line } = await searchParams;
  const selectedLine = parseBusinessLine(line);

  const initiatives = await getRepository().listInitiatives();
  // Counts come from the full set, so the chips stay stable while filtering.
  const counts = countByBusinessLine(initiatives.map((i) => i.businessLine));

  const rows = initiatives
    .filter((i) => selectedLine === null || i.businessLine === selectedLine)
    .map((initiative) => ({
      initiative,
      intelligence: getIntelligence(initiative.slug),
    }));

  /* Default priority: BLOCKED → critical findings → AT_RISK → UNKNOWN → READY.
     Within a rank, most recently updated first. */
  rows.sort((a, b) => {
    const rankA = attentionRank(
      a.initiative.overallState,
      a.intelligence?.attention.some((i) => i.severity === "CRITICAL") ?? false,
    );
    const rankB = attentionRank(
      b.initiative.overallState,
      b.intelligence?.attention.some((i) => i.severity === "CRITICAL") ?? false,
    );
    if (rankA !== rankB) return rankA - rankB;
    return (
      Date.parse(b.initiative.updatedAt) - Date.parse(a.initiative.updatedAt)
    );
  });

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Initiatives</h1>
          <p className={styles.subtitle}>
            Ordered by what needs your attention first — blocked and critical
            items above everything else.
          </p>
        </div>
        <DemoWriteLink href="/initiatives/new" variant="primary">
          Create Initiative
        </DemoWriteLink>
      </header>

      <BusinessLineFilter
        basePath="/initiatives"
        selected={selectedLine}
        counts={counts}
        total={initiatives.length}
      />

      {rows.length === 0 ? (
        <EmptyState
          message={
            selectedLine
              ? `No initiatives in ${BUSINESS_LINE_LABEL[selectedLine]}.`
              : "No initiatives yet."
          }
          // An empty filter result is about the filter, not about writes — so
          // the demo-mode notice only applies when the list is genuinely empty.
          hint={
            selectedLine
              ? "Clear the filter to see every initiative."
              : isDemoWriteEnabled
                ? "Create an initiative to start reconstructing its product context."
                : WRITE_DISABLED_MESSAGE
          }
        />
      ) : (
        <>
          <div className={styles.countLine}>
            <span className={styles.orderNote}>
              {rows.length} initiative{rows.length === 1 ? "" : "s"} · seeded
              demo initiatives are labelled
            </span>
          </div>
          <ul className={styles.list}>
            {rows.map(({ initiative, intelligence }) => (
              <InitiativeRow
                key={initiative.id}
                initiative={initiative}
                intelligence={intelligence}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
