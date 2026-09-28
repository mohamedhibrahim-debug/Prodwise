import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRepository } from "@/lib/data";
import { EVIDENCE_RELATIONS } from "@/lib/domain/types";
import { EVIDENCE_RELATION_LABEL, EVIDENCE_SOURCE_TYPE_LABEL, formatDate, displaySourceReference } from "@/lib/domain/labels";
import { businessWritePresentation } from "@/lib/auth/presentation";
import styles from "../knowledge.module.css";
import cstyles from "@/components/connectors/connectors.module.css";
import { readSyncs } from "@/lib/connectors/service";
import { workspacePresentation } from "@/lib/workspace/context";
import { CONNECTOR_LABEL, CONNECTOR_SLUG } from "@/lib/connectors/types";
import { RefreshButton } from "@/components/connectors/RefreshButton";
import { refreshAction } from "../../sources/import/actions";
import { formatDateTime } from "@/lib/domain/labels";

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
  const [syncs, { isDemo }] = await Promise.all([readSyncs(initiative.id), workspacePresentation()]);
  const SYNC_STATUS = { CURRENT: null, NOT_FOUND: "Not found at last check — deleted, moved or no longer shared", NO_ACCESS: "No access at last check for the person who refreshed", FAILED: "Last check failed; try again" } as const;
  const base = `/initiatives/${slug}/knowledge`;
  // Same title on the same day is flagged, never merged: people decide whether it is a duplicate.
  const sameKey = (e: (typeof evidence)[number]) => `${e.title.trim().toLowerCase()}|${e.occurredAt?.slice(0, 10) ?? ''}`;
  const keyCount = new Map<string, number>(); for (const e of evidence) keyCount.set(sameKey(e), (keyCount.get(sameKey(e)) ?? 0) + 1);
  return <div className={styles.page}>
    <header className={styles.head}><div><p className={styles.eyebrow}>Evidence library</p><h2>Sources</h2><p>Inspect source material and the Knowledge it supports.</p></div><Link prefetch={false} className={styles.quietAction} href={`/initiatives/${slug}/evidence`}>Saved evidence & meeting notes</Link>{writesEnabled && !isDemo && <Link prefetch={false} className={styles.quietAction} href={`/initiatives/${slug}/sources/import`}>Import from Jira, Gmail, Drive or Figma</Link>}{writesEnabled && <Link prefetch={false} className={styles.action} href={`${base}/sources/new`}>Add source</Link>}</header>

    {syncs.length > 0 && <section aria-labelledby="connected-sources"><h3 id="connected-sources">Connected sources <span className={cstyles.muted}>{syncs.length}</span></h3>
      <p className={cstyles.muted}>Imported from connected accounts. Refresh saves a new snapshot only when the content changed; earlier snapshots stay. A change is a signal to review, not a confirmed fact.</p>
      <ul className={cstyles.syncList}>{syncs.map(x => <li key={x.id} className={cstyles.syncRow}><div>
        <p><strong>{x.latestTitle ?? x.itemName}</strong> <span className={cstyles.muted}>· {CONNECTOR_LABEL[x.connector]} · {x.itemReference.includes("#") ? "frame" : x.itemReference}</span></p>
        <p className={cstyles.muted}>Snapshot saved {formatDateTime(x.lastSyncedAt)}{x.lastCheckedAt !== x.lastSyncedAt ? ` · checked ${formatDateTime(x.lastCheckedAt)}` : ""} · {x.snapshots} {x.snapshots === 1 ? "snapshot" : "snapshots"}</p>
        {x.latestTitle && x.latestTitle !== x.itemName && !x.latestTitle.includes(x.itemName) && <p className={cstyles.muted}>First imported as “{x.itemName}”.</p>}{SYNC_STATUS[x.status] && <p className={cstyles.status} data-status={x.status}>⚠ {SYNC_STATUS[x.status]}. The last snapshot is kept.</p>}
        <p><Link prefetch={false} href={`/initiatives/${slug}/evidence/${x.lastSubmissionId}`}>Review latest snapshot →</Link>{x.itemUrl && <> · <a href={x.itemUrl} target="_blank" rel="noreferrer">Open in {CONNECTOR_LABEL[x.connector]} ↗</a></>}</p>
      </div>{writesEnabled && <RefreshButton action={refreshAction} slug={slug} itemId={x.itemId} connector={CONNECTOR_SLUG[x.connector]} label={x.itemName} />}</li>)}</ul></section>}

    <div className={styles.librarySummary}><strong>{evidence.length} recorded sources</strong><span>Grouped by relationship to the initiative</span></div>
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
