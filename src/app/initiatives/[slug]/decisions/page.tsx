import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { EmptyState, EMPTY } from "@/components/primitives/EmptyState";
import { UnestablishedState } from "@/components/primitives/UnestablishedState";
import { FindingRow } from "@/components/initiative/FindingRow";
import { getRepository } from "@/lib/data";
import { STAGE_LABEL } from "@/lib/domain/labels";
import { isDemoWriteEnabled, WRITE_DISABLED_MESSAGE } from "@/lib/env";
import { compareFindings } from "@/lib/review/engine";
import { loadDecisions } from "@/lib/workspace/decisions";
import styles from "../workspace.module.css";

export const metadata: Metadata = { title: "Decisions" };

/* Findings are derived from live claims on every request, so a build-time
   render would freeze them against whatever Product Memory held at build. */
export const dynamic = "force-dynamic";

export default async function DecisionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const repo = getRepository();
  const initiative = await repo.getInitiativeBySlug(slug);
  if (!initiative) notFound();

  /* Evidence is deliberately NOT fetched here. listClaims already resolves
     provenance, so requesting it again doubled a cross-region round trip on
     every render. It is only needed to word one empty state, and only when
     there are no claims at all — so it is fetched there, not on the path every
     visitor takes. */
  const { claims, findings: all } = await loadDecisions(initiative.id);

  /* These lanes partition the already-derived result. They add no state and
     assign no new meaning: supersessions remain history, while Resolved reads
     the existing pre-Stage-2 finding-state records exactly as before. */
  const needsDecision = all
    .filter((finding) => finding.status === "OPEN" && finding.actionable)
    .sort(compareFindings);
  const resolved = all
    .filter(
      (finding) =>
        finding.status === "RESOLVED" && finding.type !== "SUPERSEDED",
    )
    .sort(compareFindings);
  const history = all
    .filter((finding) => finding.type === "SUPERSEDED")
    .sort(compareFindings);

  // Only reached when Product Memory is empty, which is the one case where the
  // wording depends on whether any evidence has been connected.
  const evidenceCount =
    claims.length === 0 ? (await repo.listEvidence(initiative.id)).length : 0;

  return (
    <div className={`${styles.page} ${styles.reviewLayout}`}>
      <div className={styles.reviewMain}>
        <div className={styles.tabIntro}>
          <p className={styles.tabIntroText}>
            <strong>
              Current Decisions findings are derived using deterministic rules.{" "}
              AI-assisted detection is not active yet.
            </strong>
          </p>
        </div>

        <section className={styles.decisionLane} id="lane-needs-decision">
          <div className={styles.decisionLaneHead}>
            <div>
              <h2 className={styles.decisionLaneTitle}>Needs a decision</h2>
              <p className={styles.decisionLaneDescription}>
                Actionable conflicts that are currently open.
              </p>
            </div>
            <span className={styles.decisionLaneCount}>{needsDecision.length}</span>
          </div>
          {needsDecision.length > 0 ? (
            <ul>
              {needsDecision.map((finding) => (
                <FindingRow
                  key={finding.fingerprint}
                  finding={finding}
                  slug={slug}
                  canResolve={isDemoWriteEnabled}
                />
              ))}
            </ul>
          ) : claims.length === 0 ? (
            <EmptyState
              message={EMPTY.reviewNoClaims}
              hint={
                evidenceCount === 0
                  ? "Review compares recorded claims. No evidence has been connected yet either, so nothing has been reviewed here."
                  : "Review compares recorded claims. Until Product Memory has claims, no finding can be raised — and none can be ruled out."
              }
            />
          ) : (
            <p className={styles.decisionLaneEmpty}>{EMPTY.reviewNothingOpen}</p>
          )}
        </section>

        <section className={styles.decisionLane} id="lane-resolved">
          <div className={styles.decisionLaneHead}>
            <div>
              <h2 className={styles.decisionLaneTitle}>Resolved</h2>
              <p className={styles.decisionLaneDescription}>
                Existing finding-state decisions and their recorded notes.
              </p>
            </div>
            <span className={styles.decisionLaneCount}>{resolved.length}</span>
          </div>
          {resolved.length > 0 ? (
            <ul>
              {resolved.map((finding) => (
                <FindingRow
                  key={finding.fingerprint}
                  finding={finding}
                  slug={slug}
                  canResolve={isDemoWriteEnabled}
                />
              ))}
            </ul>
          ) : (
            <p className={styles.decisionLaneEmpty}>{EMPTY.reviewResolved}</p>
          )}
        </section>

        <section className={styles.decisionLane} id="lane-history">
          <div className={styles.decisionLaneHead}>
            <div>
              <h2 className={styles.decisionLaneTitle}>History</h2>
              <p className={styles.decisionLaneDescription}>
                Superseded information retained for lineage. Nothing here is an
                open task.
              </p>
            </div>
            <span className={styles.decisionLaneCount}>{history.length}</span>
          </div>
          {history.length > 0 ? (
            <ul>
              {history.map((finding) => (
                <FindingRow
                  key={finding.fingerprint}
                  finding={finding}
                  slug={slug}
                  canResolve={false}
                />
              ))}
            </ul>
          ) : (
            <p className={styles.decisionLaneEmpty}>
              No superseded findings are recorded.
            </p>
          )}
        </section>

        <section className={styles.decisionLane} id="lane-not-checked">
          <div className={styles.decisionLaneHead}>
            <div>
              <h2 className={styles.decisionLaneTitle}>Not checked yet</h2>
              <p className={styles.decisionLaneDescription}>
                GAP, UNKNOWN and RISK detection is not implemented yet. No
                findings are reported for those types here.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Context, not a panel: no input, no scrim, no elevation — a plain column
          on the same canvas behind one hairline rule, so it can never read as
          the assistant rail that was removed. Built only from what this page
          already fetched, so it adds no query. */}
      <aside className={styles.reviewContext} aria-label="Initiative context">
        <div className={styles.contextBlock}>
          <div className={styles.contextLabel}>State</div>
          <UnestablishedState />
          <p className={styles.contextValue}>{STAGE_LABEL[initiative.stage]}</p>
        </div>

        <div className={styles.contextBlock}>
          <div className={styles.contextLabel}>Waiting on you</div>
          <p className={styles.contextCount}>{needsDecision.length}</p>
          <p className={styles.contextValue}>
            {needsDecision.length === 1
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
            Memory →
          </Link>
          <Link
            href={`/initiatives/${slug}/sources`}
            className={styles.contextLink}
          >
            Sources →
          </Link>
          <Link href={`/initiatives/${slug}`} className={styles.contextLink}>
            Status →
          </Link>
        </div>

        {!isDemoWriteEnabled ? (
          <p className={styles.contextNotice}>{WRITE_DISABLED_MESSAGE}</p>
        ) : null}
      </aside>
    </div>
  );
}
