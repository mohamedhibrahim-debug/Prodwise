import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getRepository } from "@/lib/data";
import { STAGE_LABEL, BUSINESS_LINE_LABEL } from "@/lib/domain/labels";
import { compareFindings } from "@/lib/review/engine";
import { deriveInstrumentSnapshot } from "@/lib/workspace/instrument";
import { activitySummary } from "@/lib/workspace/copy";
import { SetupGuide } from "@/components/workspace/SetupGuide";
import styles from "./brief.module.css";

export const metadata: Metadata = { title: "Brief" };
export const dynamic = "force-dynamic";

export default async function BriefPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const repo = getRepository();
  const initiative = await repo.getInitiativeBySlug(slug);
  if (!initiative) notFound();
  const [snapshot, activity] = await Promise.all([
    repo.getInitiativeSnapshot(initiative.id),
    repo.listActivity(initiative.id, 8),
  ]);
  if (!snapshot) notFound();
  const instrument = deriveInstrumentSnapshot(snapshot);
  const open = instrument.findings.filter(f => f.status === "OPEN" && f.actionable).sort(compareFindings);
  const recorded = instrument.claims.filter((claim) => claim.status === "ACTIVE" && (claim.type === "RISK" || claim.type === "DEPENDENCY"));
  return <div className={styles.page}>
    <section className={styles.identity}>
      <h1>{initiative.name}</h1>
      {initiative.description ? <p>{initiative.description}</p> : null}
      <p className={styles.meta}>{STAGE_LABEL[initiative.stage]} · {BUSINESS_LINE_LABEL[initiative.businessLine]}</p>
    </section>
    {instrument.progress.mode === "setup" ? <SetupGuide progress={instrument.progress} slug={slug} /> : null}
    <section className={styles.section}>
      <h2>Delivery facts</h2>
      <p>Delivery dates, owner and squads are not recorded yet.</p>
    </section>
    <section className={styles.section}>
      <h2>Needs attention</h2>
      {open.length ? <ul className={styles.list}>{open.map((finding) => <li key={finding.fingerprint}>
        <Link href={`/initiatives/${slug}/decisions?item=${encodeURIComponent(finding.fingerprint)}`}>
          <strong>{finding.title}</strong><span>Values differ · Make a decision →</span>
        </Link>
      </li>)}</ul> : <p>No mismatches need a decision under the current checks.</p>}
    </section>
    <section className={styles.section}>
      <h2>What changed</h2>
      {activity.length ? <ul className={styles.list}>{activity.map((entry) => <li key={entry.id}>
        <span className={styles.change}><strong>{activitySummary(entry.summary)}</strong><time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleDateString("en-GB")}</time></span>
      </li>)}</ul> : <p>No recent changes recorded.</p>}
    </section>
    <section className={styles.section}>
      <h2>Recorded risks and dependencies</h2>
      {recorded.length ? <ul className={styles.list}>{recorded.map((claim) => <li key={claim.id}>
        <Link href={`/initiatives/${slug}/knowledge#claim-${claim.id}`}><strong>{claim.subject}</strong><span>{claim.value}</span></Link>
      </li>)}</ul> : <p>No risks or dependencies have been recorded.</p>}
    </section>
  </div>;
}
