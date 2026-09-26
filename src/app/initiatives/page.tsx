import type { Metadata } from "next";
import Link from "next/link";
import { DemoWriteLink } from "@/components/primitives/DemoWriteLink";
import { EmptyState } from "@/components/primitives/EmptyState";
import { BUSINESS_LINE_LABEL, STAGE_LABEL } from "@/lib/domain/labels";
import { getRepository } from "@/lib/data";
import { deriveInstrumentSnapshot } from "@/lib/workspace/instrument";
import { activitySummary } from "@/lib/workspace/copy";
import { readDelivery } from "@/lib/delivery/repository";
import { factFor } from "@/lib/delivery/model";
import styles from "./initiatives.module.css";

export const metadata: Metadata = { title: "Initiatives" };
export const dynamic = "force-dynamic";
export default async function InitiativesPage({ searchParams }: { searchParams: Promise<{ q?: string; line?: string; stage?: string; attention?: string; sort?: string }> }) {
  const rawFilters = await searchParams;
  const filters = Object.fromEntries(Object.entries(rawFilters).filter(([, value]) => typeof value === "string")) as Record<string, string>;
  const [delivery, activity] = await Promise.all([readDelivery(), getRepository().listRecentActivity(100)]);
  const snapshots = delivery.source.snapshots.map(deriveInstrumentSnapshot);
  const facts = delivery.state.facts.filter(f => f.workspaceId === delivery.ctx.workspaceId);
  const rows = snapshots.map(snapshot => {
    const { initiative } = snapshot;
    const conflicts = snapshot.findings.filter(f => f.status === "OPEN" && f.actionable).length;
    const blocker = factFor(facts, initiative.id, "BLOCKER");
    const target = factFor(facts, initiative.id, "TARGET_LIVE");
    const change = activity.filter(entry => entry.initiativeId === initiative.id).sort((a,b) => b.occurredAt.localeCompare(a.occurredAt))[0];
    const event = delivery.state.events.filter(entry => entry.workspaceId === delivery.ctx.workspaceId && entry.initiativeId === initiative.id).sort((a,b) => b.occurredAt.localeCompare(a.occurredAt))[0];
    const deliveryLatest = event && (!change || event.occurredAt > change.occurredAt);
    const latest = deliveryLatest ? `${event.after.kind.replaceAll("_", " ").toLowerCase()} ${event.after.state === "RETRACTED" ? "withdrawn" : "confirmed"}` : change ? activitySummary(change) : null;
    const updated = deliveryLatest ? event.occurredAt : change?.occurredAt;
    return { snapshot, initiative, conflicts, blocker, target, latest, updated };
  }).filter(row => (!filters.line || row.initiative.businessLine === filters.line) && (!filters.stage || row.initiative.stage === filters.stage) && (filters.attention !== "needs-attention" || row.conflicts > 0 || row.blocker) && (!filters.q || `${row.initiative.name} ${row.initiative.slug}`.toLowerCase().includes(filters.q.trim().toLowerCase())))
    .sort((a,b) => filters.sort === "target" ? (a.target?.value.date ?? "9999").localeCompare(b.target?.value.date ?? "9999") : filters.sort === "updated" ? (b.updated ?? "").localeCompare(a.updated ?? "") : a.initiative.name.localeCompare(b.initiative.name));
  return <div className={styles.page}>
    <header className={styles.head}><div><p className={styles.eyebrow}>Portfolio register</p><h1 className={styles.title}>Initiatives</h1><p className={styles.subtitle}>Current stage, attention and committed delivery timing in one view.</p></div><DemoWriteLink href="/initiatives/new" variant="primary">Create initiative</DemoWriteLink></header>
    <form className={styles.filters} aria-label="Filter initiatives"><label className={styles.search}>Search<input name="q" defaultValue={filters.q ?? ""} placeholder="Find an initiative" type="search" /></label><label>Business line<select name="line" defaultValue={filters.line ?? ""}><option value="">All lines</option>{[...new Set(snapshots.map(row => row.initiative.businessLine))].map(line => <option key={line} value={line}>{BUSINESS_LINE_LABEL[line]}</option>)}</select></label><label>Lifecycle stage<select name="stage" defaultValue={filters.stage ?? ""}><option value="">All stages</option>{[...new Set(snapshots.map(row => row.initiative.stage))].map(stage => <option key={stage} value={stage}>{STAGE_LABEL[stage]}</option>)}</select></label><label>Attention<select name="attention" defaultValue={filters.attention ?? ""}><option value="">All initiatives</option><option value="needs-attention">Decisions / blockers</option></select></label><label>Sort by<select name="sort" defaultValue={filters.sort ?? "name"}><option value="name">Name</option><option value="target">Target Live</option><option value="updated">Latest change</option></select></label><button type="submit">Apply</button>{Object.values(filters).some(Boolean) && <Link href="/initiatives">Reset</Link>}</form>
    <div className={styles.registerSummary}><strong>{rows.length} of {snapshots.length} initiatives</strong><span>Target Live comes from the delivery record</span></div>
    {rows.length === 0 ? <EmptyState message="No initiatives match this view." hint="Change the filters or create an initiative to begin." /> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Initiative</th><th>Business line</th><th>Lifecycle stage</th><th>Attention</th><th>Target Live</th><th>Latest change</th></tr></thead><tbody>{rows.map(({ initiative, conflicts, blocker, target, latest, updated, snapshot }) => <tr key={initiative.id}>
      <td data-label="Initiative"><Link className={styles.name} href={`/initiatives/${initiative.slug}`}>{initiative.name}<span aria-hidden="true"> ↗</span></Link>{initiative.isDemo && <small>Synthetic scenario</small>}</td>
      <td data-label="Business line">{BUSINESS_LINE_LABEL[initiative.businessLine]}</td><td data-label="Lifecycle stage"><span className={styles.stage}>{STAGE_LABEL[initiative.stage]}</span></td>
      <td data-label="Attention">{conflicts ? <Link className={styles.attention} href={`/initiatives/${initiative.slug}/decisions`}>{conflicts} {conflicts === 1 ? "decision" : "decisions"}</Link> : null}{blocker ? <Link className={styles.attention} href={`/initiatives/${initiative.slug}/delivery`}>Recorded blocker</Link> : null}{!conflicts && !blocker ? <span className={styles.quiet}>{snapshot.claims.length ? "No open mismatches" : "Knowledge not recorded"}</span> : null}</td>
      <td data-label="Target Live"><Link className={target ? styles.date : styles.unknown} href={`/initiatives/${initiative.slug}/delivery`}>{target?.value.date ?? "Unknown"}</Link>{target && <small>Human-confirmed</small>}</td>
      <td data-label="Latest change"><span className={styles.latest}>{latest ?? "No change recorded"}</span>{updated && <small>{new Date(updated).toLocaleDateString("en-GB")}</small>}</td>
    </tr>)}</tbody></table></div>}
    <p className={styles.note}>Recorded stage and delivery dates do not establish release readiness. Missing dates remain unknown.</p>
  </div>;
}
