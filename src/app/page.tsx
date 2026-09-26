import Link from "next/link";
import type { Metadata } from "next";
import { getRepository } from "@/lib/data";
import { compareFindings } from "@/lib/review/engine";
import { deriveInstrumentSnapshot } from "@/lib/workspace/instrument";
import { activitySummary, attentionSentence, isStructuredActivity } from "@/lib/workspace/copy";
import styles from "./home.module.css";

export const metadata: Metadata = { title: "Home" };
export const dynamic = "force-dynamic";

export default async function Home() {
  const repo = getRepository();
  const [snapshots, activity] = await Promise.all([repo.listInitiativeSnapshots(), repo.listRecentActivity(12)]);
  const rows = snapshots.map(deriveInstrumentSnapshot);
  const byId = new Map(rows.map(row => [row.initiative.id, row.initiative]));
  const decisions = rows.flatMap(row => row.findings.filter(f => f.status === "OPEN" && f.actionable)
    .sort(compareFindings).map(finding => ({ initiative: row.initiative, finding })));
  const waiting = rows.filter(row => !row.progress.complete);
  const knownEvents = new Set(["FINDING_DECIDED", "FINDING_REOPENED", "FINDING_RESOLVED", "FINDING_CONFIRMER_ASSIGNED", "CLAIM_VERIFIED",
    "CLAIM_ADDED", "CLAIM_VALUE_CHANGED", "CLAIM_STATUS_CHANGED", "CLAIM_SUPERSEDED", "CLAIM_SUPERSESSION_SET",
    "EVIDENCE_RECLASSIFIED", "CLAIM_EVIDENCE_LINKED", "CLAIM_EVIDENCE_UNLINKED", "CLAIM_EVIDENCE_ANCHOR_UPDATED"]);
  const changes = activity.filter(entry => byId.has(entry.initiativeId) && knownEvents.has(entry.eventType));
  return <div className={styles.page}>
    <header className={styles.head}><div><p className={styles.eyebrow}>Portfolio attention</p>
      <h1>What needs attention now?</h1><p className={styles.subtitle}>Recorded knowledge, decisions and changes across your initiatives.</p></div>
      <Link className={styles.primary} href="/weekly-review">Prepare weekly review →</Link></header>
    <p className={styles.counts}>{rows.length} initiatives · {new Set(decisions.map(d => d.initiative.id)).size} with decisions waiting · {waiting.length} with setup incomplete</p>
    <section className={styles.attention} aria-labelledby="needs-decision">
      <div className={styles.sectionHead}><h2 id="needs-decision">Needs a decision</h2><span>Listed in default order — not prioritised</span></div>
      {decisions.length ? <ul className={styles.decisionList}>{decisions.map(({initiative, finding}) =>
        <li key={finding.fingerprint}><div className={styles.decisionMeta}>
          <Link href={`/initiatives/${initiative.slug}`}>{initiative.name}</Link>
          {initiative.isDemo ? <span className={styles.demo}>Synthetic demo</span> : null}
          {finding.phase ? <span>{finding.phase}</span> : null}
        </div><h3>{attentionSentence(finding)}</h3>
        <div className={styles.comparison}>{finding.claims.map((claim, index) => <span key={claim.claimId}>
          {index ? <i aria-hidden="true">vs</i> : null}<b>{claim.value}</b>
        </span>)}</div>
        <p className={styles.support}>Recorded values differ. Review source context before choosing.{finding.confirmerLabel ? ` Confirm with: ${finding.confirmerLabel}.` : ""}</p>
        <Link className={styles.primary} href={`/initiatives/${initiative.slug}/decisions?item=${encodeURIComponent(finding.fingerprint)}`}>Review decision →</Link>
        </li>)}</ul> : <p className={styles.empty}>No mismatches need a decision under the current checks. This does not establish release status.</p>}
    </section>
    <div className={styles.lower}>
      <section className={styles.section} aria-labelledby="recent-changes"><h2 id="recent-changes">Recent recorded changes</h2>
        <p className={styles.support}>Latest recorded events. Weekly Review uses its own selected period and finalized baseline.</p>
        {changes.length ? <ul className={styles.list}>{changes.map(entry => {
          const initiative = byId.get(entry.initiativeId)!;
          return <li key={entry.id}><Link href={`/initiatives/${initiative.slug}`}>
            <strong data-activity-summary data-activity-legacy={!isStructuredActivity(entry) || undefined}>{activitySummary(entry)}</strong>
            <span>{initiative.name} · <time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleDateString("en-GB")}</time></span>
          </Link></li>;
        })}</ul> : <p className={styles.empty}>No recent changes of these types are recorded.</p>}
        <p className={styles.support}>Source detail updates remain visible; the current log may not establish whether the supporting basis changed.</p>
      </section>
      <section className={styles.section} aria-labelledby="waiting-setup"><h2 id="waiting-setup">Setup incomplete</h2>
        {waiting.length ? <ul className={styles.list}>{waiting.map(row => <li key={row.initiative.id}>
          <Link href={`/initiatives/${row.initiative.slug}`}><strong>{row.initiative.name}</strong>
          <span>{row.progress.current === "sources" ? "Add sources" : row.progress.current === "record" ? "Record Knowledge" : "Confirm Knowledge"}</span>
          <span>{row.progress.facts.decisionsOpen ? "Setup incomplete · a decision is available" : "Not assessed yet — setup incomplete"}</span></Link>
        </li>)}</ul> : <p className={styles.empty}>Every initiative has the required setup records.</p>}
        <Link className={styles.allLink} href="/initiatives">Open initiative register →</Link>
      </section>
    </div>
    <p className={styles.support}>Recorded stage — not a schedule. Checks compare recorded values and preserve replacement history. Gaps, unknowns, risks and release status are not assessed here.</p>
  </div>;
}
