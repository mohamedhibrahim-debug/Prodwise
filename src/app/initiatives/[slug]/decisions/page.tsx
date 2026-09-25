import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EmptyState, EMPTY } from "@/components/primitives/EmptyState";
import { DecisionRecord } from "@/components/initiative/DecisionRecord";
import { DecisionDeepLink } from "@/components/initiative/DecisionDeepLink";
import { FindingRow } from "@/components/initiative/FindingRow";
import { getRepository } from "@/lib/data";
import { STAGE_LABEL } from "@/lib/domain/labels";
import { isDemoWriteEnabled, WRITE_DISABLED_MESSAGE } from "@/lib/env";
import { compareFindings } from "@/lib/review/engine";
import { loadDecisions } from "@/lib/workspace/decisions";
import { DECISION_LANES, type DecisionLaneKey } from "@/lib/workspace/decision-lanes";
import styles from "../workspace.module.css";

export const metadata: Metadata = { title: "Decisions" };
export const dynamic = "force-dynamic";

export default async function DecisionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const repo = getRepository();
  const initiative = await repo.getInitiativeBySlug(slug);
  if (!initiative) notFound();
  const { claims, findings: all, states } = await loadDecisions(initiative.id);
  const needsDecision = all.filter((finding) => finding.status === "OPEN" && finding.actionable).sort(compareFindings);
  const reviewed = all.filter((finding) => finding.status === "RESOLVED" && finding.type !== "SUPERSEDED" &&
    states.some((state) => state.fingerprint === finding.fingerprint && state.status === "RESOLVED" && state.outcome === null)).sort(compareFindings);
  const history = all.filter((finding) => finding.type === "SUPERSEDED").sort(compareFindings);
  const standing = states.filter((state) => state.outcome && !needsDecision.some((finding) => finding.fingerprint === state.fingerprint));
  const sourceCount = claims.length === 0 ? (await repo.listEvidence(initiative.id)).length : 0;
  const row = (finding: (typeof all)[number], canResolve = isDemoWriteEnabled) =>
    <FindingRow key={finding.fingerprint} finding={finding} slug={slug} canResolve={canResolve}
      previousConfirmedWith={states.find((state) => state.fingerprint === finding.fingerprint)?.confirmedWith} />;
  const content: Record<DecisionLaneKey, { count?: number; body: ReactNode }> = {
    "needs-decision": { count: needsDecision.length, body: needsDecision.length ? <ul>{needsDecision.map((finding) => row(finding))}</ul> :
      claims.length === 0 ? <EmptyState message={EMPTY.reviewNoClaims}
        hint={sourceCount === 0 ? "No sources or Knowledge entries have been recorded for comparison." : "Record Knowledge entries before values can be compared."} /> :
      <p className={styles.decisionLaneEmpty}>{EMPTY.reviewNothingOpen}</p> },
    reviewed: { count: reviewed.length, body: reviewed.length ? <ul>{reviewed.map((finding) => row(finding))}</ul> : <p className={styles.decisionLaneEmpty}>No reviewed notes yet.</p> },
    resolved: { count: standing.length, body: standing.length ? <ul>{standing.map((state) => <DecisionRecord key={state.fingerprint} state={state} slug={slug} />)}</ul> : <p className={styles.decisionLaneEmpty}>No decision records yet.</p> },
    history: { count: history.length, body: history.length ? <ul>{history.map((finding) => row(finding, false))}</ul> : <p className={styles.decisionLaneEmpty}>No replaced values are recorded.</p> },
    "not-checked": { body: null },
  };

  return <div className={`${styles.page} ${styles.reviewLayout}`}>
    <Suspense fallback={null}><DecisionDeepLink /></Suspense>
    <div className={styles.reviewMain}>
      <div className={styles.tabIntro}><p className={styles.tabIntroText}><strong>Compare recorded values, review their sources, and record a decision.</strong></p></div>
      {DECISION_LANES.map((lane) => <section className={styles.decisionLane} id={`lane-${lane.key}`} key={lane.key}>
        <div className={styles.decisionLaneHead}><div><h2 className={styles.decisionLaneTitle}>{lane.title}</h2><p className={styles.decisionLaneDescription}>{lane.description}</p></div>
          {content[lane.key].count !== undefined ? <span className={styles.decisionLaneCount}>{content[lane.key].count}</span> : null}</div>
        {content[lane.key].body}
      </section>)}
    </div>
    <aside className={styles.reviewContext} aria-label="Initiative context">
      <div className={styles.contextBlock}><div className={styles.contextLabel}>Stage</div><p className={styles.contextValue}>{STAGE_LABEL[initiative.stage]}</p></div>
      <div className={styles.contextBlock}><div className={styles.contextLabel}>Waiting on you</div><p className={styles.contextCount}>{needsDecision.length}</p>
        <p className={styles.contextValue}>{needsDecision.length === 1 ? "mismatch needs a decision" : "mismatches need a decision"}</p></div>
      <div className={styles.contextBlock}><div className={styles.contextLabel}>Go to</div>
        <Link href={`/initiatives/${slug}/knowledge`} className={styles.contextLink}>Knowledge →</Link>
        <Link href={`/initiatives/${slug}/knowledge/sources`} className={styles.contextLink}>Sources →</Link>
        <Link href={`/initiatives/${slug}`} className={styles.contextLink}>Brief →</Link></div>
      {!isDemoWriteEnabled ? <p className={styles.contextNotice}>{WRITE_DISABLED_MESSAGE}</p> : null}
    </aside>
  </div>;
}
