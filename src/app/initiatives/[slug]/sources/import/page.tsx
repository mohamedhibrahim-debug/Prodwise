import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepository } from "@/lib/data";
import { businessWritePresentation } from "@/lib/auth/presentation";
import { connectorOverview, figmaOutline, jiraProjects, readSyncs, searchConnector } from "@/lib/connectors/service";
import { ConnectorError, CONNECTOR_LABEL, CONNECTOR_SLUG, CONNECTORS, connectorFromSlug, connectorMessage, type Connector } from "@/lib/connectors/types";
import { formatDate } from "@/lib/domain/labels";
import { ConnectorButton } from "@/components/connectors/ConnectorButton";
import { ImportForm, type ImportRow } from "@/components/connectors/ImportForm";
import { connectAction } from "@/app/account/connections/actions";
import { importAction } from "./actions";
import styles from "@/components/connectors/connectors.module.css";

export const metadata = { title: "Import sources" };
export const dynamic = "force-dynamic";

const DEFAULT_ROLE: Record<Connector, "DELIVERY" | "DECISIONS" | "REQUIREMENTS"> = { JIRA: "DELIVERY", GMAIL: "DECISIONS", GOOGLE_DRIVE: "REQUIREMENTS", FIGMA: "REQUIREMENTS" };
const PROMPT: Record<Connector, { label: string; placeholder: string; hint: string }> = {
  JIRA: { label: "Search Jira", placeholder: "Work item key or words", hint: "Enter a key such as PAY-12, or words from the summary or description." },
  GMAIL: { label: "Search your mailbox", placeholder: "e.g. subject:pilot from:finance", hint: "A search is required — Prodwise never lists your whole mailbox. Gmail search operators work." },
  GOOGLE_DRIVE: { label: "Search Drive", placeholder: "Document name or words in it", hint: "Only files your Google account can open are listed." },
  FIGMA: { label: "Figma file or frame link", placeholder: "https://www.figma.com/design/…", hint: "Paste a link to a file, or copy a frame’s link to select it directly." },
};

