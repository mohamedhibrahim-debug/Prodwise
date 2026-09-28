import Link from "next/link";
import { requireWorkspaceAccess } from "@/lib/auth/access";
import { connectorOverview } from "@/lib/connectors/service";
import { CONNECTOR_LABEL, CONNECTOR_SLUG, connectorFromSlug, connectorMessage, type Connector, type ConnectorErrorCode } from "@/lib/connectors/types";
import { formatDateTime } from "@/lib/domain/labels";
import { Section, styles } from "@/components/admin/AdminUI";
import { ConnectorButton } from "@/components/connectors/ConnectorButton";
import { connectAction, disconnectAction } from "./actions";

export const metadata = { title: "Connected sources" };
export const dynamic = "force-dynamic";

const READS: Record<Connector, string> = {
  JIRA: "Reads work items, their status, dates, links and recent comments in projects you can see. Never edits Jira.",
  GMAIL: "Runs searches you type and reads only the threads you select. Never sends, labels or deletes email; attachments are not read.",
  GOOGLE_DRIVE: "Searches files you can open and reads only the documents you select. Never edits or shares files.",
  FIGMA: "Reads the pages, frames, text and open comments of files you link. Never edits designs; a changed frame is never treated as approval.",
};
const KNOWN: ConnectorErrorCode[] = ["NOT_CONFIGURED", "NOT_CONNECTED", "NEEDS_RECONNECT", "NO_ACCESS", "NOT_FOUND", "RATE_LIMITED", "PROVIDER_UNAVAILABLE", "UNSUPPORTED", "INVALID_REQUEST", "DEMO_ORGANIZATION", "VIEW_ONLY"];

export default async function Connections({ searchParams }: { searchParams: Promise<{ connected?: string; connector?: string; result?: string }> }) {
  const [ctx, q, { overview, isDemo }] = await Promise.all([requireWorkspaceAccess(), searchParams, connectorOverview()]);
  // Deployment variable names are for the people who run the installation, not for organization users.
  const operator = ctx.platformRole === "PLATFORM_OWNER";
  const connected = q.connected ? connectorFromSlug(q.connected) : null, failed = q.connector ? connectorFromSlug(q.connector) : null;
  const result = KNOWN.includes(q.result as ConnectorErrorCode) ? q.result as ConnectorErrorCode : null;
  return <div className={styles.page}>
    <header className={styles.masthead}><div><p className={styles.eyebrow}>Personal account</p><h1>Connected sources</h1>
      <p className={styles.intro}>Connect your own accounts to bring Jira work, email threads, Drive documents and Figma frames into an initiative as evidence. Prodwise reads only what you select, never changes anything in these tools, and nothing becomes Knowledge until someone confirms it.</p></div></header>
    {connected && <p role="status" className={styles.success}>{CONNECTOR_LABEL[connected]} connected. Import from an initiative’s Sources page.</p>}
    {failed && result && <p role="alert" className={styles.error}>{result === "NOT_CONNECTED" ? `${CONNECTOR_LABEL[failed]} wasn’t connected: access was not granted. Nothing changed.` : result === "INVALID_REQUEST" ? `The ${CONNECTOR_LABEL[failed]} sign-in expired or didn’t match this session. Start again from here; nothing changed.` : connectorMessage(result, failed)}</p>}
    {isDemo && <p role="status" className={styles.notice}>{connectorMessage("DEMO_ORGANIZATION", "JIRA")} Switch to your organization to connect sources.</p>}
    <div className={styles.detailColumns}><div>
      {overview.map(o => <Section key={o.connector} title={CONNECTOR_LABEL[o.connector]}>
        <dl className={styles.details}>
          <div><dt>Status</dt><dd>{!o.ready ? "Not available yet" : o.status === "CONNECTED" ? `Connected as ${o.accountLabel ?? "your account"}` : o.status === "NEEDS_RECONNECT" ? "Needs reconnecting — access expired or was revoked" : "Not connected"}</dd></div>
          {o.status === "CONNECTED" && o.connectedAt && <div><dt>Connected</dt><dd>{formatDateTime(o.connectedAt)}</dd></div>}
          {o.connector === "JIRA" && o.sites.length > 0 && <div><dt>Jira sites</dt><dd>{o.sites.map(s => s.name).join(", ")}</dd></div>}
          <div><dt>What Prodwise reads</dt><dd>{READS[o.connector]}</dd></div>
        </dl>
        {!o.ready ? <p className={styles.summary}>{operator ? <>Not set up yet. For the installation: register the {CONNECTOR_LABEL[o.connector]} app and set <code>{o.missing.join(", ")}</code> (see the connector setup guide). Manual source references keep working meanwhile.</> : `Not available yet — ${CONNECTOR_LABEL[o.connector]} hasn’t been set up for Prodwise. You can still add sources by reference. Ask your administrator if you need it.`}</p>
          : isDemo ? null
          : o.status === "CONNECTED" ? <ConnectorButton action={disconnectAction} connector={CONNECTOR_SLUG[o.connector]} label={`Disconnect ${CONNECTOR_LABEL[o.connector]}`} pendingLabel="Disconnecting…" tone="danger" />
          : <ConnectorButton action={connectAction} connector={CONNECTOR_SLUG[o.connector]} returnTo="/account/connections" label={o.status === "NEEDS_RECONNECT" ? `Reconnect ${CONNECTOR_LABEL[o.connector]}` : `Connect ${CONNECTOR_LABEL[o.connector]}`} pendingLabel="Opening sign-in…" />}
      </Section>)}
    </div><aside className={styles.side}>
      <Section title="How connected sources work"><p className={styles.summary}>Each person connects their own account and sees only what that account can see. Imported items become sources with a saved snapshot; Prodwise can then propose facts from them for a person to confirm. Refreshing saves a new snapshot only when the content changed, and earlier snapshots stay.</p>
        <p className={styles.summary}>Disconnecting deletes Prodwise’s stored access. Sources you already imported stay with their history.</p></Section>
      <Section title="Continue"><Link className={styles.textLink} href="/account">← My account</Link></Section>
    </aside></div>
  </div>;
}
