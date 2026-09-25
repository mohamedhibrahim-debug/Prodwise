import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRepository } from "@/lib/data";
import { isDemoWriteEnabled } from "@/lib/env";
import { normalise } from "@/lib/review/normalise";
import type { MemoryClaim } from "@/lib/domain/types";
import styles from "./knowledge.module.css";

export const metadata: Metadata = { title: "Knowledge" };
export const dynamic = "force-dynamic";

type View = "confirmed" | "all" | "replaced";
function group(claims: MemoryClaim[]) {
  const subjects = new Map<string, Map<string, Map<string, MemoryClaim[]>>>();
  for (const claim of claims) {
    const attributes = subjects.get(claim.subject) ?? new Map();
    subjects.set(claim.subject, attributes);
    const values = attributes.get(claim.attribute) ?? new Map();
    attributes.set(claim.attribute, values);
    const key = normalise(claim.value);
    values.set(key, [...(values.get(key) ?? []), claim]);
  }
  return subjects;
}

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
  const claims = await repo.listClaims(initiative.id);
  const visible = claims.filter((claim) => view === "all" ? claim.status !== "SUPERSEDED" : view === "replaced" ? claim.status === "SUPERSEDED" : claim.status === "ACTIVE");
  const grouped = group(visible);
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
    {grouped.size ? [...grouped].map(([subject, attributes]) => <section className={styles.subject} key={subject}>
      <h2>{subject}</h2>{[...attributes].map(([attribute, values]) => <div className={styles.attribute} key={attribute}>
        <h3>{attribute}</h3>{[...values].map(([key, entries]) => {
          const first = entries[0]!;
          const sources = [...new Map(entries.flatMap((entry) => entry.evidence).map((source) => [source.id, source])).values()];
          return <div className={styles.value} key={key} id={`claim-${first.id}`}>
            <strong>{first.value}</strong><span>{entries.every((entry) => entry.status === "ACTIVE") ? "Confirmed" : entries.every((entry) => entry.status === "SUPERSEDED") ? "Replaced" : "Not confirmed"}</span>
            <details><summary>Sources and details</summary>
              {sources.length ? <ul>{sources.map((source) => <li key={source.id}><Link href={`${base}/sources#source-${source.id}`}>{source.title}</Link></li>)}</ul> : <p>No source linked.</p>}
              <ul>{entries.map((entry) => <li key={entry.id} id={entry.id === first.id ? undefined : `claim-${entry.id}`}>
                <Link href={`${base}/${entry.id}/edit`}>Edit Knowledge entry</Link>{entry.status !== "ACTIVE" ? <> · <Link href={`${base}/${entry.id}/confirm`}>Confirm Knowledge</Link></> : null}
              </li>)}</ul>
            </details>
          </div>;
        })}
        {values.size > 1 && view !== "replaced" ? <Link className={styles.mismatch} href={`/initiatives/${slug}/decisions`}>Values differ → Decisions</Link> : null}
      </div>)}</section>) : <p className={styles.empty}>{view === "confirmed" ? "No Confirmed Knowledge entries yet." : "No Knowledge entries in this view."}</p>}
  </div>;
}
