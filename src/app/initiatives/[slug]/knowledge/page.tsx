import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRepository } from "@/lib/data";
import { isDemoWriteEnabled } from "@/lib/env";
import { EvidenceAnchorForm } from "@/components/initiative/EvidenceAnchorForm";
import { normalise } from "@/lib/review/normalise";
import { runReview } from "@/lib/review/engine";
import { CLAIM_STATUS_LABEL, CLAIM_TYPE_LABEL, DOMAIN_LABEL, formatDate } from "@/lib/domain/labels";
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
  const mismatchItems = new Map(runReview(initiative.id, claims)
    .filter((finding) => finding.type === "CONFLICT")
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
    <div className={styles.head}><div><h1>Knowledge</h1><p>Recorded values for this initiative.</p></div>
      {isDemoWriteEnabled ? <Link className={styles.action} href={`${base}/new`}>Add Knowledge entry</Link> : null}</div>
    <nav className={styles.views} aria-label="Knowledge views">
      <Link href={base} aria-current={view === "confirmed" ? "page" : undefined}>Record</Link>
      <Link href={`${base}/sources`}>Sources</Link>
    </nav>
    <nav className={styles.filters} aria-label="Record filters">
      <Link href={base} aria-current={view === "confirmed" ? "page" : undefined}>Confirmed</Link>
      <Link href={`${base}?view=all`} aria-current={view === "all" ? "page" : undefined}>All entries</Link>
      <Link href={`${base}?view=replaced`} aria-current={view === "replaced" ? "page" : undefined}>Replaced</Link>
    </nav>
    <div className={styles.recordLayout}><div>
    {subjects.size ? [...subjects].map(([subject, attributes]) => <section className={styles.subject} key={subject}>
      <h2>{subject}</h2>{[...attributes].map(([attribute, phases]) => <div className={styles.attribute} key={attribute}>
        <h3>{attribute}</h3>{[...phases].map(([phaseKey, values]) => <div className={styles.phase} key={phaseKey}>
          <h4>{phaseKey || "Phase not recorded"}</h4>
          {values.map(({ value, entries }) => {
            const first = entries[0]!;
            const allSameStatus = entries.every((entry) => entry.status === first.status);
            return <div className={styles.value} key={normalise(value)} id={`claim-${first.id}`}>
              <strong>{value}</strong><span>{allSameStatus ? CLAIM_STATUS_LABEL[first.status] : "Entry statuses in details"}</span>
              <details><summary>Sources and details</summary>
                <ul>{entries.map((entry) => {
                  const lineage = replacementLineage(entry, claims);
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
                    {lineage.replacedBy ? <p>Replaced by <Link href={`${base}?view=all#claim-${lineage.replacedBy.id}`}>{lineage.replacedBy.value}</Link></p> : null}
                    {lineage.replaces.map((prior) => <p key={prior.id}>Replaces <Link href={`${base}?view=replaced#claim-${prior.id}`}>{prior.value}</Link></p>)}
                    {entry.evidence.length ? entry.evidence.map((source) => {
                      const anchor = entry.anchors.find((item) => item.evidenceId === source.id);
                      return <div key={source.id} className={styles.provenance}>
                        <Link href={`${base}/sources#source-${source.id}`}>{source.title}</Link>
                        {anchor?.locator ? <p>Locator: {anchor.locator}</p> : null}
                        {anchor?.excerpt ? <p>“{anchor.excerpt}”</p> : null}
                        {isDemoWriteEnabled ? <EvidenceAnchorForm slug={slug} claimId={entry.id} evidenceId={source.id}
                          locator={anchor?.locator ?? null} excerpt={anchor?.excerpt ?? null} /> : null}
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
