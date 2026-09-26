import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getRepository } from "@/lib/data";
import { compareFindings } from "@/lib/review/engine";
import { deriveInstrumentSnapshot } from "@/lib/workspace/instrument";
import { activitySummary, attentionSentence, isStructuredActivity } from "@/lib/workspace/copy";
import { readDelivery } from "@/lib/delivery/repository";
import { factFor, ownerFor } from "@/lib/delivery/model";
import { memberLabel } from "@/components/delivery/FactEditor";
import { STAGE_LABEL } from "@/lib/domain/labels";
import { safeUserLabel } from "@/lib/demo/presentation";
import styles from "./brief.module.css";

export const metadata: Metadata = { title: "Brief" };
export const dynamic = "force-dynamic";
export default async function BriefPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const delivery = await readDelivery();
  const snapshot = delivery.source.snapshots.find(row => row.initiative.slug === slug);
  if (!snapshot) notFound();
  const initiative = snapshot.initiative;
  const activity = await getRepository().listActivity(initiative.id, 6);
  const instrument = deriveInstrumentSnapshot(snapshot);
  const open = instrument.findings.filter(f => f.status === "OPEN" && f.actionable).sort(compareFindings);
  const recorded = instrument.claims.filter(claim => claim.status === "ACTIVE" && (claim.type === "RISK" || claim.type === "DEPENDENCY"));
  const facts = delivery.state.facts.filter(f => f.workspaceId === delivery.ctx.workspaceId);
  const get = (kind: Parameters<typeof factFor>[2]) => factFor(facts, initiative.id, kind);
  const scope = get("SCOPE"), target = get("TARGET_LIVE"), actual = get("ACTUAL_LIVE"), next = get("NEXT_STEP"), milestone = get("NEXT_MILESTONE"), blocker = get("BLOCKER");
  const deliveryChanges = delivery.state.events.filter(event => event.workspaceId === delivery.ctx.workspaceId && event.initiativeId === initiative.id).sort((a,b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 3);
  return <div className={styles.page}>
    <header className={styles.intro}><div><p className={styles.eyebrow}>Current-state dossier</p><h2>Initiative brief</h2></div><Link href={`/initiatives/${slug}/delivery`}>Open delivery record →</Link></header>
    <div className={styles.dossier}>
      <div className={styles.main}>
        <section className={styles.current} aria-labelledby="current-state"><div className={styles.sectionHead}><h2 id="current-state">Current state</h2><span>{STAGE_LABEL[initiative.stage]}</span></div>
          {initiative.description && <p className={styles.description}>{initiative.description}</p>}
          <dl className={styles.stateFields}><div><dt>Current scope / phase</dt><dd>{scope?.value.text ?? "Not recorded"}</dd></div><div><dt>Next step</dt><dd>{next?.value.text ?? "Not recorded"}</dd></div></dl>
          <p className={styles.note}>Recorded state, supported by the Knowledge and delivery records below.</p>
        </section>
        <section className={styles.attention} aria-labelledby="needs-attention"><div className={styles.sectionHead}><h2 id="needs-attention">Needs attention</h2><span>{open.length} open {open.length === 1 ? "decision" : "decisions"}</span></div>
          {blocker && <div className={styles.blocker}><strong>Recorded blocker</strong><p>{blocker.value.text}</p><Link href={`/initiatives/${slug}/delivery`}>Inspect confirmation →</Link></div>}
          {open.length ? <ul className={styles.decisionList}>{open.map(finding => <li key={finding.fingerprint}><h3>{attentionSentence(finding)}</h3><p className={styles.values}>{finding.claims.map(claim => claim.value).join(" / ")}</p><div><span>{finding.phase ?? "Phase not recorded"}</span><Link href={`/initiatives/${slug}/decisions?item=${encodeURIComponent(finding.fingerprint)}`}>Review decision →</Link></div></li>)}</ul> : <p className={styles.empty}>No open value mismatches under the current checks.</p>}
        </section>
        <section className={styles.section} aria-labelledby="what-changed"><div className={styles.sectionHead}><h2 id="what-changed">What changed</h2><Link href="/weekly-review">Weekly Review →</Link></div>
          {activity.length || deliveryChanges.length ? <ul className={styles.changes}>{deliveryChanges.map(event => <li key={event.id}><time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleDateString("en-GB")}</time><div><strong>{event.after.kind.replaceAll("_", " ").toLowerCase()} {event.after.state === "RETRACTED" ? "withdrawn" : "confirmed"}</strong><p>{event.after.state === "RETRACTED" ? "Current value unknown" : event.after.kind === "TARGET_LIVE" ? `${event.before?.value.date ?? "Not recorded"} → ${event.after.value.date}` : event.after.value.date ?? event.after.value.text ?? "Owner assignment recorded"}</p></div></li>)}{activity.map(entry => <li key={entry.id}><time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleDateString("en-GB")}</time><strong data-activity-summary data-activity-legacy={!isStructuredActivity(entry) || undefined}>{activitySummary(entry)}</strong></li>)}</ul> : <p className={styles.empty}>No recent changes recorded.</p>}
        </section>
        <section className={styles.section} aria-labelledby="risks"><div className={styles.sectionHead}><h2 id="risks">Recorded risks and dependencies</h2></div>{recorded.length ? <ul className={styles.risks}>{recorded.map(claim => <li key={claim.id}><span>{claim.type === "RISK" ? "Risk" : "Dependency"}</span><Link href={`/initiatives/${slug}/knowledge#claim-${claim.id}`}><strong>{claim.subject}</strong><p>{claim.value}</p></Link></li>)}</ul> : <p className={styles.empty}>No risks or dependencies have been recorded.</p>}</section>
      </div>
      <aside className={styles.context}>
        <section aria-labelledby="delivery-context"><div className={styles.sectionHead}><h2 id="delivery-context">Delivery context</h2></div><dl className={styles.facts}>
          <div><dt>Initiative owner</dt><dd>{memberLabel(delivery.source.members, ownerFor(facts, initiative.id))}</dd></div>
          <div><dt>Development Start</dt><dd>{get("DEV_STARTED")?.value.date ?? <span className={styles.unknown}>Unknown</span>}</dd></div>
          <div className={styles.target}><dt>Target Live · planned</dt><dd>{target?.value.date ?? <span className={styles.unknown}>Unknown</span>}</dd>{target && <small>{target.preparedAsFixture ? "Prepared by" : "Confirmed by"} {safeUserLabel(target)}</small>}</div>
          <div><dt>Actual Live · confirmed</dt><dd>{actual?.value.date ?? <span className={styles.unknown}>Not recorded</span>}</dd>{actual && <small>{actual.value.extent === "PARTIAL" ? `Partial · ${actual.value.text}` : "Full named scope"}</small>}</div>
          <div><dt>Next milestone</dt><dd>{milestone?.value.text ?? "Not recorded"}</dd>{milestone && <small>{milestone.value.date ?? "Date unknown"}</small>}</div>
        </dl><Link className={styles.contextLink} href={`/initiatives/${slug}/delivery`}>Review facts and history →</Link><Link className={styles.contextLink} href="/roadmap">See portfolio Roadmap →</Link><p className={styles.note}>Missing Actual Live does not establish whether the initiative has launched.</p></section>
        <section className={styles.record} aria-labelledby="record-context"><h2 id="record-context">Knowledge behind this brief</h2><dl><div><dt>Confirmed entries</dt><dd>{snapshot.claims.filter(claim => claim.status === "ACTIVE").length}</dd></div><div><dt>Recorded sources</dt><dd>{snapshot.evidence.length}</dd></div></dl><Link className={styles.contextLink} href={`/initiatives/${slug}/knowledge`}>Open Knowledge ledger →</Link><Link className={styles.contextLink} href={`/initiatives/${slug}/knowledge/sources`}>Browse source library →</Link>{!snapshot.claims.length && <p className={styles.note}>Add source material, then record and confirm what it establishes.</p>}</section>
      </aside>
    </div>
  </div>;
}
