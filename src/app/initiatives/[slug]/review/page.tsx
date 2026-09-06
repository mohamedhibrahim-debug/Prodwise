import Link from "next/link";
import type { Metadata } from "next";

import { EmptyState, EMPTY } from "@/components/primitives/EmptyState";
import { FindingRow } from "@/components/initiative/FindingRow";
import { getRepository } from "@/lib/data";
import { getIntelligence } from "@/lib/data/fixtures";
import { isActionable, severityRank } from "@/lib/domain/ordering";
import type { ReviewFinding } from "@/lib/domain/types";
import styles from "../workspace.module.css";

export const metadata: Metadata = { title: "Review" };

type Filter = "open" | "resolved" | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

/**
 * "Open" is the actionable queue, not simply everything unresolved: a
 * superseded claim is history, not a task. It stays fully visible under "All".
 */
function matches(filter: Filter, finding: ReviewFinding): boolean {
  if (filter === "all") return true;
  if (filter === "resolved") return finding.status === "RESOLVED";
  return finding.status === "OPEN" && isActionable(finding);
}

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { slug } = await params;
  const { filter: rawFilter } = await searchParams;

  const filter: Filter =
    rawFilter === "resolved" || rawFilter === "all" ? rawFilter : "open";

  const intelligence = getIntelligence(slug);
  const all = intelligence?.findings ?? [];

  // Whether any evidence is connected is now a fact from the repository, not a
  // fixture — so the empty state can distinguish "reviewed, nothing found" from
  // "nothing to review" truthfully.
  const initiative = await getRepository().getInitiativeBySlug(slug);
  const evidenceCount = initiative
    ? (await getRepository().listEvidence(initiative.id)).length
    : 0;

  const counts: Record<Filter, number> = {
    open: all.filter((f) => matches("open", f)).length,
    resolved: all.filter((f) => matches("resolved", f)).length,
    all: all.length,
  };

  const visible = all
    .filter((f) => matches(filter, f))
    .sort((a, b) => {
      const bySeverity = severityRank(a.severity) - severityRank(b.severity);
      if (bySeverity !== 0) return bySeverity;
      return Date.parse(b.detectedOn) - Date.parse(a.detectedOn);
    });

  return (
    <div className={styles.page}>
      <div className={styles.tabIntro}>
        <p className={styles.tabIntroText}>
          Material findings only. A conflict is raised solely when two claims
          share the same subject, attribute and context, are both active, and
          hold incompatible values — supersession and scope differences are
          evaluated first, so this list stays short enough to act on.
        </p>

        <nav className={styles.filters} aria-label="Filter findings">
          {FILTERS.map(({ key, label }) => (
            <Link
              key={key}
              href={`/initiatives/${slug}/review${key === "open" ? "" : `?filter=${key}`}`}
              className={`${styles.filter} ${filter === key ? styles.filterActive : ""}`}
              aria-current={filter === key ? "page" : undefined}
            >
              {label}
              <span className={styles.filterCount}>{counts[key]}</span>
            </Link>
          ))}
        </nav>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          message={
            // "Nothing was detected" is a claim about a review that happened.
            // With no connected evidence there was no review to report on.
            evidenceCount === 0
              ? EMPTY.evidence
              : filter === "resolved"
                ? "No findings have been resolved yet."
                : EMPTY.findings
          }
          hint={
            evidenceCount === 0
              ? "Findings are detected from connected evidence. Add evidence on the Evidence tab to build this initiative's boundary."
              : undefined
          }
        />
      ) : (
        <>
          {/* Keeps the heading outline unbroken: finding rows are h3. */}
          <h2 className="visually-hidden">
            {FILTERS.find((f) => f.key === filter)?.label} findings
          </h2>
          <ul>
            {visible.map((finding) => (
              <FindingRow key={finding.id} finding={finding} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
