/**
 * Connector vocabulary. A connector reads an external system on behalf of one
 * person and produces Source / Evidence snapshots — never product truth.
 */
export const CONNECTORS = ["JIRA", "GMAIL", "GOOGLE_DRIVE", "FIGMA"] as const;
export type Connector = (typeof CONNECTORS)[number];

export type ConnectionStatus = "CONNECTED" | "NEEDS_RECONNECT" | "DISCONNECTED";

export interface ConnectorSite { id: string; url: string; name: string }

export interface Connection {
  id: string;
  organizationId: string;
  userId: string;
  provider: Connector;
  status: ConnectionStatus;
  accountLabel: string | null;
  externalAccountId: string | null;
  sites: ConnectorSite[];
  scopes: string;
  /** AES-256-GCM sealed {@link ProviderTokens}; null once disconnected. Never sent to a browser. */
  sealedTokens: string | null;
  connectedAt: string | null;
  updatedAt: string;
  disconnectedAt: string | null;
  lastErrorCode: string | null;
}

export interface ProviderTokens { accessToken: string; refreshToken: string | null; expiresAt: number | null }

/** One row in a search result list. Metadata only; content is read at import time. */
export interface ProviderResult {
  reference: string;
  name: string;
  kind: string;
  url: string | null;
  updatedAt: string | null;
  /** Short factual line: status, sender, owner, page. */
  detail: string;
}

export type EvidenceSourceKind = "JIRA" | "EMAIL" | "DOCUMENT" | "DESIGN";

/** Everything needed to save one snapshot through the evidence path. */
export interface ProviderSnapshot {
  connector: Connector;
  provider: "JIRA" | "EMAIL" | "DOCUMENT" | "FIGMA";
  providerWorkspace: string;
  containerReference: string;
  containerName: string;
  item: { reference: string; name: string; kind: string; url: string | null };
  title: string;
  text: string;
  evidenceSourceType: EvidenceSourceKind;
  externalUpdatedAt: string | null;
  occurredAt: string | null;
}

export type SyncStatus = "CURRENT" | "NOT_FOUND" | "NO_ACCESS" | "FAILED";

export interface SourceItemSync {
  id: string;
  workspaceId: string;
  initiativeId: string;
  itemId: string;
  connector: Connector;
  externalUpdatedAt: string | null;
  contentSha256: string;
  lastSubmissionId: string;
  lastSyncedAt: string;
  lastSyncedBy: string;
  lastCheckedAt: string;
  status: SyncStatus;
  revision: number;
}

export const CONNECTOR_LABEL: Record<Connector, string> = { JIRA: "Jira", GMAIL: "Gmail", GOOGLE_DRIVE: "Google Drive", FIGMA: "Figma" };
export const CONNECTOR_SLUG: Record<Connector, string> = { JIRA: "jira", GMAIL: "gmail", GOOGLE_DRIVE: "google-drive", FIGMA: "figma" };
export function connectorFromSlug(slug: string): Connector | null {
  return (Object.entries(CONNECTOR_SLUG).find(([, s]) => s === slug)?.[0] as Connector | undefined) ?? null;
}

export type ConnectorErrorCode =
  | "NOT_CONFIGURED" | "NOT_CONNECTED" | "NEEDS_RECONNECT" | "NO_ACCESS" | "NOT_FOUND"
  | "RATE_LIMITED" | "PROVIDER_UNAVAILABLE" | "UNSUPPORTED" | "INVALID_REQUEST" | "DEMO_ORGANIZATION" | "VIEW_ONLY";

export class ConnectorError extends Error {
  readonly code: ConnectorErrorCode;
  constructor(code: ConnectorErrorCode, message?: string) { super(message ?? code); this.name = "ConnectorError"; this.code = code; }
}

/** What happened → why → what now. Never a provider body, token, URL with secrets or stack. */
export function connectorMessage(code: ConnectorErrorCode, connector: Connector): string {
  const name = CONNECTOR_LABEL[connector];
  switch (code) {
    case "NOT_CONFIGURED": return `Not available yet — ${name} hasn’t been set up for Prodwise. You can still add sources by reference.`;
    case "NOT_CONNECTED": return `Connect your ${name} account first. Prodwise only reads what you choose.`;
    case "NEEDS_RECONNECT": return `Your ${name} connection expired or was revoked. Reconnect it; nothing already imported has changed.`;
    case "NO_ACCESS": return `Your ${name} account can't open this item. Ask for access in ${name}; the last saved snapshot is kept.`;
    case "NOT_FOUND": return `${name} no longer has this item, or it is no longer shared with you. The last saved snapshot is kept.`;
    case "RATE_LIMITED": return `${name} asked Prodwise to slow down. Wait a minute and try again; nothing was saved.`;
    case "PROVIDER_UNAVAILABLE": return `${name} didn't respond. Try again shortly; nothing was saved.`;
    case "UNSUPPORTED": return `Prodwise can't read this ${name} item's content. Its link and details can still be recorded.`;
    case "INVALID_REQUEST": return `That ${name} search or selection isn't valid. Check it and try again.`;
    case "VIEW_ONLY": return `You have view-only access in this organization, so ${name} can't be connected here. Nothing was changed.`;
    case "DEMO_ORGANIZATION": return "Connectors are off in the Demo organization: its sources are synthetic, and real data must never enter it.";
  }
}
