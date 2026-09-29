import Link from "next/link";
import type { ConnectorOverview } from "@/lib/connectors/service";
import { CONNECTOR_LABEL, CONNECTOR_SLUG } from "@/lib/connectors/types";
import { ConnectionPill } from "./ConnectionPill";
import { ProviderIcon } from "./icons";
import styles from "./connectors.module.css";

/**
 * "Import from" on an initiative's Sources page: every provider with its real connection
 * state, and the manual ways in. A missing connection links to My account → Connected
 * sources and comes back to the import.
 */
export function ImportFromStrip({ slug, overview, isDemo, canWrite }: { slug: string; overview: ConnectorOverview[]; isDemo: boolean; canWrite: boolean }) {
  const base = `/initiatives/${slug}`;
  return <section className={styles.strip} aria-labelledby="import-from">
    <h3 id="import-from" className={styles.stripTitle}>Import from</h3>
    {isDemo ? <p className={styles.stripNote}>Connectors are off in the Demo organization: its sources are synthetic, and real data must never enter it. Manual sources still work.</p>
    : <ul className={styles.stripList}>{overview.map(o => {
      const label = CONNECTOR_LABEL[o.connector], s = CONNECTOR_SLUG[o.connector], importHref = `${base}/sources/import?from=${s}`;
      const connectHref = `/account/connections?connect=${s}&returnTo=${encodeURIComponent(importHref)}#connector-${s}`;
      const connected = o.ready && o.status === "CONNECTED";
      const href = !o.ready ? null : connected ? importHref : connectHref;
      const body = <><span className={styles.tileIcon}><ProviderIcon connector={o.connector} size={20} /></span>
        <span className={styles.tileText}><strong>{label}</strong><span>{!o.ready ? "Not set up for this installation" : connected ? (o.accountLabel ?? "Connected") : o.status === "NEEDS_RECONNECT" ? "Reconnect to import" : "Connect your account"}</span></span>
        <ConnectionPill ready={o.ready} status={o.status} compact /></>;
      return <li key={o.connector}>{href && canWrite ? <Link prefetch={false} className={styles.tile} href={href} aria-label={`${connected ? "Import from" : o.status === "NEEDS_RECONNECT" ? "Reconnect" : "Connect"} ${label}`}>{body}</Link> : <span className={styles.tile} data-inert="true">{body}</span>}</li>;
    })}</ul>}
    {canWrite && <div className={styles.manual}><span className={styles.manualLabel}>Or add manually</span>
      <Link prefetch={false} href={`${base}/evidence/new?kind=meeting`}><ProviderIcon connector="MEETING" size={15} />Meeting notes</Link>
      <Link prefetch={false} href={`${base}/evidence/new`}><ProviderIcon connector="PASTE" size={15} />Paste text</Link>
      <Link prefetch={false} href={`${base}/knowledge/sources/new`}><ProviderIcon connector="MANUAL" size={15} />Reference only</Link>
    </div>}
  </section>;
}
