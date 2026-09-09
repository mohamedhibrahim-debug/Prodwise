import Link from "next/link";
import type { Metadata } from "next";

import { StatePill } from "@/components/primitives/StatePill";
import { DemoBadge, Timestamp } from "@/components/primitives/Meta";
import { EmptyState } from "@/components/primitives/EmptyState";
import { getRepository } from "@/lib/data";
import { getIntelligence } from "@/lib/data/fixtures";
import {
  BusinessLineFilter,
  countByBusinessLine,
  parseBusinessLine,
} from "@/components/initiative/BusinessLineFilter";
import { BUSINESS_LINE_LABEL, STAGE_LABEL } from "@/lib/domain/labels";
import { reportingStateRank, severityRank } from "@/lib/domain/ordering";
import styles from "./reporting.module.css";

export const metadata: Metadata = { title: "Reporting" };
export const dynamic = "force-dynamic";

/**
 * Executive portfolio snapshot.
 *
 * This view exists to REMOVE information. It answers one question — "which
 * initiatives need my attention, and why?" — and shows nothing that does not
 * help answer it. No charts, no percentages, no scores, no KPI tiles.
 *
 * It reads the same initiative truth as the Product Manager workspace. There is
 * no separate management data model, so the two can never disagree.
 */
export default async function ReportingPage({
  searchParams,
}: {
  searchParams: Promise<{ line?: string }>;
}) {
  const { line } = await searchParams;
  const selectedLine = parseBusinessLine(line);

  const initiatives = await getRepository().listInitiatives();
  const counts = countByBusinessLine(initiatives.map((i) => i.businessLine));

  const rows = initiatives
    .filter((i) => selectedLine === null || i.businessLine === selectedLine)
    .map((initiative) => {
      const intelligence = getIntelligence(initiative.slug);
      const primary = intelligence?.attention
        .slice()
        .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))[0];
      return { initiative, intelligence, primary };
    })
    .sort((a, b) => {
      // State leads: management reads "what is blocked" first.
      const byState =
        reportingStateRank(a.initiative.overallState) -
        reportingStateRank(b.initiative.overallState);
      if (byState !== 0) return byState;

      // Within a state, the existing priority applies: critical first, then
      // most recently updated.
      const aCritical = a.primary?.severity === "CRITICAL" ? 0 : 1;
      const bCritical = b.primary?.severity === "CRITICAL" ? 0 : 1;
      if (aCritical !== bCritical) return aCritical - bCritical;

      return (
        Date.parse(b.initiative.updatedAt) - Date.parse(a.initiative.updatedAt)
      );
    });

  const anyDemo = rows.some((r) => r.initiative.isDemo);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Reporting</h1>
          <p className={styles.subtitle}>
            Which initiatives need attention, and why. Ordered by state —
            blocked first.
          </p>
        </div>
        {/* One indicator for the whole view, so an executive is never misled
            into reading synthetic intelligence as live output — and is not
            nagged by a disclaimer on every row. */}
        {anyDemo ? <DemoBadge>Demo data</DemoBadge> : null}
      </header>

      <BusinessLineFilter
        basePath="/reporting"
        selected={selectedLine}
        counts={counts}
        total={initiatives.length}
      />

      {rows.length === 0 ? (
        <EmptyState
          message={
            selectedLine
              ? `No initiatives in ${BUSINESS_LINE_LABEL[selectedLine]}.`
              : "No initiatives are being tracked yet."
          }
        />
      ) : (
        <>
          <div className={styles.columnHead} aria-hidden="true">
            <span>Business line</span>
            <span>Initiative</span>
            <span>State</span>
            <span>Needs attention</span>
            <span>Next best action</span>
            <span className={styles.updatedCol}>Updated</span>
          </div>

          <ul className={styles.list}>
            {rows.map(({ initiative, intelligence, primary }) => (
              <li
                key={initiative.id}
                className={`${styles.row} ${styles[`row${initiative.overallState}`]}`}
              >
                <div className={styles.cellBusinessLine}>
                  <span className={styles.mobileLabel}>Business line</span>
                  <span className={styles.businessLine}>
                    {BUSINESS_LINE_LABEL[initiative.businessLine]}
                  </span>
                </div>

                <div className={styles.cellInitiative}>
                  <Link
                    href={`/initiatives/${initiative.slug}`}
                    className={styles.name}
                  >
                    {initiative.name}
                  </Link>
                  <span className={styles.stage}>
                    {STAGE_LABEL[initiative.stage]}
                  </span>
                </div>

                <div className={styles.cellState}>
                  <StatePill state={initiative.overallState} />
                </div>

                <div className={styles.cellIssue}>
                  <span className={styles.mobileLabel}>Needs attention</span>
                  {primary ? (
                    <span className={styles.issue}>{primary.title}</span>
                  ) : (
                    <span className={styles.muted}>
                      Nothing currently flagged.
                    </span>
                  )}
                </div>

                <div className={styles.cellAction}>
                  <span className={styles.mobileLabel}>Next best action</span>
                  {intelligence?.nextBestAction ? (
                    <span className={styles.action}>
                      {intelligence.nextBestAction.action}
                    </span>
                  ) : (
                    <span className={styles.muted}>
                      Not available until evidence has been connected.
                    </span>
                  )}
                </div>

                <div className={styles.cellUpdated}>
                  <Timestamp iso={initiative.updatedAt} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
