import Link from "next/link";
import type { SyncView } from "@/lib/connectors/service";
import { CONNECTOR_LABEL, CONNECTOR_SLUG, type SyncStatus } from "@/lib/connectors/types";
import { formatDateTime } from "@/lib/domain/labels";
import { refreshAction } from "@/app/initiatives/[slug]/sources/import/actions";
import { RefreshButton } from "./RefreshButton";
import { Glyph, ProviderIcon } from "./icons";
import styles from "./connectors.module.css";

/** What the last check found. Always glyph + text; the last saved snapshot is kept in every case. */
const FRESHNESS: Record<SyncStatus, { label: string; detail: string | null; glyph: "check" | "warning" | "cross" }> = {
  CURRENT: { label: "Snapshot current", detail: null, glyph: "check" },
  NOT_FOUND: { label: "Not found at last check", detail: "Deleted, moved or no longer shared. The last snapshot is kept.", glyph: "warning" },
  NO_ACCESS: { label: "No access at last check", detail: "The person who refreshed can’t open it. The last snapshot is kept.", glyph: "warning" },
  FAILED: { label: "Last check failed", detail: "The provider didn’t answer. Try Refresh again; the last snapshot is kept.", glyph: "cross" },
};

export function ConnectedSourceList({ slug, syncs, canWrite }: { slug: string; syncs: SyncView[]; canWrite: boolean }) {
  if (!syncs.length) return null;
  return <section className={styles.synced} aria-labelledby="connected-sources">
    <div className={styles.syncedHead}><h3 id="connected-sources">Imported from connected accounts <span className={styles.count}>{syncs.length}</span></h3>
      <p>Refresh saves a new snapshot only when the content changed; earlier snapshots stay. A change is a signal to review, not a confirmed fact.</p></div>
    <ul className={styles.syncList}>{syncs.map(x => {
      const f = FRESHNESS[x.status], label = CONNECTOR_LABEL[x.connector];
      return <li key={x.id} className={styles.syncRow} data-status={x.status}>
        <span className={styles.syncIcon} title={label}><ProviderIcon connector={x.connector} size={16} /></span>
        <div className={styles.syncMain}>
          <p className={styles.syncTitle}><strong>{x.latestTitle ?? x.itemName}</strong>{x.connector === "JIRA" && x.itemReference && !(x.latestTitle ?? x.itemName).includes(x.itemReference) && <span className={styles.syncRef}>{x.itemReference}</span>}</p>
          <p className={styles.syncMeta}>
            <span className={styles.fresh} data-status={x.status}><Glyph name={f.glyph} size={12} />{f.label}</span>
            <span>Last checked {formatDateTime(x.lastCheckedAt)}</span>
            <span>Snapshot saved {formatDateTime(x.lastSyncedAt)}</span>
            <span>{x.snapshots} {x.snapshots === 1 ? "snapshot" : "snapshots"}</span>
          </p>
          {f.detail && <p className={styles.syncDetail} data-status={x.status}>{f.detail}</p>}
          {x.latestTitle && x.latestTitle !== x.itemName && !x.latestTitle.includes(x.itemName) && <p className={styles.syncMeta}>First imported as “{x.itemName}”.</p>}
          <p className={styles.syncLinks}><Link prefetch={false} href={`/initiatives/${slug}/evidence/${x.lastSubmissionId}`}>Review latest snapshot</Link>{x.itemUrl && <a href={x.itemUrl} target="_blank" rel="noreferrer">Open in {label}<Glyph name="external" size={12} /></a>}</p>
        </div>
        {canWrite && <RefreshButton action={refreshAction} slug={slug} itemId={x.itemId} connector={CONNECTOR_SLUG[x.connector]} label={x.itemName} providerLabel={label} />}
      </li>;
    })}</ul>
  </section>;
}
