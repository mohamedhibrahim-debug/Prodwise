import "server-only";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { adminClient, isLocalAuth } from "@/lib/auth/service";
import { credentialsFor, publicOrigin } from "./oauth";
import { tokenKey } from "./crypto";
import { PROVIDERS } from "./oauth";
import type { Connection, Connector } from "./types";

/** What this installation is missing to offer a connector. Variable names only — never values. */
export function connectorSetup(connector: Connector): { ready: boolean; missing: string[] } {
  const env = process.env, missing: string[] = [];
  if (!tokenKey(env.CONNECTOR_TOKEN_KEY)) missing.push("CONNECTOR_TOKEN_KEY");
  if (!publicOrigin(env.PRODWISE_PUBLIC_URL)) missing.push("PRODWISE_PUBLIC_URL");
  if (!credentialsFor(connector, env)) missing.push(PROVIDERS[connector].env.id, PROVIDERS[connector].env.secret);
  return { ready: missing.length === 0, missing };
}
export const connectorKey = () => { const k = tokenKey(process.env.CONNECTOR_TOKEN_KEY); if (!k) throw new Error("CONNECTOR_TOKEN_KEY"); return k; };
export const tokenBinding = (c: Pick<Connection, "organizationId" | "userId" | "provider">) => `${c.organizationId}:${c.userId}:${c.provider}`;

const localPath = () => join(process.cwd(), ".data", "connections.json");
function readLocal(): Connection[] { return existsSync(localPath()) ? (JSON.parse(readFileSync(localPath(), "utf8")) as { connections: Connection[] }).connections : []; }
function writeLocal(all: Connection[]) { mkdirSync(join(process.cwd(), ".data"), { recursive: true }); const tmp = `${localPath()}.${randomUUID()}.tmp`; writeFileSync(tmp, JSON.stringify({ connections: all }, null, 2), { mode: 0o600 }); renameSync(tmp, localPath()); }

type Row = { id: string; organization_id: string; user_id: string; provider: Connector; status: Connection["status"]; account_label: string | null; external_account_id: string | null; sites: Connection["sites"]; scopes: string; sealed_tokens: string | null; connected_at: string | null; updated_at: string; disconnected_at: string | null; last_error_code: string | null };
const fromRow = (r: Row): Connection => ({ id: r.id, organizationId: r.organization_id, userId: r.user_id, provider: r.provider, status: r.status, accountLabel: r.account_label, externalAccountId: r.external_account_id, sites: r.sites ?? [], scopes: r.scopes, sealedTokens: r.sealed_tokens, connectedAt: r.connected_at, updatedAt: r.updated_at, disconnectedAt: r.disconnected_at, lastErrorCode: r.last_error_code });
const toRow = (c: Connection): Row => ({ id: c.id, organization_id: c.organizationId, user_id: c.userId, provider: c.provider, status: c.status, account_label: c.accountLabel, external_account_id: c.externalAccountId, sites: c.sites, scopes: c.scopes, sealed_tokens: c.sealedTokens, connected_at: c.connectedAt, updated_at: c.updatedAt, disconnected_at: c.disconnectedAt, last_error_code: c.lastErrorCode });

/** Always scoped to one person in one organization: nobody reads another person's connection. */
export async function listConnections(organizationId: string, userId: string): Promise<Connection[]> {
  if (isLocalAuth()) return readLocal().filter(c => c.organizationId === organizationId && c.userId === userId);
  const { data, error } = await adminClient().from("connector_connections").select("*").eq("organization_id", organizationId).eq("user_id", userId);
  if (error) throw new Error("Connections are unavailable. Check that migration 0039 is installed.");
  return (data as Row[]).map(fromRow);
}
export async function getConnection(organizationId: string, userId: string, provider: Connector): Promise<Connection | null> {
  return (await listConnections(organizationId, userId)).find(c => c.provider === provider) ?? null;
}
export async function saveConnection(c: Connection): Promise<void> {
  if (isLocalAuth()) { const all = readLocal().filter(x => !(x.organizationId === c.organizationId && x.userId === c.userId && x.provider === c.provider)); writeLocal([...all, c]); return; }
  const { error } = await adminClient().from("connector_connections").upsert(toRow(c), { onConflict: "organization_id,user_id,provider" });
  if (error) throw new Error("The connection could not be saved. Nothing was imported.");
}
