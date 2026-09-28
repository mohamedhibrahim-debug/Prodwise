import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { open, seal, tokenKey } from "./crypto.ts";
import { authorizeUrl, credentialsFor, exchangeCode, publicOrigin, redirectUri, refreshTokens } from "./oauth.ts";
import { bearerCall, capText } from "./http.ts";
import { adfToText, issueSnapshot, searchIssues, searchJql, sitesFrom } from "./jira.ts";
import { messageText, searchQuery, stripQuoted, threadSnapshot } from "./gmail.ts";
import { driveQuery, fileSnapshot } from "./drive.ts";
import { frameSnapshot, parseFigmaLink, textLayers } from "./figma.ts";
import { ConnectorError, connectorFromSlug, connectorMessage } from "./types.ts";

const key = randomBytes(32);
const site = { id: "11111111-2222-3333-4444-555555555555", url: "https://synthetic.atlassian.example", name: "Synthetic" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
/** Records requests and answers from a table keyed by URL substring. */
function fakeFetch(routes: [string, (init?: RequestInit) => Response][]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const f = (async (url: string, init?: RequestInit) => { calls.push({ url, init }); const r = routes.find(([m]) => url.includes(m)); if (!r) throw new Error(`unrouted ${url}`); return r[1](init); }) as unknown as typeof fetch;
  return { f, calls };
}

test("sealed tokens open only with the same key and the same owner binding", () => {
  const sealed = seal(key, { accessToken: "a", refreshToken: "r", expiresAt: 1 }, "org:user:JIRA");
  assert.ok(!sealed.includes("\"a\""));
  assert.deepEqual(open(key, sealed, "org:user:JIRA"), { accessToken: "a", refreshToken: "r", expiresAt: 1 });
  assert.throws(() => open(key, sealed, "org:other:JIRA"));
  assert.throws(() => open(randomBytes(32), sealed, "org:user:JIRA"));
  assert.equal(tokenKey("short"), null);
  assert.ok(tokenKey(key.toString("base64")));
});

test("OAuth: configuration is required, https callbacks only, read-only scopes, PKCE where supported", () => {
  assert.equal(credentialsFor("JIRA", {}), null);
  assert.equal(publicOrigin("http://prod.example"), null);
  assert.equal(publicOrigin("https://user:pw@prod.example"), null);
  assert.equal(publicOrigin("http://localhost:3000"), "http://localhost:3000");
  const origin = publicOrigin("https://prodwise.example/ignored")!;
  assert.equal(redirectUri(origin, "GOOGLE_DRIVE"), "https://prodwise.example/api/connectors/google-drive/callback");
  const jira = new URL(authorizeUrl("JIRA", { clientId: "c", clientSecret: "s" }, redirectUri(origin, "JIRA"), "st", null));
  assert.equal(jira.searchParams.get("audience"), "api.atlassian.com");
  assert.equal(jira.searchParams.get("scope"), "read:jira-work read:jira-user offline_access");
  const gmail = new URL(authorizeUrl("GMAIL", { clientId: "c", clientSecret: "s" }, redirectUri(origin, "GMAIL"), "st", "challenge"));
  assert.ok(gmail.searchParams.get("scope")!.includes("gmail.readonly") && !gmail.searchParams.get("scope")!.includes("gmail.send") && !gmail.searchParams.get("scope")!.includes("gmail.modify"));
  assert.equal(gmail.searchParams.get("code_challenge_method"), "S256");
  const figma = new URL(authorizeUrl("FIGMA", { clientId: "c", clientSecret: "s" }, redirectUri(origin, "FIGMA"), "st", "ch"));
  assert.ok(!figma.searchParams.get("scope")!.includes("write"));
  assert.equal(connectorFromSlug("google-drive"), "GOOGLE_DRIVE");
  assert.equal(connectorFromSlug("slack"), null);
});

test("OAuth: token exchange, rotating refresh, and expired grants ask for reconnect without echoing provider text", async () => {
  const { f, calls } = fakeFetch([["auth.atlassian.com/oauth/token", init => { const b = JSON.parse(String(init!.body)); return b.grant_type === "refresh_token" ? json({ access_token: "a2", refresh_token: "r2", expires_in: 3600 }) : json({ access_token: "a1", refresh_token: "r1", expires_in: 3600 }); }]]);
  const t = await exchangeCode(f, "JIRA", { clientId: "c", clientSecret: "s" }, "code", "https://x/cb", null, 0);
  assert.deepEqual(t, { accessToken: "a1", refreshToken: "r1", expiresAt: 3_600_000 });
  assert.equal(JSON.parse(String(calls[0]!.init!.body)).client_secret, "s");
  assert.equal((await refreshTokens(f, "JIRA", { clientId: "c", clientSecret: "s" }, t)).refreshToken, "r2");
  const denied = fakeFetch([["oauth2.googleapis.com/token", () => json({ error: "invalid_grant", error_description: "Token has been expired or revoked." }, 400)]]);
  await assert.rejects(refreshTokens(denied.f, "GMAIL", { clientId: "c", clientSecret: "s" }, { accessToken: "a", refreshToken: "r", expiresAt: 0 }), (e: unknown) => e instanceof ConnectorError && e.code === "NEEDS_RECONNECT" && !e.message.includes("expired"));
  const figma = fakeFetch([["api.figma.com/v1/oauth/token", init => { assert.match(String((init!.headers as Record<string, string>).authorization), /^Basic /); assert.ok(String(init!.body).includes("code_verifier=v")); return json({ access_token: "f", refresh_token: "fr", expires_in: 7776000 }); }]]);
  await exchangeCode(figma.f, "FIGMA", { clientId: "c", clientSecret: "s" }, "code", "https://x/cb", "v");
});

test("provider HTTP status maps to a plain next step, never a provider body", async () => {
  for (const [status, code] of [[401, "NEEDS_RECONNECT"], [403, "NO_ACCESS"], [404, "NOT_FOUND"], [429, "RATE_LIMITED"], [503, "PROVIDER_UNAVAILABLE"]] as const) {
    const { f } = fakeFetch([["x.example", () => json({ errorMessages: ["internal detail"] }, status)]]);
    await assert.rejects(bearerCall(f, "tok")("https://x.example/a"), (e: unknown) => e instanceof ConnectorError && e.code === code);
  }
  const offline = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
  await assert.rejects(bearerCall(offline, "tok")("https://x.example/a"), (e: unknown) => e instanceof ConnectorError && e.code === "PROVIDER_UNAVAILABLE");
  assert.ok(!connectorMessage("NEEDS_RECONNECT", "JIRA").includes("tok"));
  assert.match(connectorMessage("NOT_FOUND", "FIGMA"), /last saved snapshot is kept/);
});

test("Jira: JQL is quoted and stripped of operators; sites need read access", () => {
  assert.equal(searchJql("PAY-12", null), 'key = "PAY-12" ORDER BY updated DESC');
  assert.equal(searchJql('fee" OR project = SECRET', "PAY"), 'project = "PAY" AND text ~ "fee OR project SECRET" ORDER BY updated DESC');
  assert.throws(() => searchJql("", null));
  assert.throws(() => searchJql("x", "pay; drop"));
  assert.deepEqual(sitesFrom([{ id: "a", url: "https://a.example", name: "A", scopes: ["read:jira-work"] }, { id: "b", url: "http://b.example", name: "B" }, { id: "c", url: "https://c.example", name: "C", scopes: ["read:confluence"] }]).map(s => s.id), ["a"]);
});

test("Jira: issue snapshot keeps status as evidence, links, children and ADF text", async () => {
  const issue = { key: "PAY-7", fields: { summary: "Fee table", project: { key: "PAY", name: "Payments" }, issuetype: { name: "Epic" }, status: { name: "In Progress", statusCategory: { name: "In Progress" } }, duedate: "2026-10-01", updated: "2026-09-20T10:00:00.000+0000", created: "2026-08-01T10:00:00.000+0000",
    fixVersions: [{ name: "R1", releaseDate: "2026-10-15" }], issuelinks: [{ type: { outward: "blocks", inward: "is blocked by" }, inwardIssue: { key: "OPS-3", fields: { summary: "Partner cut-off", status: { name: "To Do" } } } }],
    description: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Fee is " }, { type: "text", text: "1.5%" }] }, { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "cap applies" }] }] }] }] },
    comment: { comments: [{ created: "2026-09-19T08:00:00.000+0000", author: { displayName: "Synthetic Person" }, body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Finance to confirm" }] }] } }] } } };
  const { f, calls } = fakeFetch([["/issue/PAY-7", () => json(issue)], ["/search/jql", () => json({ issues: [{ fields: { status: { statusCategory: { name: "Done" } } } }, { fields: { status: { statusCategory: { name: "To Do" } } } }], isLast: true })]]);
  const snap = await issueSnapshot(bearerCall(f, "t"), site, "PAY-7");
  assert.equal(snap.providerWorkspace, "synthetic.atlassian.example");
  assert.equal(snap.item.url, "https://synthetic.atlassian.example/browse/PAY-7");
  assert.match(snap.text, /not a Prodwise decision/);
  assert.match(snap.text, /is blocked by OPS-3 Partner cut-off \(To Do\)/);
  assert.match(snap.text, /2 child work items \(Done 1 · To Do 1\)/);
  assert.match(snap.text, /Fee is 1\.5%\n- cap applies/);
  assert.match(snap.text, /Synthetic Person: Finance to confirm/);
  assert.ok(calls.every(c => (c.init?.headers as Record<string, string>).authorization === "Bearer t"));
  await assert.rejects(issueSnapshot(bearerCall(f, "t"), site, "../admin"), (e: unknown) => e instanceof ConnectorError && e.code === "INVALID_REQUEST");
});

test("Jira: search results are metadata lines with links", async () => {
  const { f } = fakeFetch([["/search/jql", () => json({ issues: [{ key: "PAY-8", fields: { summary: "Refund flow", status: { name: "Done" }, issuetype: { name: "Story" }, updated: "2026-09-01T00:00:00.000+0000" } }, { key: "bad key", fields: {} }] })]]);
  const r = await searchIssues(bearerCall(f, "t"), site, "refund", "PAY");
  assert.deepEqual(r.map(x => [x.reference, x.detail]), [["PAY-8", "Done · Unassigned"]]);
  assert.equal(adfToText(null), "");
});

test("Gmail: a search is required; quoted history and attachments are not read", async () => {
  assert.throws(() => searchQuery("  "));
  assert.equal(stripQuoted("Agreed.\n\nOn Mon, 1 Sept 2026 at 10:00 Someone <a@example.com> wrote:\n> old"), "Agreed.");
  const b64 = (s: string) => Buffer.from(s).toString("base64url");
  const { text, attachments } = messageText({ mimeType: "multipart/mixed", parts: [{ mimeType: "multipart/alternative", parts: [{ mimeType: "text/plain", body: { data: b64("Limit is 40 merchants.") } }, { mimeType: "text/html", body: { data: b64("<p>ignored</p>") } }] }, { mimeType: "application/pdf", filename: "terms.pdf", body: { size: 10 } }] });
  assert.equal(text, "Limit is 40 merchants.");
  assert.deepEqual(attachments, ["terms.pdf"]);
  const thread = { id: "18c0ffee00000001", messages: [{ internalDate: "1790000000000", payload: { headers: [{ name: "Subject", value: "Pilot scope" }, { name: "From", value: "Finance <f@example.com>" }], mimeType: "text/plain", body: { data: b64("Cap confirmed at 40.") } } }] };
  const { f } = fakeFetch([["/threads/18c0ffee00000001?format=full", () => json(thread)]]);
  const snap = await threadSnapshot(bearerCall(f, "t"), "me@example.com", "18c0ffee00000001");
  assert.equal(snap.evidenceSourceType, "EMAIL");
  assert.match(snap.text, /Cap confirmed at 40\./);
  await assert.rejects(threadSnapshot(bearerCall(f, "t"), "me@example.com", "../../x"));
});

test("Drive: Docs are exported as text; other files are link-and-details only and say so", async () => {
  assert.match(driveQuery("fee's table"), /name contains 'fee\\'s table'/);
  assert.throws(() => driveQuery("a"));
  const doc = fakeFetch([["/export?", () => new Response("Fee: 1.5%")], ["/files/DOC_ID_123456", () => json({ id: "DOC_ID_123456", name: "Pricing spec", mimeType: "application/vnd.google-apps.document", modifiedTime: "2026-09-10T10:00:00Z", webViewLink: "https://docs.example/d" })]]);
  const snap = await fileSnapshot(bearerCall(doc.f, "t"), "DOC_ID_123456");
  assert.match(snap.text, /Fee: 1\.5%/);
  const pdf = fakeFetch([["/files/PDF_ID_123456", () => json({ id: "PDF_ID_123456", name: "Scan", mimeType: "application/pdf" })]]);
  const p = await fileSnapshot(bearerCall(pdf.f, "t"), "PDF_ID_123456");
  assert.match(p.text, /Content not read/);
  assert.equal(pdf.calls.length, 1, "the PDF body is never downloaded");
});

test("Figma: links parse to file + frame; frame text and pinned open comments only; never approval", async () => {
  assert.deepEqual(parseFigmaLink("https://www.figma.com/design/AbCdEf123456/Checkout?node-id=12-34&t=x"), { fileKey: "AbCdEf123456", nodeId: "12:34" });
  assert.throws(() => parseFigmaLink("https://evil.example/design/AbCdEf123456/x"));
  const frame = { id: "12:34", name: "Receipt", type: "FRAME", children: [{ id: "12:35", type: "TEXT", name: "Title", characters: "Your receipt" }, { id: "12:36", type: "GROUP", children: [{ id: "12:37", type: "TEXT", name: "12:37", characters: "Merchant name" }] }] };
  assert.deepEqual(textLayers(frame), ["- Title: Your receipt", "- 12:37: Merchant name"]);
  const { f } = fakeFetch([["/nodes?ids=", () => json({ nodes: { "12:34": { document: frame } } })], ["/comments", () => json({ comments: [{ id: "c1", message: "Show merchant name", client_meta: { node_id: "12:37" }, user: { handle: "designer" }, created_at: "2026-09-20T00:00:00Z" }, { id: "c2", message: "Elsewhere", client_meta: { node_id: "99:1" } }, { id: "c3", message: "done", client_meta: { node_id: "12:35" }, resolved_at: "2026-09-21T00:00:00Z" }] })], ["/files/AbCdEf123456?depth=1", () => json({ name: "Checkout", lastModified: "2026-09-22T00:00:00Z" })]]);
  const snap = await frameSnapshot(bearerCall(f, "t"), "AbCdEf123456", "12:34", true);
  assert.equal(snap.evidenceSourceType, "DESIGN");
  assert.equal(snap.item.reference, "AbCdEf123456#12:34");
  assert.match(snap.text, /not a design approval/);
  assert.match(snap.text, /designer: Show merchant name/);
  assert.ok(!snap.text.includes("Elsewhere") && !snap.text.includes("done"));
  assert.ok(!snap.text.includes("2026-09-22"), "file-level modified time is metadata, not frame content");
});

test("snapshots are capped at the evidence limit and say so", () => {
  const t = capText("x".repeat(30000));
  assert.ok(t.length <= 20000 && /shortened/.test(t));
});

import { withTokens, type TokenStore } from "./token-lifecycle.ts";
/** In-memory token store: sealed = JSON, so tests can see exactly what was written. */
function memoryStore(initial: { accessToken: string; refreshToken: string | null; expiresAt: number | null }, refresh: TokenStore["refresh"]) {
  const state = { connected: true, sealed: JSON.stringify(initial) as string | null, expired: false, saves: 0 };
  const store: TokenStore = {
    current: async () => ({ connected: state.connected, sealed: state.sealed }),
    open: s => JSON.parse(s), seal: t => JSON.stringify(t),
    save: async s => { state.saves++; state.sealed = s; },
    expire: async () => { state.expired = true; state.connected = false; state.sealed = null; },
    refresh,
  };
  return { store, state };
}

test("token lifecycle: refresh before expiry and persist the rotated token", async () => {
  const { store, state } = memoryStore({ accessToken: "old", refreshToken: "r1", expiresAt: 10 }, async () => ({ accessToken: "new", refreshToken: "r2", expiresAt: 999999 }));
  assert.equal(await withTokens(store, state.sealed!, async a => a, () => 0), "new");
  assert.equal(JSON.parse(state.sealed!).refreshToken, "r2");
});

test("token lifecycle: one refresh and retry on 401; a dead grant expires the connection", async () => {
  let calls = 0;
  const ok = memoryStore({ accessToken: "a", refreshToken: "r", expiresAt: null }, async () => ({ accessToken: "b", refreshToken: "r2", expiresAt: null }));
  assert.equal(await withTokens(ok.store, ok.state.sealed!, async a => { calls++; if (a === "a") throw new ConnectorError("NEEDS_RECONNECT"); return a; }), "b");
  assert.equal(calls, 2);
  const dead = memoryStore({ accessToken: "a", refreshToken: "r", expiresAt: null }, async () => { throw new ConnectorError("NEEDS_RECONNECT"); });
  await assert.rejects(withTokens(dead.store, dead.state.sealed!, async () => { throw new ConnectorError("NEEDS_RECONNECT"); }), (e: unknown) => e instanceof ConnectorError && e.code === "NEEDS_RECONNECT");
  assert.equal(dead.state.expired, true);
});

test("token lifecycle: a concurrent rotation elsewhere is used instead of expiring", async () => {
  const m = memoryStore({ accessToken: "a", refreshToken: "r1", expiresAt: 10 }, async () => {
    // Another tab refreshed first: r1 is now invalid and the store holds r2.
    m.state.sealed = JSON.stringify({ accessToken: "other", refreshToken: "r2", expiresAt: 999999 });
    throw new ConnectorError("NEEDS_RECONNECT");
  });
  assert.equal(await withTokens(m.store, m.state.sealed!, async a => a, () => 0), "other");
  assert.equal(m.state.expired, false);
  assert.equal(JSON.parse(m.state.sealed!).refreshToken, "r2");
});

test("token lifecycle: a disconnect made during refresh wins; tokens are never written back", async () => {
  const m = memoryStore({ accessToken: "a", refreshToken: "r1", expiresAt: 10 }, async () => { m.state.connected = false; m.state.sealed = null; return { accessToken: "b", refreshToken: "r2", expiresAt: 999999 }; });
  await assert.rejects(withTokens(m.store, m.state.sealed!, async a => a, () => 0), (e: unknown) => e instanceof ConnectorError && e.code === "NOT_CONNECTED");
  assert.equal(m.state.sealed, null); assert.equal(m.state.saves, 0);
});
