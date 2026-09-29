import Link from "next/link";
import { requireWorkspaceAccess } from "@/lib/auth/access";
import { canBusinessWrite } from "@/lib/auth/roles";
import { safeReturnPath } from "@/lib/auth/core";
import { connectorOverview } from "@/lib/connectors/service";
import { CONNECTOR_LABEL, CONNECTOR_SLUG, connectorFromSlug, connectorMessage, type Connector, type ConnectorErrorCode } from "@/lib/connectors/types";
import { formatDateTime } from "@/lib/domain/labels";
import { workspacePresentation } from "@/lib/workspace/context";
import { ConnectorButton } from "@/components/connectors/ConnectorButton";
import { DisconnectButton } from "@/components/connectors/DisconnectButton";
import { ConnectionPill } from "@/components/connectors/ConnectionPill";
import { ProviderIcon } from "@/components/connectors/icons";
import styles from "@/components/connectors/connectors.module.css";
import { connectAction, disconnectAction } from "./actions";

export const metadata = { title: "Connected sources" };
export const dynamic = "force-dynamic";

const READS: Record<Connector, string> = {
  JIRA: "Work items you choose, with status, dates, links and recent comments, in projects you can see.",
  GMAIL: "Only threads you select from a search you type. Attachments are listed by name, never read.",
  GOOGLE_DRIVE: "Only files you select from a search. Docs, Sheets and Slides as text; other files by link.",
  FIGMA: "Frames you select from a file you link: their text and, if you choose, open comments.",
};
const NEVER: Record<Connector, string> = {
  JIRA: "Never creates, edits or transitions Jira issues.",
  GMAIL: "Never sends, labels, moves or deletes email.",
  GOOGLE_DRIVE: "Never edits, shares or deletes files.",
  FIGMA: "Never edits designs. A changed frame is never treated as approval.",
};
/** Plain-language meaning of each requested scope. All are read-only. */
const SCOPE_TEXT: Record<string, string> = {
  "read:jira-work": "Read issues and projects",
  "read:jira-user": "Read people’s names on issues",
  offline_access: "Stay connected until you disconnect",
  openid: "Confirm who you are",
  email: "Read your email address (account label)",
  "https://www.googleapis.com/auth/gmail.readonly": "Read email (read-only)",
  "https://www.googleapis.com/auth/drive.readonly": "Read Drive files (read-only)",
  "current_user:read": "Read your Figma profile",
  "file_content:read": "Read file content",
  "file_comments:read": "Read comments",
};
const KNOWN: ConnectorErrorCode[] = ["NOT_CONFIGURED", "NOT_CONNECTED", "NEEDS_RECONNECT", "NO_ACCESS", "NOT_FOUND", "RATE_LIMITED", "PROVIDER_UNAVAILABLE", "UNSUPPORTED", "INVALID_REQUEST", "DEMO_ORGANIZATION", "VIEW_ONLY", "SCOPE_REFUSED"];

