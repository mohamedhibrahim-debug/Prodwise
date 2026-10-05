import { safeMessage } from '@/lib/errors/safe-message';
import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { requireBusinessWriteAccess, requireWorkspaceAccess } from "@/lib/auth/access";
import { adminClient, isLocalAuth } from "@/lib/auth/service";
import { withRepositoryContext } from "@/lib/auth/repository-context";
import { safeReturnPath, type WorkspaceAccess } from "@/lib/auth/core";
import { readStore, writeStoreAtomic } from "@/lib/data/store";
import { readManagement } from "@/lib/data/management-read";
import { workspacePresentation } from "@/lib/workspace/context";
import type { SourceRole } from "@/lib/workspace/source-mapping";
import { connectorKey, connectorSetup, getConnection, listConnections, saveConnection, tokenBinding, updateConnectionTokens } from "./connections";
import { open, seal } from "./crypto";
import { bearerCall, type ProviderCall } from "./http";
import { withTokens } from "./token-lifecycle";
import { authorizeUrl, callbackErrorCode, credentialsFor, exchangeCode, pkcePair, PROVIDERS, publicOrigin, redirectUri, refreshTokens } from "./oauth";
import { FIXTURE_ACCOUNT, FIXTURE_SITE, fixtureCall, fixturesEnabled } from "./local-fixtures";
import { ACCESSIBLE_RESOURCES, issueSnapshot, listProjects, searchIssuesPage, sitesFrom } from "./jira";
import { searchThreads, threadSnapshot } from "./gmail";
import { fileSnapshot, searchFilesPage } from "./drive";
import { fileOutline, frameSnapshot, parseFigmaLink, type FigmaOutline } from "./figma";
import { applyConnectorSnapshot, applySourceCheck } from "./local-import";
import { CONNECTOR_SLUG, ConnectorError, CONNECTORS, type Connection, type ConnectorErrorCode, type Connector, type ProviderSnapshot, type ProviderTokens, type SearchOutcome, type SourceItemSync } from "./types";

/** Connectors never run inside the Demo organization: its sources are synthetic. */
async function guard(ctx: WorkspaceAccess): Promise<void> {
  if ((await workspacePresentation(ctx)).isDemo) throw new ConnectorError("DEMO_ORGANIZATION");
}
/** Local development only: synthetic providers (see local-fixtures.ts). isLocalAuth() refuses hosted builds. */
const fixtures = () => isLocalAuth() && fixturesEnabled(process.env);
const setup = (connector: Connector) => fixtures() ? { ready: true, missing: [] as string[] } : connectorSetup(connector);
function ready(connector: Connector) { if (!setup(connector).ready) throw new ConnectorError("NOT_CONFIGURED"); }
function fixtureConnection(ctx: WorkspaceAccess, connector: Connector, status: Connection["status"], existing: Connection | null): Connection {
  const now = new Date().toISOString();
  return { id: existing?.id ?? randomUUID(), organizationId: ctx.organizationId, userId: ctx.actor.id, provider: connector, status, accountLabel: status === "DISCONNECTED" ? null : FIXTURE_ACCOUNT[connector], externalAccountId: "local-fixture",
    sites: connector === "JIRA" && status === "CONNECTED" ? [FIXTURE_SITE] : [], scopes: PROVIDERS[connector].scopes.join(" "), sealedTokens: null, connectedAt: existing?.connectedAt ?? null, updatedAt: now, disconnectedAt: status === "DISCONNECTED" ? now : null, lastErrorCode: existing?.lastErrorCode ?? null };
}

