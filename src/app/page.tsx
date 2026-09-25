import Link from "next/link";
import type { Metadata } from "next";
import { getRepository } from "@/lib/data";
import { STAGE_LABEL } from "@/lib/domain/labels";
import { compareFindings } from "@/lib/review/engine";
import { deriveInstrumentSnapshot } from "@/lib/workspace/instrument";
import { activitySummary, attentionSentence, isStructuredActivity } from "@/lib/workspace/copy";
import styles from "./home.module.css";

export const metadata: Metadata = { title: "Home" };
export const dynamic = "force-dynamic";

export default async function Home() {
  const repo = getRepository();
  const [snapshots, activity] = await Promise.all([repo.listInitiativeSnapshots(), repo.listRecentActivity(6)]);
  const rows = snapshots.map(deriveInstrumentSnapshot);
  const byId = new Map(rows.map((row) => [row.initiative.id, row.initiative]));
  const needsDecision = rows.flatMap((row) => row.findings
    .filter((finding) => finding.status === "OPEN" && finding.actionable)
    .sort(compareFindings)
    .map((finding) => ({ initiative: row.initiative, finding })));
  const waiting = rows.filter((row) => !row.progress.complete);
  const attention = needsDecision.length
    ? `${needsDecision.length} ${needsDecision.length === 1 ? "mismatch needs" : "mismatches need"} a decision across ${new Set(needsDecision.map((item) => item.initiative.id)).size} ${new Set(needsDecision.map((item) => item.initiative.id)).size === 1 ? "initiative" : "initiatives"}.`
    : waiting.length
      ? `${waiting.length} ${waiting.length === 1 ? "initiative needs" : "initiatives need"} setup before checking can start.`
      : "No decisions are waiting under the current checks.";
  const stages = new Map<string, typeof rows>();
  for (const row of rows) stages.set(STAGE_LABEL[row.initiative.stage], [...(stages.get(STAGE_LABEL[row.initiative.stage]) ?? []), row]);

  return <div className={styles.page}>
    <header className={styles.hero}>
    <p className={styles.eyebrow}>Prodwise · Initiative intelligence</p>
    <h1>What needs attention now?</h1>
    <p className={styles.attention}>{attention}</p>
    <div className={styles.stats}>
      <div><b>{rows.length}</b><span>Initiatives</span></div>
      <div><b>{needsDecision.length}</b><span>Need a decision</span></div>
      <div><b>{waiting.length}</b><span>Waiting on setup</span></div>
    </div>
    </header>
    <div className={styles.grid}>
    <section className={styles.section} aria-labelledby="needs-decision">
      <h2 id="needs-decision">Needs a decision</h2>
      <p>Listed in default order — not prioritised</p>
      {needsDecision.length ? <ul className={styles.decisionList}>{needsDecision.map(({ initiative, finding }) =>
        <li key={`${initiative.id}-${finding.fingerprint}`}>
          <div className={styles.decisionBody}><div className={styles.decisionInfo}>
            <p className={styles.decisionMeta}>{initiative.name} · Values differ{finding.confirmerLabel ? ` · Confirm with: ${finding.confirmerLabel}` : ""}</p>
            <h3>{attentionSentence(finding)}</h3>
            <div className={styles.sourceLinks}>{finding.claims.flatMap(claim => claim.evidence.filter(source => source.boundary !== "EXCLUDED").map(source =>
              <Link key={`${claim.claimId}-${source.evidenceId}`} href={`/initiatives/${initiative.slug}/knowledge/sources#source-${source.evidenceId}`}><strong>{source.title}</strong><span>{source.sourceReference ? `${source.sourceReference} · ` : ""}Records {claim.value}</span></Link>
            ))}</div>
          </div><div className={styles.comparison}><span>Recorded values</span><div>{finding.claims.map((claim, index) => <span key={claim.claimId}>{index > 0 ? <i aria-hidden="true">vs</i> : null} <b>{claim.value}</b></span>)}</div><small>Review the sources before choosing.</small></div></div>
          <div className={styles.decisionFooter}><Link href={`/initiatives/${initiative.slug}/decisions?item=${encodeURIComponent(finding.fingerprint)}`}>Review decision →</Link><span>Open this comparison and its sources.</span></div>
        </li>
      )}</ul> : <p>No mismatches need a decision under the current checks.</p>}
    </section>
    <section className={styles.section} aria-labelledby="waiting-setup">
      <h2 id="waiting-setup">Waiting on setup</h2>
      {waiting.length ? <ul className={styles.list}>{waiting.map((row) =>
        <li key={row.initiative.id}><Link href={`/initiatives/${row.initiative.slug}`}>
          <strong>{row.initiative.name}</strong><span>{row.progress.current === "sources" ? "Add sources" : row.progress.current === "record" ? "Record Knowledge" : "Confirm Knowledge"}</span>
          <span>{row.progress.facts.decisionsOpen ? "Setup incomplete · a decision is available" : "Not assessed yet — setup incomplete"}</span>
        </Link></li>
      )}</ul> : <p>Every initiative has the required setup records.</p>}
    </section>
    <section className={styles.section} aria-labelledby="recent-changes">
      <h2 id="recent-changes">Recent changes</h2>
      {activity.length ? <ul className={styles.list}>{activity.map((entry) => {
        const initiative = byId.get(entry.initiativeId);
        if (!initiative) return null;
        return <li key={entry.id}><Link href={`/initiatives/${initiative.slug}`}>
          <strong data-activity-summary data-activity-legacy={!isStructuredActivity(entry) || undefined}>{activitySummary(entry)}</strong><span>{initiative.name} · <time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleDateString("en-GB")}</time></span>
        </Link></li>;
      })}</ul> : <p>No recent changes recorded.</p>}
    </section>
    <section className={styles.section} aria-labelledby="stages">
      <h2 id="stages">Stages</h2>
      <p>Recorded stage — not a schedule.</p>
      {stages.size ? <ul className={styles.stageList}>{[...stages].map(([stage, stageRows]) =>
        <li key={stage}><span>{stage}</span><span>{stageRows.map((row, index) => <span key={row.initiative.id}>{index > 0 ? ", " : ""}<Link href={`/initiatives/${row.initiative.slug}`}>{row.initiative.name}</Link></span>)}</span></li>
      )}</ul> : <p>No initiatives yet.</p>}
      <Link className={styles.allLink} href="/initiatives">View initiatives →</Link>
    </section>
    </div>
  </div>;
}
