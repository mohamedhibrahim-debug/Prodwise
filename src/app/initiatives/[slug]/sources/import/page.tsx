import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepository } from "@/lib/data";
import { businessWritePresentation } from "@/lib/auth/presentation";
import { connectorOverview, readSyncs } from "@/lib/connectors/service";
import { CONNECTOR_LABEL, CONNECTOR_SLUG, CONNECTORS, connectorFromSlug, connectorMessage, type Connector } from "@/lib/connectors/types";
import { ConnectorButton } from "@/components/connectors/ConnectorButton";
import { ButtonLink } from "@/components/primitives/Button";
import { ImportWorkspace } from "@/components/connectors/ImportWorkspace";
import { ProviderIcon } from "@/components/connectors/icons";
import { ConnectionPill } from "@/components/connectors/ConnectionPill";
import { connectAction } from "@/app/account/connections/actions";
import styles from "@/components/connectors/connectors.module.css";

export const metadata = { title: "Import sources" };
export const dynamic = "force-dynamic";

const DEFAULT_ROLE: Record<Connector, "DELIVERY" | "DECISIONS" | "REQUIREMENTS"> = { JIRA: "DELIVERY", GMAIL: "DECISIONS", GOOGLE_DRIVE: "REQUIREMENTS", FIGMA: "REQUIREMENTS" };
const WHAT: Record<Connector, string> = {
  JIRA: "epics, stories, tasks and bugs",
  GMAIL: "email threads",
  GOOGLE_DRIVE: "Docs, Sheets, Slides and files",
  FIGMA: "frames from a Figma file",
};

export default async function ImportSources({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string; q?: string; project?: string; site?: string; type?: string; status?: string; link?: string; connected?: string }> }) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const initiative = await getRepository().getInitiativeBySlug(slug); if (!initiative) notFound();
  const connector: Connector = connectorFromSlug(q.from ?? "") ?? "JIRA";
  const [{ overview, isDemo }, write, syncs] = await Promise.all([connectorOverview(), businessWritePresentation(), readSyncs(initiative.id)]);
  const o = overview.find(x => x.connector === connector)!, label = CONNECTOR_LABEL[connector], base = `/initiatives/${slug}/sources/import`;
  const here = `${base}?from=${CONNECTOR_SLUG[connector]}`;
  const live = o.ready && o.status === "CONNECTED" && !isDemo && !initiative.archivedAt && write.enabled;
  const justConnected = q.connected ? connectorFromSlug(q.connected) : null;

  return <div className={styles.page}>
    <nav aria-label="Breadcrumb" className={styles.crumbs}><Link prefetch={false} href={`/initiatives/${slug}/sources`}>Sources</Link><span aria-hidden="true">/</span><span aria-current="page">Import</span></nav>
    <header className={styles.head}>
      <div><h2>Import from {label}</h2><p>Choose {WHAT[connector]} for {initiative.name}. Each becomes a source with a saved snapshot. Prodwise never changes anything in {label}, and nothing becomes Knowledge until someone confirms it.</p></div>
    </header>
    <nav className={styles.providerTabs} aria-label="Import from">{CONNECTORS.map(c => { const x = overview.find(y => y.connector === c)!; return <Link prefetch={false} key={c} href={`${base}?from=${CONNECTOR_SLUG[c]}`} aria-current={c === connector ? "page" : undefined}>
      <ProviderIcon connector={c} size={16} /><span>{CONNECTOR_LABEL[c]}</span><ConnectionPill ready={x.ready} status={x.status} compact />
    </Link>; })}</nav>

    {justConnected && <p role="status" className={styles.success}>{CONNECTOR_LABEL[justConnected]} connected. You can search it now.</p>}
    {isDemo ? <p className={styles.notice} role="status">{connectorMessage("DEMO_ORGANIZATION", connector)}</p>
    : initiative.archivedAt ? <p className={styles.notice} role="status">Archived — restore this initiative to import sources.</p>
    : !write.enabled ? <p className={styles.notice} role="status">{write.message} Importing sources changes the initiative’s evidence.</p>
    : !o.ready ? <div className={styles.notice}><p>{connectorMessage("NOT_CONFIGURED", connector)}</p><ButtonLink variant="secondary" size="sm" href={`/initiatives/${slug}/knowledge/sources/new`}>Record a reference instead</ButtonLink></div>
    : o.status !== "CONNECTED" ? <div className={styles.connectPanel}>
        <ProviderIcon connector={connector} size={28} />
        <div><h3>{o.status === "NEEDS_RECONNECT" ? `Reconnect ${label}` : `Connect ${label}`}</h3><p>{o.status === "NEEDS_RECONNECT" ? connectorMessage("NEEDS_RECONNECT", connector) : connectorMessage("NOT_CONNECTED", connector)} You’ll come straight back here.</p></div>
        <ConnectorButton action={connectAction} connector={CONNECTOR_SLUG[connector]} returnTo={here} label={`${o.status === "NEEDS_RECONNECT" ? "Reconnect" : "Connect"} ${label}`} pendingLabel="Opening sign-in…" />
      </div>
    : null}

    {live && <>
      <p className={styles.accountLine}><ProviderIcon connector={connector} size={14} /> Connected as <strong>{o.accountLabel ?? "your account"}</strong>{o.sites.length === 1 && connector === "JIRA" ? <> · {o.sites[0]!.name}</> : null} · <Link prefetch={false} href={`/account/connections?returnTo=${encodeURIComponent(here)}`}>Manage connection</Link>
        {o.fixture && <span className={styles.fixtureTag}>Synthetic fixture data · local development only</span>}</p>
      <ImportWorkspace key={connector} slug={slug} initiativeName={initiative.name} connector={connector} connectorSlug={CONNECTOR_SLUG[connector]} label={label} sites={o.sites}
        importedRefs={syncs.map(s => s.itemReference)} defaultRole={DEFAULT_ROLE[connector]}
        initial={{ q: q.q, project: q.project, site: q.site, type: q.type, status: q.status, link: q.link }} />
    </>}
  </div>;
}
