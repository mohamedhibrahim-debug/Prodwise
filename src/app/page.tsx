import Link from "next/link";
import type { Metadata } from "next";
import { getRepository } from "@/lib/data";
import { compareFindings } from "@/lib/review/engine";
import { deriveInstrumentSnapshot } from "@/lib/workspace/instrument";
import { activitySummary, isStructuredActivity } from "@/lib/workspace/copy";
import { readDelivery } from "@/lib/delivery/repository";
import { cairoDay, factFor } from "@/lib/delivery/model";
import { FACT_LABELS } from "@/components/delivery/FactEditor";
import { BUSINESS_LINE_LABEL } from "@/lib/domain/labels";
import { deliveryTiming } from "@/lib/delivery/roadmap";
import { safeUserLabel } from "@/lib/demo/presentation";
import styles from "./home.module.css";

export const metadata: Metadata = { title: "Home" };
export const dynamic = "force-dynamic";
const displayDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export default async function Home() {
  const [delivery, activity] = await Promise.all([readDelivery(), getRepository().listRecentActivity(12)]);
  const rows = delivery.source.snapshots.map(deriveInstrumentSnapshot);
  const byId = new Map(rows.map(row => [row.initiative.id, row.initiative]));
  const facts = delivery.state.facts.filter(fact => fact.workspaceId === delivery.ctx.workspaceId);
  const today = cairoDay(delivery.presentation.scenarioAt ?? new Date().toISOString());
  const decisions = rows.flatMap(row => row.findings.filter(f => f.status === "OPEN" && f.actionable)
    .sort(compareFindings).map(finding => ({ initiative: row.initiative, finding })));
  const pastTargets = rows.filter(row => deliveryTiming(facts, row.initiative.id, today).kind === "NEEDS_UPDATE");
  const pastMilestones = rows.flatMap(row => { const milestone = factFor(facts, row.initiative.id, "NEXT_MILESTONE"); return milestone?.value.date && milestone.value.date < today ? [{ initiative: row.initiative, milestone }] : []; });
  const blockers = rows.flatMap(row => { const blocker = factFor(facts, row.initiative.id, "BLOCKER"); return blocker ? [{ initiative: row.initiative, blocker }] : []; });
  const upcoming = rows.flatMap(row => (["TARGET_LIVE", "NEXT_MILESTONE"] as const).flatMap(kind => {
    if (kind === "TARGET_LIVE" && deliveryTiming(facts, row.initiative.id, today).kind === "RECORDED") return [];
    const fact = factFor(facts, row.initiative.id, kind);
    return fact?.value.date && fact.value.date >= today ? [{ initiative: row.initiative, fact, date: fact.value.date }] : [];
  })).sort((a, b) => a.date.localeCompare(b.date));
  const unscheduled = rows.filter(row => !factFor(facts, row.initiative.id, "TARGET_LIVE")?.value.date).length;
  const knownEvents = new Set(["FINDING_DECIDED", "FINDING_REOPENED", "FINDING_RESOLVED", "FINDING_CONFIRMER_ASSIGNED", "CLAIM_VERIFIED", "CLAIM_ADDED", "CLAIM_VALUE_CHANGED", "CLAIM_STATUS_CHANGED", "CLAIM_SUPERSEDED", "CLAIM_SUPERSESSION_SET", "EVIDENCE_RECLASSIFIED", "CLAIM_EVIDENCE_LINKED", "CLAIM_EVIDENCE_UNLINKED", "CLAIM_EVIDENCE_ANCHOR_UPDATED"]);
  const changes = activity.filter(entry => byId.has(entry.initiativeId) && knownEvents.has(entry.eventType)).slice(0, 5);
  const deliveryChanges = delivery.state.events.filter(event => event.workspaceId === delivery.ctx.workspaceId && byId.has(event.initiativeId)).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 4);
  return <div className={styles.page}>
    <header className={styles.head}><div><p className={styles.eyebrow}>Portfolio / {delivery.presentation.isDemo ? `Scenario date · ${displayDate(today)} ${today.slice(0,4)}` : "Today"}</p><h1>What needs attention?</h1><p className={styles.subtitle}>Decisions to make. Delivery changes to understand.</p></div></header>
    <nav className={styles.pulse} aria-label="Portfolio attention">
      <Link href="#needs-decision"><strong>{decisions.length}</strong> open decisions <span>↓</span></Link><Link href="#delivery-attention"><strong>{blockers.length}</strong> recorded blockers <span>↓</span></Link><Link href="#delivery-attention"><strong>{pastTargets.length}</strong> past targets to check <span>↓</span></Link>
    </nav>
    <div className={styles.cockpit}>
      <div className={styles.mainColumn}>
        <section className={styles.attention} aria-labelledby="needs-decision"><div className={styles.sectionHead}><h2 id="needs-decision">Needs a decision</h2><span>{decisions.length} open · default order</span></div>
          {decisions.length ? <ul className={styles.decisionList}>{decisions.map(({ initiative, finding }) => <li key={finding.fingerprint}>
            <div className={styles.decisionMeta}><Link href={`/initiatives/${initiative.slug}`}>{initiative.name}</Link><span>{finding.phase ?? "Phase not recorded"}</span></div>
            <h3>{finding.subject} · {finding.claims[0]?.attribute ?? "Recorded values"}</h3><p className={styles.mismatchLabel}>Confirmed values differ</p><div className={styles.comparison}>{finding.claims.map((claim, index) => <span key={claim.claimId}>{index ? <i aria-hidden="true">vs</i> : null}<b>{claim.value}</b></span>)}</div>
            <div className={styles.decisionFooter}><p>Review the source context.{finding.confirmerLabel ? ` Confirm with ${finding.confirmerLabel}.` : ""}</p><Link href={`/initiatives/${initiative.slug}/decisions?item=${encodeURIComponent(finding.fingerprint)}`}>Review decision →</Link></div>
          </li>)}</ul> : <p className={styles.empty}>No open value mismatches under the current checks. This is not a release assessment.</p>}
        </section>
        <section className={styles.section} aria-labelledby="delivery-attention"><div className={styles.sectionHead}><h2 id="delivery-attention">Delivery needs attention</h2></div>{blockers.length || pastTargets.length || pastMilestones.length ? <ul className={styles.list}>
          {blockers.map(({ initiative, blocker }) => <li key={blocker.id}><Link href={`/initiatives/${initiative.slug}/delivery`}><span className={styles.flag}>Recorded blocker</span><strong>{initiative.name}</strong><p>{blocker.value.text}</p></Link></li>)}
          {pastTargets.map(({ initiative }) => { const timing = deliveryTiming(facts, initiative.id, today); return <li key={initiative.id}><Link href={`/initiatives/${initiative.slug}/delivery`}><span className={styles.flag}>{timing.label}</span><strong>{initiative.name}</strong><p>Target {displayDate(factFor(facts, initiative.id, "TARGET_LIVE")!.value.date!)}. {timing.detail}</p></Link></li>; })}
          {pastMilestones.map(({ initiative, milestone }) => <li key={milestone.id}><Link href={`/initiatives/${initiative.slug}/delivery`}><span className={styles.flag}>Past milestone · update needed</span><strong>{initiative.name}</strong><p>{milestone.value.text} · {displayDate(milestone.value.date!)}. Confirm the current position; completion is not inferred.</p></Link></li>)}
        </ul> : <p className={styles.empty}>No recorded blockers or past dates need an update under these checks.</p>}</section>
        <section className={styles.section} aria-labelledby="recent-changes"><div className={styles.sectionHead}><h2 id="recent-changes">What changed</h2><span>Latest recorded activity</span></div>
          {deliveryChanges.length || changes.length ? <ul className={styles.list}>{deliveryChanges.map(event => <li key={event.id}><Link href={`/initiatives/${byId.get(event.initiativeId)!.slug}/delivery`}><span className={styles.changeType}>{FACT_LABELS[event.after.kind]}</span><strong>{byId.get(event.initiativeId)!.name}</strong><p>{event.after.state === "RETRACTED" ? "Earlier value withdrawn; current value unknown" : event.after.kind === "TARGET_LIVE" ? `${event.before?.value.date ?? "Not recorded"} → ${event.after.value.date}` : event.after.value.date ?? event.after.value.text ?? "Owner assignment recorded"}</p><span>{safeUserLabel(event.after)} · {new Date(event.occurredAt).toLocaleDateString("en-GB")}</span></Link></li>)}
          {changes.map(entry => <li key={entry.id}><Link href={`/initiatives/${byId.get(entry.initiativeId)!.slug}`}><strong data-activity-summary data-activity-legacy={!isStructuredActivity(entry) || undefined}>{activitySummary(entry)}</strong><span>{byId.get(entry.initiativeId)!.name} · <time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleDateString("en-GB")}</time></span></Link></li>)}</ul> : <p className={styles.empty}>No recent changes recorded.</p>}
        </section>
      </div>
      <aside className={styles.contextRail}>
        <section aria-labelledby="coming-up"><div className={styles.sectionHead}><h2 id="coming-up">Coming up</h2><Link href="/roadmap">Roadmap →</Link></div>
          {upcoming.length ? <ul className={styles.schedule}>{upcoming.slice(0, 6).map(({ initiative, fact, date }) => <li key={fact.id}><time dateTime={date}>{displayDate(date)}</time><Link href={`/initiatives/${initiative.slug}/delivery`}><strong>{initiative.name}</strong><span>{fact.kind === "TARGET_LIVE" ? "Target Live" : fact.value.text ?? "Next milestone"}</span><small>{BUSINESS_LINE_LABEL[initiative.businessLine]}</small></Link></li>)}</ul> : <p className={styles.empty}>No upcoming dated milestones are recorded.</p>}
          <p className={styles.railNote}>{unscheduled} {unscheduled === 1 ? "initiative has" : "initiatives have"} no recorded Target Live.</p>
        </section>
        <section className={styles.weekly}><p className={styles.eyebrow}>Weekly Product Review</p><h2>Bring the portfolio into one conversation.</h2><p>Compare with the last finalized review. Let Claude draft from the record, then review together.</p><Link href="/weekly-review">Open shared review →</Link></section>
        <nav className={styles.shortcuts} aria-label="Portfolio shortcuts"><Link href="/initiatives">Browse initiative register <span>→</span></Link><Link href="/analysis">Explore portfolio analysis <span>→</span></Link></nav>
      </aside>
    </div>
    <p className={styles.support}>Timing comes from human-confirmed delivery facts. Knowledge checks compare recorded values; they do not assess release readiness or business impact.</p>
  </div>;
}