export interface ConnectorOverview { connector: Connector; ready: boolean; missing: string[]; status: Connection["status"] | "NOT_CONNECTED"; accountLabel: string | null; sites: Connection["sites"]; connectedAt: string | null; lastErrorCode: string | null; scopes: string[]; fixture: boolean }
/** Safe summary for the current person. No token, sealed value or provider body ever leaves this function. */
export async function connectorOverview(): Promise<{ overview: ConnectorOverview[]; isDemo: boolean }> {
  const ctx = await requireWorkspaceAccess();
  const [presentation, mine] = await Promise.all([workspacePresentation(ctx), listConnections(ctx.organizationId, ctx.actor.id)]);
  const fixture = fixtures();
  return { isDemo: presentation.isDemo, overview: CONNECTORS.map(connector => { const found = mine.find(x => x.provider === connector), s = setup(connector);
    // Fixture mode: connected until the person disconnects it here.
    const c = fixture ? fixtureConnection(ctx, connector, found?.status ?? "CONNECTED", found ?? null) : found;
    return { connector, ready: s.ready, missing: s.missing, status: c && c.status !== "DISCONNECTED" ? c.status : "NOT_CONNECTED", accountLabel: c?.status === "DISCONNECTED" ? null : c?.accountLabel ?? null, sites: c?.status === "CONNECTED" ? c.sites : [], connectedAt: c?.connectedAt ?? null, lastErrorCode: c?.lastErrorCode ?? null, scopes: PROVIDERS[connector].scopes, fixture }; }) };
}

// ── OAuth ──────────────────────────────────────────────────────────────────
interface OAuthState { p: Connector; o: string; u: string; n: string; v: string | null; r: string; t: number }
export const stateCookieName = (connector: Connector) => `prodwise_oauth_${connector.toLowerCase()}`;
const safeReturn = (r: string) => { const path = safeReturnPath(r); return path === "/" ? "/account/connections" : path; };

export async function beginConnect(connector: Connector, returnTo: string): Promise<{ url: string; cookie: string | null }> {
  const ctx = await requireBusinessWriteAccess(); await guard(ctx); ready(connector);
  if (fixtures()) {
    // Local fixture: no provider sign-in exists, so the connection is recorded directly.
    await saveConnection({ ...fixtureConnection(ctx, connector, "CONNECTED", await getConnection(ctx.organizationId, ctx.actor.id, connector)), connectedAt: new Date().toISOString() });
    const back = new URL(safeReturn(returnTo), "http://local.invalid"); back.searchParams.set("connected", CONNECTOR_SLUG[connector]);
    return { url: `${back.pathname}${back.search}`, cookie: null };
  }
  const creds = credentialsFor(connector, process.env)!, origin = publicOrigin(process.env.PRODWISE_PUBLIC_URL)!;
  const pkce = PROVIDERS[connector].pkce ? pkcePair() : null, nonce = randomBytes(24).toString("base64url");
  const state: OAuthState = { p: connector, o: ctx.organizationId, u: ctx.actor.id, n: nonce, v: pkce?.verifier ?? null, r: safeReturn(returnTo), t: Date.now() };
  return { url: authorizeUrl(connector, creds, redirectUri(origin, connector), nonce, pkce?.challenge ?? null), cookie: seal(connectorKey(), state, "oauth-state") };
}

async function identity(connector: Connector, call: ProviderCall): Promise<Pick<Connection, "accountLabel" | "externalAccountId" | "sites">> {
  if (connector === "JIRA") {
    const sites = sitesFrom(await call(ACCESSIBLE_RESOURCES));
    if (!sites.length) throw new ConnectorError("NO_ACCESS");
    const me = await call(`https://api.atlassian.com/ex/jira/${encodeURIComponent(sites[0]!.id)}/rest/api/3/myself`) as { accountId?: string; displayName?: string };
    return { accountLabel: me.displayName ?? "Atlassian account", externalAccountId: me.accountId ?? null, sites };
  }
  if (connector === "FIGMA") { const me = await call("https://api.figma.com/v1/me") as { id?: string; email?: string; handle?: string }; return { accountLabel: me.email ?? me.handle ?? "Figma account", externalAccountId: me.id ?? null, sites: [] }; }
  const me = await call("https://openidconnect.googleapis.com/v1/userinfo") as { sub?: string; email?: string };
  return { accountLabel: me.email ?? "Google account", externalAccountId: me.sub ?? null, sites: [] };
}

