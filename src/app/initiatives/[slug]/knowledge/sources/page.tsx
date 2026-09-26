import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRepository } from "@/lib/data";
import { EVIDENCE_RELATIONS } from "@/lib/domain/types";
import { EVIDENCE_RELATION_LABEL, EVIDENCE_SOURCE_TYPE_LABEL, formatDate } from "@/lib/domain/labels";
import { businessWritePresentation } from "@/lib/auth/presentation";
import styles from "../knowledge.module.css";

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
  const base = `/initiatives/${slug}/knowledge`;
  return <div className={styles.page}>
    <header className={styles.head}><div><p className={styles.eyebrow}>Evidence library</p><h2>Sources</h2><p>Inspect source material and the Knowledge it supports.</p></div>{writesEnabled && <Link className={styles.action} href={`${base}/sources/new`}>Add source</Link>}</header>
    <nav className={styles.views} aria-label="Knowledge views"><Link href={base}>Record</Link><Link href={`${base}/sources`} aria-current="page">Sources</Link></nav>
    <div className={styles.librarySummary}><strong>{evidence.length} recorded sources</strong><span>Grouped by relationship to the initiative</span></div>
    {evidence.length ? <div className={styles.sourceTableWrap}><table className={styles.sourceTable}><thead><tr><th>Source</th><th>Reference</th><th>Type</th><th>Source date</th><th>Linked entries</th></tr></thead>{EVIDENCE_RELATIONS.map(boundary => {
      const items = evidence.filter(source => source.boundary === boundary);
      if (!items.length) return null;
      return <tbody key={boundary}><tr className={styles.boundaryBand}><th colSpan={5} scope="rowgroup">{EVIDENCE_RELATION_LABEL[boundary]} <span>{items.length}</span></th></tr>{items.map(source => {
        const linked = claims.filter(entry => entry.evidence.some(link => link.id === source.id));
        return <tr key={source.id} id={`source-${source.id}`}><td data-label="Source"><strong className={styles.sourceTitle}>{source.title}</strong><details className={styles.sourceDisclosure}><summary>View source details</summary>
          {source.contentSummary ? <p>{source.contentSummary}</p> : <p>No source summary recorded.</p>}
          {source.sourceUrl && <p><a href={source.sourceUrl} target="_blank" rel="noreferrer">Open original source ↗</a></p>}
          {writesEnabled && <p><Link href={`${base}/sources/${source.id}/edit`}>Edit source</Link></p>}
          <h3>Linked Knowledge</h3>{linked.length ? <ul>{linked.map(entry => <li key={entry.id}><Link href={`${base}?view=${entry.status === "SUPERSEDED" ? "replaced" : "all"}#claim-${entry.id}`}>{entry.subject} · {entry.attribute}: {entry.value}</Link></li>)}</ul> : <p>No Knowledge entries linked.</p>}
        </details></td><td data-label="Reference"><span className={styles.reference}>{source.sourceReference ?? "Not recorded"}</span></td><td data-label="Type">{EVIDENCE_SOURCE_TYPE_LABEL[source.sourceType]}</td><td data-label="Source date">{source.occurredAt ? formatDate(source.occurredAt) : <span className={styles.unknown}>Not recorded</span>}</td><td data-label="Linked entries"><span className={styles.linkCount}>{linked.length}</span></td></tr>;
      })}</tbody>;
    })}</table></div> : <p className={styles.empty}>No sources recorded yet. Add source material to begin building the initiative record.</p>}
    <p className={styles.libraryNote}>Source relationships are recorded by people. Excluded material remains visible for history and is not treated as current support.</p>
  </div>;
}