export default async function Connections({ searchParams }: { searchParams: Promise<{ connected?: string; disconnected?: string; connector?: string; result?: string; connect?: string; returnTo?: string }> }) {
  const [ctx, q, { overview, isDemo }, presentation] = await Promise.all([requireWorkspaceAccess(), searchParams, connectorOverview(), workspacePresentation()]);
  // Deployment variable names are for the people who run the installation, not for organization users.
  const operator = ctx.platformRole === "PLATFORM_OWNER", writer = canBusinessWrite(ctx);
  const disconnected = q.disconnected ? connectorFromSlug(q.disconnected) : null, connected = q.connected ? connectorFromSlug(q.connected) : null, failed = q.connector ? connectorFromSlug(q.connector) : null, focus = q.connect ? connectorFromSlug(q.connect) : null;
  const result = KNOWN.includes(q.result as ConnectorErrorCode) ? q.result as ConnectorErrorCode : null;
  const back = q.returnTo ? safeReturnPath(q.returnTo) : null, returnTo = back && back !== "/" ? back : "/account/connections";
  const connectedCount = overview.filter(o => o.ready && o.status === "CONNECTED").length;

  return <div className={styles.page}>
    <nav aria-label="Breadcrumb" className={styles.crumbs}><Link prefetch={false} href="/account">My account</Link><span aria-hidden="true">/</span><span aria-current="page">Connected sources</span></nav>
    <header className={styles.head}>
      <div><h2>Connected sources</h2>
        <p>Your own accounts, used to bring Jira work, email threads, Drive documents and Figma frames into an initiative as evidence. Prodwise reads only what you select, never changes anything in these tools, and nothing becomes Knowledge until someone confirms it.</p></div>
      {back && back !== "/" && <Link prefetch={false} className={styles.backLink} href={back}>Back to import</Link>}
    </header>
    <p className={styles.orgLine}>Organization <strong>{presentation.organizationName}</strong> · {connectedCount} of {overview.length} connected · Connections belong to you in this organization only; nobody else can use them.</p>

    {disconnected && <p role="status" className={styles.success}>{CONNECTOR_LABEL[disconnected]} disconnected. Prodwise deleted its stored access; sources you imported and their snapshots stay.</p>}
    {connected && <p role="status" className={styles.success}>{CONNECTOR_LABEL[connected]} connected. Import from an initiative’s Sources page.</p>}
    {failed && result && <p role="alert" className={styles.alert}>{result === "NOT_CONNECTED" ? `${CONNECTOR_LABEL[failed]} wasn’t connected: access was not granted. Nothing changed.` : result === "INVALID_REQUEST" ? `The ${CONNECTOR_LABEL[failed]} sign-in expired or didn’t match this session. Start again from here; nothing changed.` : connectorMessage(result, failed)}</p>}
    {isDemo && <p role="status" className={styles.notice}>{connectorMessage("DEMO_ORGANIZATION", "JIRA")} Switch to your organization to connect sources.</p>}
    {!isDemo && !writer && <p role="status" className={styles.notice}>You have view-only access in this organization, so you can’t connect sources here. You can read what others imported on each initiative’s Sources page.</p>}

    <ul className={styles.providers}>{overview.map(o => {
      const label = CONNECTOR_LABEL[o.connector], slug = CONNECTOR_SLUG[o.connector];
      const reconnect = o.status === "NEEDS_RECONNECT";
      return <li key={o.connector} id={`connector-${slug}`} className={styles.provider} data-focus={focus === o.connector || undefined} data-state={!o.ready ? "unavailable" : o.status}>
        <div className={styles.providerId}><span className={styles.providerIcon}><ProviderIcon connector={o.connector} size={20} /></span>
          <div><h3>{label}</h3><ConnectionPill ready={o.ready} status={o.status} /></div></div>
        <div className={styles.providerBody}>
          {o.ready && o.status === "CONNECTED" && <p className={styles.account}>Connected as <strong>{o.accountLabel ?? "your account"}</strong>{o.connectedAt && <> · since {formatDateTime(o.connectedAt)}</>}{o.connector === "JIRA" && o.sites.length > 0 && <> · {o.sites.map(s => s.name).join(", ")}</>}</p>}
          {o.fixture && <p className={styles.fixtureTag}>Synthetic fixture data · local development only — no real {label} account is used</p>}
          {reconnect && <p className={styles.alertInline}><strong>Access expired or was revoked in {label}.</strong> Reconnect to keep importing and refreshing. Sources you already imported and their snapshots are unaffected.</p>}
          {o.lastErrorCode && !reconnect && o.status === "CONNECTED" && KNOWN.includes(o.lastErrorCode as ConnectorErrorCode) && <p className={styles.alertInline}>{connectorMessage(o.lastErrorCode as ConnectorErrorCode, o.connector)}</p>}
          <dl className={styles.facts}>
            <div><dt>Reads</dt><dd>{READS[o.connector]}</dd></div>
            <div><dt>Never</dt><dd>{NEVER[o.connector]}</dd></div>
            <div><dt>Access requested</dt><dd><ul className={styles.scopes}>{o.scopes.map(s => <li key={s}>{SCOPE_TEXT[s] ?? s}</li>)}</ul></dd></div>
          </dl>
          {!o.ready && <p className={styles.muted}>{operator ? <>Not set up for this installation. Register the {label} app and set <code>{o.missing.join(", ")}</code> (see the connector setup guide). Manual source references keep working meanwhile.</> : `Not set up yet — your administrator hasn’t enabled ${label} for Prodwise. You can still record sources by reference.`}</p>}
        </div>
        <div className={styles.providerActions}>
          {!o.ready || isDemo ? null
          : o.status === "CONNECTED" ? <DisconnectButton action={disconnectAction} connector={slug} label={label} />
          : !writer ? null
          : <ConnectorButton action={connectAction} connector={slug} returnTo={focus === o.connector ? returnTo : "/account/connections"} label={reconnect ? `Reconnect ${label}` : `Connect ${label}`} pendingLabel="Opening sign-in…" variant={reconnect || focus === o.connector ? "primary" : "secondary"} />}
        </div>
      </li>;
    })}</ul>

    <section className={styles.explain} aria-labelledby="how-connections-work"><h3 id="how-connections-work">How connected sources work</h3>
      <p>Each person connects their own account and sees only what that account can see. Imported items become sources with a saved snapshot; Prodwise can then propose facts from them for a person to confirm. Refreshing saves a new snapshot only when the content changed, and earlier snapshots stay. Disconnecting deletes Prodwise’s stored access; sources you already imported stay with their history.</p></section>
  </div>;
}