/** Completes the redirect. The state cookie must match the person, organization, provider and nonce, within ten minutes. */
export async function finishConnect(connector: Connector, params: URLSearchParams, cookie: string | undefined): Promise<string> {
  const ctx = await requireBusinessWriteAccess(); await guard(ctx); ready(connector);
  let state: OAuthState;
  try { state = open<OAuthState>(connectorKey(), cookie ?? "", "oauth-state"); } catch { throw new ConnectorError("INVALID_REQUEST"); }
  if (state.p !== connector || state.o !== ctx.organizationId || state.u !== ctx.actor.id || state.n !== params.get("state") || Date.now() - state.t > 600_000) throw new ConnectorError("INVALID_REQUEST");
  const refused = params.get("error"); if (refused) throw new ConnectorError(callbackErrorCode(refused, params.get("error_description")));
  const code = params.get("code"); if (!code || code.length > 2048) throw new ConnectorError("INVALID_REQUEST");
  const creds = credentialsFor(connector, process.env)!, origin = publicOrigin(process.env.PRODWISE_PUBLIC_URL)!;
  const tokens = await exchangeCode(fetch, connector, creds, code, redirectUri(origin, connector), state.v);
  const who = await identity(connector, bearerCall(fetch, tokens.accessToken));
  const existing = await getConnection(ctx.organizationId, ctx.actor.id, connector), now = new Date().toISOString();
  const c: Connection = { id: existing?.id ?? randomUUID(), organizationId: ctx.organizationId, userId: ctx.actor.id, provider: connector, status: "CONNECTED", ...who, scopes: PROVIDERS[connector].scopes.join(" "), sealedTokens: null, connectedAt: now, updatedAt: now, disconnectedAt: null, lastErrorCode: null };
  c.sealedTokens = seal(connectorKey(), tokens, tokenBinding(c));
  await saveConnection(c);
  return state.r;
}

export async function disconnect(connector: Connector): Promise<void> {
  const ctx = await requireWorkspaceAccess();
  const c = await getConnection(ctx.organizationId, ctx.actor.id, connector);
  if (fixtures() && !c) { await saveConnection(fixtureConnection(ctx, connector, "DISCONNECTED", null)); return; }
  if (!c || c.status === "DISCONNECTED") return;
  const revoke = PROVIDERS[connector].revokeUrl;
  if (revoke && c.sealedTokens) { try { const t = open<ProviderTokens>(connectorKey(), c.sealedTokens, tokenBinding(c)); await fetch(revoke, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: t.refreshToken ?? t.accessToken }).toString(), signal: AbortSignal.timeout(10000) }); } catch { /* Local removal still happens; the provider grant can be removed from the account settings. */ } }
  await saveConnection({ ...c, status: "DISCONNECTED", sealedTokens: null, disconnectedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), sites: [], lastErrorCode: null });
}

/** Runs fn with a fresh access token for the current person; one refresh on expiry, then "reconnect". */
async function withConnection<T>(ctx: WorkspaceAccess, connector: Connector, fn: (call: ProviderCall, c: Connection) => Promise<T>): Promise<T> {
  ready(connector);
  const c = await getConnection(ctx.organizationId, ctx.actor.id, connector);
  if (fixtures()) {
    if (c?.status === "DISCONNECTED") throw new ConnectorError("NOT_CONNECTED");
    if (c?.status === "NEEDS_RECONNECT") throw new ConnectorError("NEEDS_RECONNECT");
    return fn(fixtureCall(connector), fixtureConnection(ctx, connector, "CONNECTED", c));
  }
  if (!c || c.status === "DISCONNECTED" || !c.sealedTokens) throw new ConnectorError("NOT_CONNECTED");
  if (c.status === "NEEDS_RECONNECT") throw new ConnectorError("NEEDS_RECONNECT");
  const creds = credentialsFor(connector, process.env)!, key = connectorKey();
  let expectedSealed = c.sealedTokens;
  return withTokens({
    current: async () => { const now = await getConnection(ctx.organizationId, ctx.actor.id, connector); const sameGrant = now?.status === "CONNECTED" && now.connectedAt === c.connectedAt; return { connected: sameGrant, sealed: sameGrant ? now.sealedTokens : null }; },
    open: sealed => open<ProviderTokens>(key, sealed, tokenBinding(c)),
    seal: t => seal(key, t, tokenBinding(c)),
    save: async sealed => { if (!(await updateConnectionTokens(c, expectedSealed, sealed))) throw new ConnectorError("PROVIDER_UNAVAILABLE"); expectedSealed = sealed; },
    expire: async () => { await updateConnectionTokens(c, expectedSealed, null); },
    refresh: t => refreshTokens(fetch, connector, creds, t),
  }, c.sealedTokens, access => fn(bearerCall(fetch, access), c));
}

