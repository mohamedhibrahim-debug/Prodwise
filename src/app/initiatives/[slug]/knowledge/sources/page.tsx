import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRepository } from "@/lib/data";
import { EVIDENCE_RELATIONS } from "@/lib/domain/types";
import { EVIDENCE_RELATION_LABEL, EVIDENCE_SOURCE_TYPE_LABEL, formatDate, displaySourceReference } from "@/lib/domain/labels";
import { businessWritePresentation } from "@/lib/auth/presentation";
import { TabToolbar } from "@/components/workspace/TabToolbar";
import styles from "../knowledge.module.css";
import { connectorOverview, readSyncs } from "@/lib/connectors/service";
import { ImportFromStrip } from "@/components/connectors/ImportFromStrip";
import { ConnectedSourceList } from "@/components/connectors/ConnectedSourceList";
import { readAutoSync } from '@/lib/connectors/auto-sync';

export const metadata: Metadata = { title: "Sources" };
export const dynamic = "force-dynamic";
export default async function KnowledgeSourcesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { enabled: writesEnabled } = await businessWritePresentation();
  const { slug } = await params;
  const repo = getRepository();
  const initiative = await repo.getInitiativeBySlug(slug);
  if (!initiative) notFound();
  const snapshot = await repo.getInitiativeSnapshot(initiative.id);
  if (!snapshot) notFound();
  const { evidence, claims } = snapshot;
  const [syncs, { overview, isDemo }, autoSync] = await Promise.all([readSyncs(initiative.id), connectorOverview(), readAutoSync(initiative.id)]);
  const base = `/initiatives/${slug}/knowledge`;
  // Same title on the same day is flagged, never merged: people decide whether it is a duplicate.
  const sameKey = (e: (typeof evidence)[number]) => `${e.title.trim().toLowerCase()}|${e.occurredAt?.slice(0, 10) ?? ''}`;
  const keyCount = new Map<string, number>(); for (const e of evidence) keyCount.set(sameKey(e), (keyCount.get(sameKey(e)) ?? 0) + 1);
  // The persistent initiative header already carries the one primary action (Add evidence); this tab never repeats it (E-1).
  return <div className={styles.page}>
    <TabToolbar title="Sources" summary={<><strong>{evidence.length}</strong> recorded {evidence.length === 1 ? "source" : "sources"} · grouped by relationship to the initiative</>}
      actions={<Link prefetch={false} className="pw-btn" data-variant="secondary" data-size="md" href={`/initiatives/${slug}/evidence`}>Saved notes and pasted text</Link>} />

    <ImportFromStrip slug={slug} overview={overview} isDemo={isDemo} canWrite={writesEnabled && !initiative.archivedAt} />
    <ConnectedSourceList slug={slug} syncs={syncs} autoSync={autoSync} canWrite={writesEnabled && !initiative.archivedAt && !isDemo} />

    {evidence.length ? <div className={styles.sourceTableWrap}><table className={styles.sourceTable}><caption className="visually-hidden">Sources grouped by relationship to this initiative</caption><thead><tr><th scope="col">Source</th><th scope="col">Reference</th><th scope="col">Type</th><th scope="col">Source date</th><th scope="col">Linked entries</th></tr></thead>{EVIDENCE_RELATIONS.map(boundary => {
      const items = evidence.filter(source => source.boundary === boundary);
      if (!items.length) return null;
      return <tbody key={boundary}><tr className={styles.boundaryBand}><th colSpan={5} scope="rowgroup">{EVIDENCE_RELATION_LABEL[boundary]} <span>{items.length}</span></th></tr>{items.map(source => {
        const linked = claims.filter(entry => entry.evidence.some(link => link.id === source.id));
        return <tr key={source.id} id={`source-${source.id}`}><td data-label="Source"><strong className={styles.sourceTitle}>{source.title}</strong>{(keyCount.get(sameKey(source)) ?? 0) > 1 && <p className={styles.possibleDuplicate}>⚠ Possible duplicate — another source has the same title and date.</p>}<details className={styles.sourceDisclosure}><summary aria-label={`Details for ${source.title}`}>Details</summary>
          {source.contentSummary ? <p>{source.contentSummary}</p> : <p>No source summary recorded.</p>}
          {source.sourceUrl && <p><a href={source.sourceUrl} target="_blank" rel="noreferrer">Open original source ↗</a></p>}
          {writesEnabled && <p><Link prefetch={false} href={`${base}/sources/${source.id}/edit`}>Edit source</Link></p>}
          <h3>Linked Knowledge</h3>{linked.length ? <ul>{linked.map(entry => <li key={entry.id}><Link prefetch={false} href={`${base}?view=${entry.status === "SUPERSEDED" ? "replaced" : "all"}#claim-${entry.id}`}>{entry.subject} · {entry.attribute}: {entry.value}</Link></li>)}</ul> : <p>No Knowledge entries linked.</p>}
        </details></td><td data-label="Reference"><span className={styles.reference}>{displaySourceReference(source.sourceReference) ?? "Not recorded"}</span></td><td data-label="Type">{EVIDENCE_SOURCE_TYPE_LABEL[source.sourceType]}</td><td data-label="Source date">{source.occurredAt ? formatDate(source.occurredAt) : <span className={styles.unknown}>Not recorded</span>}</td><td data-label="Linked entries"><span className={styles.linkCount}>{linked.length}</span></td></tr>;
      })}</tbody>;
    })}</table></div> : <p className={styles.empty}>No sources recorded yet. Add source material to begin building the initiative record.</p>}
    <p className={styles.libraryNote}>Source relationships are recorded by people. Excluded material remains visible for history and is not treated as current support.</p>
  </div>;
}
