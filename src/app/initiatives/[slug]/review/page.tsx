import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { EmptyState, EMPTY } from "@/components/primitives/EmptyState";
import { StatePill } from "@/components/primitives/StatePill";
import { FindingRow } from "@/components/initiative/FindingRow";
import { getRepository } from "@/lib/data";
import { STAGE_LABEL } from "@/lib/domain/labels";
import { isDemoWriteEnabled, WRITE_DISABLED_MESSAGE } from "@/lib/env";
import { compareFindings, runReview } from "@/lib/review/engine";
import { applyFindingStates } from "@/lib/review/merge";
import type { ReviewFinding } from "@/lib/domain/types";
import styles from "../workspace.module.css";

export const metadata: Metadata = { title: "Review" };

/* Findings are derived from live claims on every request, so a build-time
   render would freeze them against whatever Product Memory held at build. */
export const dynamic = "force-dynamic";

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
  return finding.status === "OPEN" && finding.actionable;
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

  const repo = getRepository();
  const initiative = await repo.getInitiativeBySlug(slug);
  if (!initiative) notFound();

  /* Evidence is deliberately NOT fetched here. listClaims already resolves
     provenance, so requesting it again doubled a cross-region round trip on
     every render. It is only needed to word one empty state, and only when
     there are no claims at all — so it is fetched there, not on the path every
     visitor takes. */
  const [claims, states] = await Promise.all([
    repo.listClaims(initiative.id),
    repo.listFindingStates(initiative.id),
  ]);

  const all = applyFindingStates(runReview(initiative.id, claims), states);

  const counts: Record<Filter, number> = {
    open: all.filter((f) => matches("open", f)).length,
    resolved: all.filter((f) => matches("resolved", f)).length,
    all: all.length,
  };

  /* Deliberately not sorted by severity: Slice 1 findings carry none, so any
     ranking by importance would be invented. Actionable work sorts above
     history because that is a derived fact, not a judgement. */
  const visible = all.filter((f) => matches(filter, f)).sort(compareFindings);

  // Only reached when Product Memory is empty, which is the one case where the
  // wording depends on whether any evidence has been connected.
  const evidenceCount =
    claims.length === 0 ? (await repo.listEvidence(initiative.id)).length : 0;

  const hidden = counts.all - counts.open - counts.resolved;

  return (
    <div className={`${styles.page} ${styles.reviewLayout}`}>
      <div className={styles.reviewMain}>
        <div className={styles.tabIntro}>
          {/* One line. The rule that produced a finding is stated on the finding
              itself, under "Why this was raised" — repeating it here as a spec
              only gates the content behind reading people skip. What stays is
              the part no finding can tell you: what is NOT looked for, so an
              empty Review can never be read as an all-clear (Rule 4). */}
          <p className={styles.tabIntroText}>
            <strong>
              No AI or semantic inference &mdash; findings are derived using
              deterministic rules.
            </strong>{" "}
            Conflicts and supersessions only; gaps, unknowns and risks are not
            checked.
          </p>

          {/* Three tabs all reading zero filter nothing — on an initiative with
              no findings the strip is noise, so it is not rendered. */}
          {counts.all > 0 ? (
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
          ) : null}

          {/* Open + Resolved does not equal All, which reads as a bug unless the
              difference is explained exactly where it appears. Counted, never
              hardcoded. */}
          {hidden > 0 ? (
            <p className={styles.filterNote}>
              {hidden === 1
                ? "One superseded claim is kept as history under All."
                : `${hidden} superseded claims are kept as history under All.`}{" "}
              History is never an open task.
            </p>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            /* Claims first, not evidence: findings derive from Product Memory
               now, so an empty Review is explained by the absence of claims. */
            message={
              claims.length === 0
                ? EMPTY.reviewNoClaims
                : filter === "resolved"
                  ? EMPTY.reviewResolved
                  : /* An empty Open queue is not the same as an empty Review.
                       Saying "nothing was found" while findings sit under All
                       would be plainly false. */
                    counts.all > 0
                    ? EMPTY.reviewNothingOpen
                    : EMPTY.reviewFindings
            }
            hint={
              claims.length === 0
                ? evidenceCount === 0
                  ? "Review compares recorded claims. No evidence has been connected yet either, so nothing has been reviewed here."
                  : "Review compares recorded claims. Until Product Memory has claims, no finding can be raised — and none can be ruled out."
                : filter === "resolved"
                  ? undefined
                  : counts.all > 0
                    ? `${counts.all} finding${counts.all === 1 ? " is" : "s are"} recorded under All, including superseded claims kept as history.`
                    : "Only conflicts and supersessions are detected. Gaps, unknowns and risks are not checked, so their absence here does not mean there are none."
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
                <FindingRow
                  key={finding.fingerprint}
                  finding={finding}
                  slug={slug}
                  canResolve={isDemoWriteEnabled}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Context, not a panel: no input, no scrim, no elevation — a plain column
          on the same canvas behind one hairline rule, so it can never read as
          the assistant rail that was removed. Built only from what this page
          already fetched, so it adds no query. */}
      <aside className={styles.reviewContext} aria-label="Initiative context">
        <div className={styles.contextBlock}>
          <div className={styles.contextLabel}>State</div>
          <StatePill state={initiative.overallState} />
          <p className={styles.contextValue}>{STAGE_LABEL[initiative.stage]}</p>
        </div>

        <div className={styles.contextBlock}>
          <div className={styles.contextLabel}>Waiting on you</div>
          <p className={styles.contextCount}>{counts.open}</p>
          <p className={styles.contextValue}>
            {counts.open === 1
              ? "finding needs a decision"
              : "findings need a decision"}
          </p>
        </div>

        <div className={styles.contextBlock}>
          <div className={styles.contextLabel}>Go to</div>
          <Link
            href={`/initiatives/${slug}/memory`}
            className={styles.contextLink}
          >
            Product Memory →
          </Link>
          <Link
            href={`/initiatives/${slug}/evidence`}
            className={styles.contextLink}
          >
            Evidence →
          </Link>
          <Link href={`/initiatives/${slug}`} className={styles.contextLink}>
            Overview →
          </Link>
        </div>

        {!isDemoWriteEnabled ? (
          <p className={styles.contextNotice}>{WRITE_DISABLED_MESSAGE}</p>
        ) : null}
      </aside>
    </div>
  );
}