// ── Search and browse (read-only, current person's permissions) ─────────────
export interface SearchInput { query: string; project?: string | null; site?: string | null; type?: string | null; status?: string | null }
export async function searchConnector(connector: Connector, input: SearchInput): Promise<SearchOutcome> {
  const ctx = await requireWorkspaceAccess(); await guard(ctx);
  return withConnection(ctx, connector, async (call, c) => {
    if (connector === "JIRA") return searchIssuesPage(call, siteOf(c, input.site), input.query, input.project || null, { type: input.type || null, status: input.status || null });
    if (connector === "GMAIL") return searchThreads(call, input.query);
    if (connector === "GOOGLE_DRIVE") return searchFilesPage(call, input.query);
    throw new ConnectorError("INVALID_REQUEST");
  });
}
function siteOf(c: Connection, siteId: string | null | undefined) { const s = c.sites.find(x => x.id === siteId) ?? c.sites[0]; if (!s) throw new ConnectorError("NO_ACCESS"); return s; }
export async function jiraProjects(siteId: string | null): Promise<{ key: string; name: string }[]> {
  const ctx = await requireWorkspaceAccess(); await guard(ctx);
  return withConnection(ctx, "JIRA", (call, c) => listProjects(call, siteOf(c, siteId)));
}
export async function figmaOutline(link: string): Promise<FigmaOutline & { selectedNodeId: string | null }> {
  const ctx = await requireWorkspaceAccess(); await guard(ctx);
  const { fileKey, nodeId } = parseFigmaLink(link);
  return { ...(await withConnection(ctx, "FIGMA", call => fileOutline(call, fileKey))), selectedNodeId: nodeId };
}

async function snapshotFor(connector: Connector, call: ProviderCall, c: Connection, reference: string, opts: { site?: string | null; providerWorkspace?: string; includeComments?: boolean }): Promise<ProviderSnapshot> {
  if (connector === "JIRA") { const site = opts.providerWorkspace ? c.sites.find(s => new URL(s.url).host === opts.providerWorkspace) : siteOf(c, opts.site); if (!site) throw new ConnectorError("NO_ACCESS"); return issueSnapshot(call, site, reference); }
  if (connector === "GMAIL") {
    // Thread ids belong to one mailbox: only the person who imported a thread can refresh it.
    if (opts.providerWorkspace && opts.providerWorkspace.toLowerCase() !== (c.accountLabel ?? "").toLowerCase()) throw new ConnectorError("NO_ACCESS");
    return threadSnapshot(call, c.accountLabel ?? "gmail", reference);
  }
  if (connector === "GOOGLE_DRIVE") return fileSnapshot(call, reference);
  const [fileKey, nodeId] = reference.split("#"); if (!fileKey || !nodeId) throw new ConnectorError("INVALID_REQUEST");
  return frameSnapshot(call, fileKey, nodeId, opts.includeComments ?? false);
}

/** Internal worker read only. Authorization and atomic publication belong to the job runner. */
export async function backgroundJiraSnapshot(ctx: WorkspaceAccess, reference: string, providerWorkspace: string): Promise<ProviderSnapshot> {
  await guard(ctx);
  return withConnection(ctx, "JIRA", (call, c) => snapshotFor("JIRA", call, c, reference, { providerWorkspace }));
}