export default async function ImportSources({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string; q?: string; project?: string; site?: string; link?: string }> }) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const initiative = await getRepository().getInitiativeBySlug(slug); if (!initiative) notFound();
  const connector: Connector = connectorFromSlug(q.from ?? "") ?? "JIRA";
  const [{ overview, isDemo }, write, syncs] = await Promise.all([connectorOverview(), businessWritePresentation(), readSyncs(initiative.id)]);
  const o = overview.find(x => x.connector === connector)!, label = CONNECTOR_LABEL[connector], base = `/initiatives/${slug}/sources/import`;
  const imported = new Set(syncs.map(s => s.itemReference.toLowerCase()));
  const here = `${base}?from=${CONNECTOR_SLUG[connector]}`;

  let rows: ImportRow[] = [], error: string | null = null, projects: { key: string; name: string }[] = [], searched = false, reconnect = false;
  const live = o.ready && o.status === "CONNECTED" && !isDemo && !initiative.archivedAt;
  if (live) {
    try {
      if (connector === "JIRA") projects = await jiraProjects(q.site ?? null);
      if (connector === "FIGMA" && q.link) {
        searched = true;
        const outline = await figmaOutline(q.link);
        rows = outline.pages.flatMap(p => p.frames.map(f => ({ reference: `${outline.fileKey}#${f.id}`, name: f.name, kind: f.type.toLowerCase(), url: `https://www.figma.com/design/${outline.fileKey}/?node-id=${f.id.replace(":", "-")}`, detail: `${outline.name} · ${p.name}`, updated: outline.lastModified ? formatDate(outline.lastModified) : null, imported: imported.has(`${outline.fileKey}#${f.id}`.toLowerCase()), group: `${outline.name} — ${p.name}` })));
        if (outline.selectedNodeId && !rows.some(r => r.reference.endsWith(`#${outline.selectedNodeId}`))) rows.unshift({ reference: `${outline.fileKey}#${outline.selectedNodeId}`, name: "Frame from your link", kind: "frame", url: q.link, detail: outline.name, updated: null, imported: imported.has(`${outline.fileKey}#${outline.selectedNodeId}`.toLowerCase()), group: "From your link" });
      } else if (connector !== "FIGMA" && (q.q ?? "").trim()) {
        searched = true;
        rows = (await searchConnector(connector, { query: q.q!, project: q.project ?? null, site: q.site ?? null })).map(r => ({ ...r, updated: r.updatedAt ? formatDate(r.updatedAt) : null, imported: imported.has(r.reference.toLowerCase()) }));
      }
    } catch (e) {
      error = e instanceof ConnectorError ? connectorMessage(e.code, connector) : `${label} could not be read just now. Nothing was saved.`;
      reconnect = e instanceof ConnectorError && (e.code === "NEEDS_RECONNECT" || e.code === "NOT_CONNECTED");
    }
  }
  const p = PROMPT[connector];
  return <div className={styles.page}>
    <p><Link href={`/initiatives/${slug}/sources`}>← Sources</Link></p>
    <header><h2>Import sources into {initiative.name}</h2><p className={styles.muted}>Choose items from your own account. Each becomes a source with a saved snapshot, ready to review for proposals. Prodwise never changes anything in {label}, and nothing becomes Knowledge until someone confirms it.</p></header>
    <nav className={styles.tabs} aria-label="Source system">{CONNECTORS.map(c => <Link key={c} href={`${base}?from=${CONNECTOR_SLUG[c]}`} aria-current={c === connector ? "page" : undefined}>{CONNECTOR_LABEL[c]}</Link>)}</nav>
    {isDemo ? <p className={styles.notice} role="status">{connectorMessage("DEMO_ORGANIZATION", connector)}</p>
    : initiative.archivedAt ? <p className={styles.notice} role="status">Archived — restore this initiative to import sources.</p>
    : !write.enabled ? <p className={styles.notice} role="status">{write.message} Importing sources changes the initiative’s evidence.</p>
    : !o.ready ? <p className={styles.notice} role="status">{connectorMessage("NOT_CONFIGURED", connector)} <Link href={`/initiatives/${slug}/manage#sources`}>Add a manual reference instead</Link>.</p>
    : o.status !== "CONNECTED" || reconnect ? <div className={styles.notice}><p>{o.status === "NEEDS_RECONNECT" || reconnect ? connectorMessage("NEEDS_RECONNECT", connector) : connectorMessage("NOT_CONNECTED", connector)}</p><ConnectorButton action={connectAction} connector={CONNECTOR_SLUG[connector]} returnTo={here} label={`${o.status === "NEEDS_RECONNECT" || reconnect ? "Reconnect" : "Connect"} ${label}`} pendingLabel="Opening sign-in…" /></div>
    : <>
      <p className={styles.muted}>Connected as {o.accountLabel}. <Link href="/account/connections">Manage</Link></p>
      <form className={styles.search} action={base} role="search">
        <input type="hidden" name="from" value={CONNECTOR_SLUG[connector]} />
        {connector === "JIRA" && o.sites.length > 1 && <label>Jira site<select name="site" defaultValue={q.site ?? o.sites[0]?.id}>{o.sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
        {connector === "JIRA" && <label>Project<select name="project" defaultValue={q.project ?? ""}><option value="">All projects you can see</option>{projects.map(pr => <option key={pr.key} value={pr.key}>{pr.name} ({pr.key})</option>)}</select></label>}
        <label>{p.label}<input name={connector === "FIGMA" ? "link" : "q"} type={connector === "FIGMA" ? "url" : "search"} defaultValue={connector === "FIGMA" ? q.link ?? "" : q.q ?? ""} placeholder={p.placeholder} required minLength={connector === "FIGMA" ? 20 : 2} maxLength={connector === "FIGMA" ? 500 : 200} aria-describedby="import-hint" /></label>
        <button className={styles.secondary}>{connector === "FIGMA" ? "Show frames" : "Search"}</button>
        <p id="import-hint" className={styles.hint}>{p.hint}</p>
      </form>
      {error ? <p role="alert" className={styles.error}>{error}</p>
      : searched && !rows.length ? <p className={styles.muted} role="status">{connector === "FIGMA" ? "No frames were found on this file’s pages." : `No ${label} items match this search in what your account can see.`}</p>
      : rows.length > 0 && <ImportForm action={importAction} rows={rows} slug={slug} connector={CONNECTOR_SLUG[connector]} label={label} defaultRole={DEFAULT_ROLE[connector]} site={q.site ?? null} figma={connector === "FIGMA"} />}
    </>}
  </div>;
}
