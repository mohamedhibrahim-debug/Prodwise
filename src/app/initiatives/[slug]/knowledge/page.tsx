import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRepository } from "@/lib/data";
import { isDemoWriteEnabled } from "@/lib/env";
import { EvidenceAnchorForm } from "@/components/initiative/EvidenceAnchorForm";
import { normalise } from "@/lib/review/normalise";
import { deriveInstrumentSnapshot } from "@/lib/workspace/instrument";
import { attentionSentence } from "@/lib/workspace/copy";
import { CLAIM_STATUS_LABEL, CLAIM_TYPE_LABEL, DOMAIN_LABEL, EVIDENCE_SOURCE_TYPE_LABEL, EVIDENCE_RELATION_LABEL, formatDate } from "@/lib/domain/labels";
import { trustLine } from "@/lib/domain/trust";
import { decisionMarkers, groupKnowledge, replacementLineage, type KnowledgeValueGroup } from "@/lib/workspace/knowledge";
import styles from "./knowledge.module.css";

export const metadata: Metadata = { title: "Knowledge" };
export const dynamic = "force-dynamic";
type View = "confirmed" | "all" | "replaced";

export default async function KnowledgePage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { slug } = await params;
  const { view: rawView } = await searchParams;
  const view: View = rawView === "all" || rawView === "replaced" ? rawView : "confirmed";
  const repo = getRepository();
  const initiative = await repo.getInitiativeBySlug(slug);
  if (!initiative) notFound();
  const snapshot = await repo.getInitiativeSnapshot(initiative.id);
  if (!snapshot) notFound();
  const { claims, findingStates: states } = snapshot;
  const mismatches = deriveInstrumentSnapshot(snapshot).findings.filter(finding => finding.type === "CONFLICT" && finding.status === "OPEN" && finding.actionable);
  const mismatchItems = new Map(mismatches
    .map((finding) => [JSON.stringify([normalise(finding.subject), normalise(finding.claims[0]?.attribute ?? ""), finding.phase]), finding.fingerprint]));
  const visible = claims.filter((claim) => view === "all" ? claim.status !== "SUPERSEDED" : view === "replaced" ? claim.status === "SUPERSEDED" : claim.status === "ACTIVE");
  const subjects = new Map<string, Map<string, Map<string, KnowledgeValueGroup[]>>>();
  for (const group of groupKnowledge(visible)) {
    const attributes = subjects.get(group.subject) ?? new Map();
    subjects.set(group.subject, attributes);
    const phases = attributes.get(group.attribute) ?? new Map();
    attributes.set(group.attribute, phases);
    const phaseKey = group.phase ?? "";
    phases.set(phaseKey, [...(phases.get(phaseKey) ?? []), group]);
  }
  const base = `/initiatives/${slug}/knowledge`;
  return <div className={styles.page}>
    <div className={styles.head}><div><h2>Knowledge record</h2><p>Values, sources and history. Confirmation does not select a winner when values differ.</p></div>
      {isDemoWriteEnabled ? <Link className={styles.action} href={`${base}/new`}>Add Knowledge entry</Link> : null}</div>
    <nav className={styles.views} aria-label="Knowledge views">
      <Link href={base} aria-current={view === "confirmed" ? "page" : undefined}>Record</Link>
      <Link href={`${base}/sources`}>Sources</Link>
    </nav>
    <nav className={styles.filters} aria-label="Record filters">
      <Link href={base} aria-current={view === "confirmed" ? "page" : undefined}>Confirmed ({claims.filter(c => c.status === "ACTIVE").length} entries)</Link>
      <Link href={`${base}?view=all`} aria-current={view === "all" ? "page" : undefined}>All current ({claims.filter(c => c.status !== "SUPERSEDED").length} entries)</Link>
      <Link href={`${base}?view=replaced`} aria-current={view === "replaced" ? "page" : undefined}>Replaced ({claims.filter(c => c.status === "SUPERSEDED").length} entries)</Link>
    </nav>
    {mismatchItems.size && view !== "replaced" ? <div className={styles.attentionBanner}>
      <strong>{mismatches.length === 1 ? attentionSentence(mismatches[0]!) : `Recorded values differ in ${mismatches.length} comparisons.`}</strong>
      <Link href={`/initiatives/${slug}/decisions${mismatchItems.size === 1 ? `?item=${encodeURIComponent([...mismatchItems.values()][0]!)}` : ""}`}>Review in Decisions →</Link>
    </div> : null}
    <div className={styles.recordLayout}><div>
    {subjects.size ? <div className={styles.ledgerHead} aria-hidden="true"><span>Attribute · Phase</span><span>Value</span><span>Status · Verification</span><span>Sources</span></div> : null}
    {subjects.size ? [...subjects].map(([subject, attributes]) => <section className={styles.subject} key={subject}>
      <h2>{subject}</h2>{[...attributes].map(([attribute, phases]) => <div className={styles.attribute} key={attribute}>
        {[...phases].map(([phaseKey, values]) => <div className={styles.phase} key={phaseKey}>
          {values.map(({ value, entries }) => {
            const first = entries[0]!;
            const allSameStatus = entries.every((entry) => entry.status === first.status);
            const sources = [...new Map(entries.flatMap(entry => entry.evidence).map(source => [source.id, source])).values()];
            return <div className={`${styles.value} ${first.status === "SUPERSEDED" ? styles.historical : ""}`} key={normalise(value)} id={`claim-${first.id}`}>
              <div className={styles.address}><h3>{attribute}</h3><span>{phaseKey || "Phase not recorded"}</span></div>
              <div className={styles.currentValue}><strong>{value}</strong>
                {entries.map(entry => { const lineage = replacementLineage(entry, claims); return <div key={entry.id} className={styles.inlineLineage}>
                  {lineage.replacedBy ? <p>Replaced by <Link href={`${base}?view=${lineage.replacedBy.status === "SUPERSEDED" ? "replaced" : "all"}#claim-${lineage.replacedBy.id}`}>{lineage.replacedBy.value}</Link></p> : entry.status === "SUPERSEDED" ? <p>{entry.supersededByClaimId ? "Recorded replacement unavailable" : "Replacement not recorded"}</p> : null}
                  {lineage.replaces.map(prior => <p key={prior.id}>Replaces <Link href={`${base}?view=replaced#claim-${prior.id}`}>{prior.value}</Link></p>)}
                </div>; })}
              </div>
              <div className={styles.rowStatus}><span>{allSameStatus ? CLAIM_STATUS_LABEL[first.status] : "Entry statuses in details"}</span>
                {entries.map(entry => trustLine(entry) ? <p key={entry.id}>{trustLine(entry)}</p> : null)}</div>
              <div className={styles.sourceIdentity}><span>{sources.length} linked {sources.length === 1 ? "source" : "sources"}</span>
                {sources.map(source => <Link key={source.id} href={`${base}/sources#source-${source.id}`}>{source.sourceReference ?? source.title}{source.boundary === "EXCLUDED" ? " · Excluded" : ""}</Link>)}</div>
              <details><summary>Sources and details</summary>
                <ul>{entries.map((entry) => {
                  const trust = trustLine(entry);
                  return <li className={styles.entry} key={entry.id} id={entry.id === first.id ? undefined : `claim-${entry.id}`}>
                    <p><strong>Knowledge entry</strong> · {CLAIM_STATUS_LABEL[entry.status]}</p>
                    <p>Type: {CLAIM_TYPE_LABEL[entry.type]} · Phase: {entry.phase ?? "Not recorded"} · Domain: {DOMAIN_LABEL[entry.domain]}</p>
                    {trust ? <p>{trust}</p> : null}
                    {entry.verifiedAt ? <p>Basis: {entry.verificationBasis === "DIRECT_KNOWLEDGE" ? "Direct knowledge" : "Linked Source"}{entry.verificationNote ? ` · ${entry.verificationNote}` : ""}</p> : null}
                    {decisionMarkers(entry, states).map((marker) => <p key={marker.fingerprint}>
                      {marker.fingerprint ? <Link href={`/initiatives/${slug}/decisions?item=${encodeURIComponent(marker.fingerprint)}`}>
                        {marker.label} · {marker.resolvedAt ? formatDate(marker.resolvedAt) : "Date not recorded"}
                      </Link> : <>{marker.label} · {marker.resolvedAt ? formatDate(marker.resolvedAt) : "Date not recorded"}</>}
                    </p>)}
                    {entry.evidence.length ? entry.evidence.map((source) => {
                      const anchor = entry.anchors.find((item) => item.evidenceId === source.id);
                      return <div key={source.id} className={styles.provenance}>
                        <Link href={`${base}/sources#source-${source.id}`}>{source.title}</Link>
                        <p className={styles.sourceMeta}>{source.sourceReference ?? "Reference not recorded"} · {EVIDENCE_SOURCE_TYPE_LABEL[source.sourceType]} · {EVIDENCE_RELATION_LABEL[source.boundary]} · {source.occurredAt ? formatDate(source.occurredAt) : "Source date not recorded"}</p>
                        {source.contentSummary ? <p><b>Summary:</b> {source.contentSummary}</p> : null}
                        {anchor?.locator ? <p><b>Locator:</b> {anchor.locator}</p> : null}
                        {anchor?.excerpt ? <p><b>Supporting excerpt:</b> “{anchor.excerpt}”</p> : null}
                        {isDemoWriteEnabled ? <details><summary>Edit locator or excerpt</summary><EvidenceAnchorForm slug={slug} claimId={entry.id} evidenceId={source.id}
                          locator={anchor?.locator ?? null} excerpt={anchor?.excerpt ?? null} /></details> : null}
                      </div>;
                    }) : <p>No source linked.</p>}
                    {isDemoWriteEnabled ? <p><Link href={`${base}/${entry.id}/edit`}>Edit Knowledge entry</Link>{entry.status !== "ACTIVE" ? <> · <Link href={`${base}/${entry.id}/confirm`}>Confirm Knowledge</Link></> : null}</p> : null}
                  </li>;
                })}</ul>
              </details>
            </div>;
          })}
          {values.length > 1 && view !== "replaced" && mismatchItems.has(JSON.stringify([normalise(subject), normalise(attribute), phaseKey || null])) ?
            <Link className={styles.mismatch} href={`/initiatives/${slug}/decisions?item=${encodeURIComponent(mismatchItems.get(JSON.stringify([normalise(subject), normalise(attribute), phaseKey || null]))!)}`}>Values differ → Decisions</Link> : null}
        </div>)}</div>)}</section>) : <p className={styles.empty}>{view === "confirmed" ? "No Confirmed Knowledge entries yet." : "No Knowledge entries in this view."}</p>}
    </div><aside className={styles.recordContext} aria-label="Record context">
      <h2>Recorded Knowledge</h2>
      <dl><div><dt>Confirmed entries</dt><dd>{claims.filter(entry => entry.status === "ACTIVE").length}</dd></div>
        <div><dt>Other current entries</dt><dd>{claims.filter(entry => entry.status !== "ACTIVE" && entry.status !== "SUPERSEDED").length}</dd></div>
        <div><dt>Replaced entries</dt><dd>{claims.filter(entry => entry.status === "SUPERSEDED").length}</dd></div>
      </dl>
      <p>Confirmed records retain their original provenance. Confirmation does not guarantee that a statement is correct.</p>
      <p>Open Sources and details to inspect each entry’s verification history, phase, domain and replacement lineage.</p>
      <Link href={`${base}/sources`}>Browse Sources →</Link>
    </aside></div>
  </div>;
}