// ── Import and refresh: Source / Evidence only ──────────────────────────────
interface HostedResult { submissionId: string; changed: boolean; replay: boolean }
async function persistSnapshot(ctx: WorkspaceAccess, initiativeId: string, mode: "IMPORT" | "REFRESH", role: SourceRole, snap: ProviderSnapshot): Promise<HostedResult> {
  const requestId = randomUUID();
  if (isLocalAuth()) return withRepositoryContext(ctx, async () => writeStoreAtomic(s => applyConnectorSnapshot(s, ctx, { initiativeId, requestId, mode, role, snapshot: snap }, new Date().toISOString())));
  const { sha256Utf8 } = await import("@/lib/evidence/anchor");
  const { data, error } = await adminClient().rpc("import_connector_snapshot", { p_workspace_id: ctx.workspaceId, p_member_id: ctx.memberId ?? ctx.actor.id, p_input: {
    initiativeId, requestId, mode, role, connector: snap.connector, provider: snap.provider, providerWorkspace: snap.providerWorkspace, containerReference: snap.containerReference, containerName: snap.containerName,
    item: snap.item, title: snap.title, text: snap.text, textSha256: sha256Utf8(snap.text), charLength: snap.text.length, evidenceSourceType: snap.evidenceSourceType, externalUpdatedAt: snap.externalUpdatedAt, occurredAt: snap.occurredAt } }).abortSignal(AbortSignal.timeout(30000));
  // Bounded: a stalled database call must end in an answer. It may have committed; an unchanged re-import saves nothing new.
  if (error && /abort|timeout/i.test(`${error.message} ${error.details ?? ""}`)) throw new Error("Saving the snapshot took too long. It may still have been saved — check Sources before retrying; an unchanged re-import saves nothing new.");
  if (error) throw new Error(error.message.includes("EXPLICIT_RELINK") ? "This source was unlinked earlier. Relink it from Sources before importing it again." : error.message.includes("VIEW_ONLY") ? "Viewers can read sources but cannot import them." : error.message.includes("ARCHIVED") ? "Archived — restore the initiative to import sources. Nothing was changed." : "The import was refused. Reload and check your access; nothing was saved.");
  return data as HostedResult;
}

export type ImportStage = "READING" | "SAVING";
export interface ImportOutcome { reference: string; name: string; ok: boolean; changed: boolean; submissionId: string | null; code: ConnectorErrorCode | null; message: string | null }
/**
 * Imports ONE selected item as a Source + Evidence snapshot, reporting each real step.
 * The browser imports a selection one item at a time, so progress is observed, not estimated.
 * Every call re-checks write access, the Demo guard and the person's own connection.
 */
export async function importItem(input: { initiativeId: string; connector: Connector; reference: string; role: SourceRole; site?: string | null; includeComments?: boolean }, onStage: (stage: ImportStage) => void = () => {}): Promise<ImportOutcome> {
  const ctx = await requireBusinessWriteAccess(); await guard(ctx);
  const reference = input.reference.trim();
  if (!reference || reference.length > 300) throw new ConnectorError("INVALID_REQUEST");
  try {
    onStage("READING");
    const snap = await withConnection(ctx, input.connector, (call, c) => snapshotFor(input.connector, call, c, reference, { site: input.site, includeComments: input.includeComments }));
    onStage("SAVING");
    const r = await persistSnapshot(ctx, input.initiativeId, "IMPORT", input.role, snap);
    return { reference, name: snap.item.name, ok: true, changed: r.changed, submissionId: r.submissionId, code: null, message: r.changed ? null : "Already imported and unchanged; no new snapshot was saved." };
  } catch (e) {
    return { reference, name: reference, ok: false, changed: false, submissionId: null, code: e instanceof ConnectorError ? e.code : null, message: e instanceof ConnectorError ? null : safeMessage(e, "The item could not be imported.") };
  }
}

