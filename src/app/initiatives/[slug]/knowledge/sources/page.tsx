import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRepository } from "@/lib/data";
import { EVIDENCE_RELATIONS } from "@/lib/domain/types";
import { EVIDENCE_RELATION_LABEL } from "@/lib/domain/labels";
import { isDemoWriteEnabled } from "@/lib/env";
import styles from "../knowledge.module.css";

export const metadata: Metadata = { title: "Sources" };
export const dynamic = "force-dynamic";

export default async function KnowledgeSourcesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const repo = getRepository();
  const initiative = await repo.getInitiativeBySlug(slug);
  if (!initiative) notFound();
  const snapshot = await repo.getInitiativeSnapshot(initiative.id);
  if (!snapshot) notFound();
  const { evidence, claims } = snapshot;
  const base = `/initiatives/${slug}/knowledge`;
  return <div className={styles.page}>
    <div className={styles.head}><div><h1>Knowledge</h1><p>Source material grouped by initiative boundary.</p></div>
      {isDemoWriteEnabled ? <Link className={styles.action} href={`${base}/sources/new`}>Add Source</Link> : null}</div>
    <nav className={styles.views} aria-label="Knowledge views"><Link href={base}>Record</Link><Link href={`${base}/sources`} aria-current="page">Sources</Link></nav>
    {evidence.length ? EVIDENCE_RELATIONS.map((boundary) => {
      const items = evidence.filter((source) => source.boundary === boundary);
      if (!items.length) return null;
      return <section className={styles.subject} key={boundary}><h2>{EVIDENCE_RELATION_LABEL[boundary]}</h2>
        {items.map((source) => <div className={styles.attribute} key={source.id} id={`source-${source.id}`}>
          <details><summary>{source.title}</summary>
            {source.contentSummary ? <p>{source.contentSummary}</p> : null}
            {source.sourceReference ? <p>{source.sourceReference}</p> : null}
            {source.sourceUrl ? <p><a href={source.sourceUrl}>Open source</a></p> : null}
            <p><Link href={`${base}/sources/${source.id}/edit`}>Edit Source</Link></p>
            <h3>Linked Knowledge entries</h3>
            {claims.some((entry) => entry.evidence.some((linked) => linked.id === source.id)) ? <ul>
              {claims.filter((entry) => entry.evidence.some((linked) => linked.id === source.id)).map((entry) =>
                <li key={entry.id}><Link href={`${base}?view=all#claim-${entry.id}`}>{entry.subject} · {entry.attribute}: {entry.value}</Link></li>)}
            </ul> : <p>No Knowledge entries linked.</p>}
          </details>
        </div>)}
      </section>;
    }) : <p className={styles.empty}>No sources recorded yet.</p>}
  </div>;
}
