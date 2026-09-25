import Link from "next/link";
import type { Metadata } from "next";
import { getRepository } from "@/lib/data";
import { STAGE_LABEL } from "@/lib/domain/labels";
import { compareFindings } from "@/lib/review/engine";
import { deriveInstrumentSnapshot } from "@/lib/workspace/instrument";
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
    ? `${needsDecision.length} ${needsDecision.length === 1 ? "mismatch needs" : "mismatches need"} a decision across ${new Set(needsDecision.map((item) => item.initiative.id)).size} initiatives.`
    : waiting.length
      ? `${waiting.length} ${waiting.length === 1 ? "initiative needs" : "initiatives need"} setup before checking can start.`
      : "No decisions are waiting under the current checks.";
  const stages = new Map<string, number>();
  for (const row of rows) stages.set(STAGE_LABEL[row.initiative.stage], (stages.get(STAGE_LABEL[row.initiative.stage]) ?? 0) + 1);

  return <div className={styles.page}>
    <h1>What needs attention now?</h1>
    <p className={styles.attention}>{attention}</p>
    <section className={styles.section} aria-labelledby="needs-decision">
      <h2 id="needs-decision">Needs a decision</h2>
      {needsDecision.length ? <ul className={styles.list}>{needsDecision.map(({ initiative, finding }) =>
        <li key={`${initiative.id}-${finding.fingerprint}`}><Link href={`/initiatives/${initiative.slug}/decisions?item=${encodeURIComponent(finding.fingerprint)}`}>
          <strong>{finding.title}</strong><span>{initiative.name} · Values differ</span>
        </Link></li>
      )}</ul> : <p>No mismatches need a decision under the current checks.</p>}
    </section>
    <section className={styles.section} aria-labelledby="waiting-setup">
      <h2 id="waiting-setup">Waiting on setup</h2>
      {waiting.length ? <ul className={styles.list}>{waiting.map((row) =>
        <li key={row.initiative.id}><Link href={`/initiatives/${row.initiative.slug}`}>
          <strong>{row.initiative.name}</strong><span>{row.progress.current === "sources" ? "Add sources" : row.progress.current === "record" ? "Record Knowledge" : "Confirm Knowledge"}</span>
        </Link></li>
      )}</ul> : <p>Every initiative has the required setup records.</p>}
    </section>
    <section className={styles.section} aria-labelledby="recent-changes">
      <h2 id="recent-changes">Recent changes</h2>
      {activity.length ? <ul className={styles.list}>{activity.map((entry) => {
        const initiative = byId.get(entry.initiativeId);
        if (!initiative) return null;
        return <li key={entry.id}><Link href={`/initiatives/${initiative.slug}`}>
          <strong>{entry.summary}</strong><span>{initiative.name}</span>
        </Link></li>;
      })}</ul> : <p>No recent changes recorded.</p>}
    </section>
    <section className={styles.section} aria-labelledby="stages">
      <h2 id="stages">Stages</h2>
      {stages.size ? <ul className={styles.stageList}>{[...stages].map(([stage, count]) =>
        <li key={stage}><span>{stage}</span><span>{count}</span></li>
      )}</ul> : <p>No initiatives yet.</p>}
      <Link className={styles.allLink} href="/initiatives">View initiatives →</Link>
    </section>
  </div>;
}