export interface SyncView extends SourceItemSync { itemName: string; itemReference: string; itemUrl: string | null; snapshots: number; latestTitle: string | null }
export async function readSyncs(initiativeId: string): Promise<SyncView[]> {
  const ctx = await requireWorkspaceAccess();
  let syncs: SourceItemSync[], counts: Map<string, number>; const titles = new Map<string, string>();
  if (isLocalAuth()) {
    const s = await withRepositoryContext(ctx, async () => readStore());
    syncs = (s.sourceItemSyncs ?? []).filter(x => x.workspaceId === ctx.workspaceId && x.initiativeId === initiativeId);
    counts = new Map(); for (const sub of s.evidenceSubmissions ?? []) if (sub.workspaceId === ctx.workspaceId && sub.initiativeId === initiativeId && sub.origin) counts.set(sub.sourceItemId, (counts.get(sub.sourceItemId) ?? 0) + 1);
    for (const x of syncs) { const t = s.evidenceSubmissions?.find(sub => sub.id === x.lastSubmissionId)?.title; if (t) titles.set(x.id, t); }
  } else {
    const db = adminClient();
    const [{ data, error }, subs] = await Promise.all([db.from("source_item_syncs").select("*").eq("workspace_id", ctx.workspaceId).eq("initiative_id", initiativeId), db.from("evidence_submissions").select("data->>sourceItemId").eq("workspace_id", ctx.workspaceId).eq("initiative_id", initiativeId).not("data->origin", "is", null)]);
    if (error) return [];
    syncs = (data as Record<string, unknown>[]).map(r => ({ id: String(r.id), workspaceId: String(r.workspace_id), initiativeId: String(r.initiative_id), itemId: String(r.item_id), connector: r.connector as Connector, externalUpdatedAt: (r.external_updated_at as string) ?? null, contentSha256: String(r.content_sha256), lastSubmissionId: String(r.last_submission_id), lastSyncedAt: String(r.last_synced_at), lastSyncedBy: String(r.last_synced_by), lastCheckedAt: String(r.last_checked_at), status: r.status as SourceItemSync["status"], revision: Number(r.revision) }));
    counts = new Map(); for (const row of (subs.data ?? []) as Record<string, string>[]) { const id = Object.values(row)[0]; if (id) counts.set(id, (counts.get(id) ?? 0) + 1); }
    if (syncs.length) { const { data: latest } = await db.from("evidence_submissions").select("id,title:data->>title").eq("workspace_id", ctx.workspaceId).in("id", syncs.map(x => x.lastSubmissionId)); for (const r of (latest ?? []) as { id: string; title: string }[]) { const x = syncs.find(y => y.lastSubmissionId === r.id); if (x && r.title) titles.set(x.id, r.title); } }
  }
  const m = await readManagement();
  return syncs.map(x => { const item = m.items.find(i => i.id === x.itemId); return { ...x, itemName: item?.name ?? "Source", itemReference: item?.reference ?? "", itemUrl: item?.url ?? null, snapshots: counts.get(x.itemId) ?? 1, latestTitle: titles.get(x.id) ?? null }; });
}

export async function refreshSource(initiativeId: string, itemId: string): Promise<{ changed: boolean; submissionId: string | null; code: string | null }> {
  const ctx = await requireBusinessWriteAccess(); await guard(ctx);
  const sync = (await readSyncs(initiativeId)).find(x => x.itemId === itemId); if (!sync) throw new ConnectorError("INVALID_REQUEST");
  const m = await readManagement(); const item = m.items.find(i => i.id === itemId), container = m.containers.find(c => c.id === item?.containerId);
  if (!item || !container) throw new ConnectorError("INVALID_REQUEST");
  let includeComments = false;
  if (sync.connector === "FIGMA") includeComments = !(await previousText(ctx, sync.lastSubmissionId)).includes("Comments were not included.");
  try {
    const snap = await withConnection(ctx, sync.connector, (call, c) => snapshotFor(sync.connector, call, c, item.reference, { providerWorkspace: container.providerWorkspace, includeComments }));
    const r = await persistSnapshot(ctx, initiativeId, "REFRESH", "GENERAL", snap);
    return { changed: r.changed, submissionId: r.submissionId, code: null };
  } catch (e) {
    if (!(e instanceof ConnectorError) || !["NOT_FOUND", "NO_ACCESS", "PROVIDER_UNAVAILABLE", "RATE_LIMITED"].includes(e.code)) throw e;
    const status = e.code === "NOT_FOUND" ? "NOT_FOUND" : e.code === "NO_ACCESS" ? "NO_ACCESS" : "FAILED";
    if (isLocalAuth()) await withRepositoryContext(ctx, async () => writeStoreAtomic(s => applySourceCheck(s, ctx, initiativeId, itemId, status, new Date().toISOString())));
    else await adminClient().rpc("record_source_check", { p_workspace_id: ctx.workspaceId, p_member_id: ctx.memberId ?? ctx.actor.id, p_input: { initiativeId, itemId, status } });
    return { changed: false, submissionId: null, code: e.code };
  }
}
async function previousText(ctx: WorkspaceAccess, submissionId: string): Promise<string> {
  if (isLocalAuth()) return (await withRepositoryContext(ctx, async () => readStore())).evidenceSubmissions?.find(s => s.id === submissionId && s.workspaceId === ctx.workspaceId)?.text ?? "";
  const { data } = await adminClient().from("evidence_submissions").select("data->>text").eq("id", submissionId).eq("workspace_id", ctx.workspaceId).maybeSingle();
  return data ? String(Object.values(data as Record<string, string>)[0] ?? "") : "";
}
