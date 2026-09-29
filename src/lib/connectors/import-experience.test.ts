import test from "node:test";
import assert from "node:assert/strict";
import { bearerCall, settleLimited } from "./http.ts";
import { searchIssuesPage, searchJql } from "./jira.ts";
import { searchThreads } from "./gmail.ts";
import { callbackErrorCode, PROVIDERS } from "./oauth.ts";
import { ConnectorError, CONNECTORS, connectorMessage, REQUIRED_ACCESS } from "./types.ts";
import { facets, filterRows, jiraTypeBadge, selectVisible, statusTone, toggleSelection, typeOptions, type ImportRow } from "./import-view.ts";
import { createWatchdog, EMPTY_PROGRESS, nextQueued, progressReducer, summarize, type ProgressState, type Timers } from "./import-progress.ts";
import { fixtureCall, fixtureJql, fixturesEnabled, FIXTURE_SITE } from "./local-fixtures.ts";

const site = { id: "s1", url: "https://synthetic.atlassian.example", name: "Synthetic" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const row = (reference: string, type: string | null, category: "new" | "indeterminate" | "done" | null, extra: Partial<ImportRow> = {}): ImportRow => ({
  reference, name: `Item ${reference}`, kind: type ?? "Issue", url: null, updatedAt: null, detail: "",
  jira: { key: reference, type, subtask: false, status: category ? "Some status" : null, statusCategory: category, assignee: reference === "A-1" ? "Synthetic Person" : null, dueDate: null, project: { key: reference.split("-")[0]!, name: "Proj" }, parent: null }, ...extra,
});

// ── Jira: type badges come from the API name, never inferred ────────────────
test("type badge: standard Jira types get their own tone; anything else keeps its real name on a neutral badge", () => {
  assert.deepEqual(jiraTypeBadge("Epic"), { tone: "epic", label: "Epic" });
  assert.deepEqual(jiraTypeBadge("story"), { tone: "story", label: "story" });
  assert.deepEqual(jiraTypeBadge("Sub-task"), { tone: "subtask", label: "Sub-task" });
  assert.deepEqual(jiraTypeBadge("Subtask"), { tone: "subtask", label: "Subtask" });
  assert.deepEqual(jiraTypeBadge("Initiative"), { tone: "initiative", label: "Initiative" });
  assert.deepEqual(jiraTypeBadge("Spike"), { tone: "other", label: "Spike" });
  // "Epic-ish" names are not guessed to be epics.
  assert.deepEqual(jiraTypeBadge("Epic Feature"), { tone: "other", label: "Epic Feature" });
  // Jira's own sub-task flag marks a renamed sub-task type; the label stays Jira's.
  assert.deepEqual(jiraTypeBadge("Technical work", true), { tone: "subtask", label: "Technical work" });
  assert.deepEqual(jiraTypeBadge(null), { tone: "other", label: "Type not returned" });
  assert.equal(statusTone("done"), "done"); assert.equal(statusTone("indeterminate"), "progress"); assert.equal(statusTone("new"), "todo"); assert.equal(statusTone(null), "unknown");
});

test("Jira search carries the issue's own fields: type, status category, assignee, due, project and parent", async () => {
  let sent: { jql: string; fields: string[] } | null = null;
  const f = (async (_u: string, init?: RequestInit) => { sent = JSON.parse(String(init!.body)); return json({ isLast: false, issues: [{ key: "PAY-8", fields: { summary: "Refund flow", status: { name: "In Review", statusCategory: { key: "indeterminate" } }, issuetype: { name: "Story", subtask: false }, assignee: { displayName: "Synthetic Person" }, duedate: "2026-10-01", updated: "2026-09-01T00:00:00.000+0000", project: { key: "PAY", name: "Payments" }, parent: { key: "PAY-1", fields: { summary: "Refunds epic" } } } }, { key: "PAY-9", fields: { summary: "x", status: { name: "Odd", statusCategory: { key: "undefined" } }, duedate: "not a date", parent: { key: "../x" } } }] }); }) as unknown as typeof fetch;
  const r = await searchIssuesPage(bearerCall(f, "t"), site, "refund", "PAY", { type: "Epic" });
  assert.ok(sent!.fields.includes("parent") && sent!.fields.includes("project"));
  assert.match(sent!.jql, /issuetype = "Epic"/);
  assert.equal(r.more, true);
  assert.deepEqual(r.results[0]!.jira, { key: "PAY-8", type: "Story", subtask: false, status: "In Review", statusCategory: "indeterminate", assignee: "Synthetic Person", dueDate: "2026-10-01", project: { key: "PAY", name: "Payments" }, parent: { key: "PAY-1", summary: "Refunds epic" } });
  // Unknown category, malformed date and unsafe parent key are dropped, not guessed.
  assert.deepEqual([r.results[1]!.jira!.statusCategory, r.results[1]!.jira!.dueDate, r.results[1]!.jira!.parent, r.results[1]!.jira!.type], [null, null, null, null]);
});

test("Jira filters stay injection-safe: types are allowlisted names, status is a fixed category id", () => {
  assert.equal(searchJql("", "PAY", { type: "Epic" }), 'project = "PAY" AND issuetype = "Epic" ORDER BY updated DESC');
  assert.equal(searchJql("fee", null, { type: "subtask", status: "done" }), 'issuetype in subTaskIssueTypes() AND statusCategory = 3 AND text ~ "fee" ORDER BY updated DESC');
  assert.equal(searchJql("", "PAY", { status: "indeterminate" }), 'project = "PAY" AND statusCategory = 4 ORDER BY updated DESC');
  assert.throws(() => searchJql("fee", null, { type: 'Epic" OR project = "X' }), (e: unknown) => e instanceof ConnectorError && e.code === "INVALID_REQUEST");
  assert.throws(() => searchJql("fee", null, { status: "4 OR 1=1" }));
  // A type or status alone would list a whole site.
  assert.throws(() => searchJql("", null, { type: "Epic" }));
});

// ── Narrowing loaded results ─────────────────────────────────────────────────
test("filtering: by type, status category, project and words; facets count what is loaded", () => {
  const rows = [row("A-1", "Epic", "indeterminate"), row("A-2", "Story", "done"), row("A-3", "Story", "new"), row("B-4", "Bug", null)];
  assert.deepEqual(filterRows(rows, { type: "story" }).map(r => r.reference), ["A-2", "A-3"]);
  assert.deepEqual(filterRows(rows, { status: "done" }).map(r => r.reference), ["A-2"]);
  assert.deepEqual(filterRows(rows, { status: "unknown" }).map(r => r.reference), ["B-4"]);
  assert.deepEqual(filterRows(rows, { project: "B" }).map(r => r.reference), ["B-4"]);
  assert.deepEqual(filterRows(rows, { text: "synthetic a-1" }).map(r => r.reference), ["A-1"]);
  assert.deepEqual(filterRows(rows, {}).length, 4);
  const f = facets(rows);
  assert.deepEqual(f.types.map(t => [t.value, t.count]), [["Story", 2], ["Bug", 1], ["Epic", 1]]);
  assert.deepEqual(f.statuses.find(s => s.value === "unknown"), { value: "unknown", label: "Status not returned", count: 1 });
  assert.deepEqual(typeOptions([row("C-1", "Spike", null)], null).map(o => o.value).slice(-2), ["Initiative", "Spike"]);
  const generic: ImportRow[] = [{ reference: "t1", name: "Pilot scope", kind: "Email thread", url: null, updatedAt: null, detail: "From Finance" }];
  assert.equal(filterRows(generic, { text: "finance" }).length, 1);
  assert.equal(filterRows(generic, { type: "Email thread" }).length, 1);
});

test("selection is explicit and capped per batch, and the cap is reported, not silent", () => {
  let s = toggleSelection([], "A").selected; s = toggleSelection(s, "B").selected;
  assert.deepEqual(toggleSelection(s, "A").selected, ["B"]);
  assert.deepEqual(toggleSelection(["1", "2"], "3", 2), { selected: ["1", "2"], refused: true });
  assert.deepEqual(selectVisible(["x"], ["a", "b", "c"], 3), ["x", "a", "b"]);
});

// ── Progress state machine ───────────────────────────────────────────────────
test("progress: queued → importing → saving → imported / already imported / failed, with real counts", () => {
  let s: ProgressState = progressReducer(EMPTY_PROGRESS, { type: "QUEUE", items: [{ reference: "A", name: "a" }, { reference: "B", name: "b" }, { reference: "C", name: "c" }, { reference: "A", name: "dup" }] });
  assert.equal(s.items.length, 3);
  assert.equal(summarize(s).line, "Importing 1 of 3");
  assert.equal(nextQueued(s)!.reference, "A");
  s = progressReducer(s, { type: "STAGE", reference: "A", attempt: 1, stage: "IMPORTING" });
  assert.equal(nextQueued(s), null, "one at a time");
  s = progressReducer(s, { type: "STAGE", reference: "A", attempt: 1, stage: "SAVING" });
  assert.equal(s.items[0]!.phase, "SAVING");
  s = progressReducer(s, { type: "DONE", reference: "A", attempt: 1, changed: true, submissionId: "sub-1", name: "LEND-10 real name" });
  assert.equal(s.items[0]!.name, "LEND-10 real name");
  assert.equal(summarize(s).line, "Importing 2 of 3");
  s = progressReducer(s, { type: "STAGE", reference: "B", attempt: 1, stage: "IMPORTING" });
  s = progressReducer(s, { type: "DONE", reference: "B", attempt: 1, changed: false, submissionId: "sub-0", message: "Already imported" });
  assert.equal(s.items[1]!.phase, "UNCHANGED");
  s = progressReducer(s, { type: "STAGE", reference: "C", attempt: 1, stage: "IMPORTING" });
  s = progressReducer(s, { type: "FAIL", reference: "C", attempt: 1, message: "Jira didn't respond.", code: "PROVIDER_UNAVAILABLE" });
  const sum = summarize(s);
  assert.equal(sum.running, false);
  assert.equal(sum.line, "Imported 2 of 3 · 1 failed");
  // Retry only re-queues the failed item, as a new attempt.
  s = progressReducer(s, { type: "RETRY", references: ["A", "C"] });
  assert.deepEqual(s.items.map(i => [i.phase, i.attempt]), [["IMPORTED", 1], ["UNCHANGED", 1], ["QUEUED", 2]]);
  // A late answer from the old attempt is ignored.
  s = progressReducer(s, { type: "DONE", reference: "C", attempt: 1, changed: true, submissionId: "late" });
  assert.equal(s.items[2]!.phase, "QUEUED");
  s = progressReducer(s, { type: "STAGE", reference: "C", attempt: 2, stage: "IMPORTING" });
  s = progressReducer(s, { type: "DONE", reference: "C", attempt: 2, changed: true, submissionId: "sub-2" });
  assert.equal(summarize(s).line, "Imported 3 of 3");
});

test("progress: slow → keep waiting or cancel; cancel wins over a late answer; stop leaves queued items not started", () => {
  let s = progressReducer(EMPTY_PROGRESS, { type: "QUEUE", items: [{ reference: "A", name: "a" }, { reference: "B", name: "b" }] });
  s = progressReducer(s, { type: "STAGE", reference: "A", attempt: 1, stage: "IMPORTING" });
  s = progressReducer(s, { type: "SLOW", reference: "A", attempt: 1 });
  assert.equal(s.items[0]!.slow, true);
  s = progressReducer(s, { type: "KEEP_WAITING", reference: "A" });
  assert.equal(s.items[0]!.slow, false);
  s = progressReducer(s, { type: "CANCEL", reference: "A", message: "Cancelled." });
  s = progressReducer(s, { type: "DONE", reference: "A", attempt: 1, changed: true, submissionId: "late" });
  assert.equal(s.items[0]!.phase, "CANCELLED");
  s = progressReducer(s, { type: "STOP_QUEUED", message: "Not started." });
  assert.deepEqual(s.items.map(i => i.phase), ["CANCELLED", "CANCELLED"]);
  assert.equal(summarize(s).line, "Imported 0 of 2 · 2 cancelled");
  // SLOW for an item that is not in flight is ignored.
  assert.equal(progressReducer(s, { type: "SLOW", reference: "B", attempt: 1 }).items[1]!.slow, false);
});

// ── Bounded waiting ──────────────────────────────────────────────────────────
function fakeTimers() {
  let now = 0, id = 0; const pending = new Map<number, { at: number; fn: () => void }>();
  const timers: Timers = { setTimeout: (fn, ms) => { pending.set(++id, { at: now + ms, fn }); return id; }, clearTimeout: t => { pending.delete(t as number); } };
  const advance = (ms: number) => { now += ms; for (const [k, t] of [...pending].sort((a, b) => a[1].at - b[1].at)) if (t.at <= now && pending.has(k)) { pending.delete(k); t.fn(); } };
  return { timers, advance, pending };
}
test("watchdog: asks after the soft deadline, ends by itself at the hard deadline, keep-waiting re-arms, stop clears", () => {
  const t = fakeTimers(); const log: string[] = [];
  const dog = createWatchdog({ softMs: 10, hardMs: 30, onSlow: () => log.push("slow"), onTimeout: () => log.push("timeout"), timers: t.timers });
  t.advance(9); assert.deepEqual(log, []);
  t.advance(1); assert.deepEqual(log, ["slow"]);
  dog.extend(); t.advance(25); assert.deepEqual(log, ["slow", "slow"], "keep waiting restarts both deadlines");
  t.advance(5); assert.deepEqual(log, ["slow", "slow", "timeout"]);
  t.advance(100); assert.equal(log.length, 3, "a finished watchdog never fires again");
  const t2 = fakeTimers(); const log2: string[] = [];
  const d2 = createWatchdog({ softMs: 10, hardMs: 30, onSlow: () => log2.push("slow"), onTimeout: () => log2.push("timeout"), timers: t2.timers });
  d2.stop(); t2.advance(100); assert.deepEqual(log2, []); assert.equal(t2.pending.size, 0);
});

// ── Provider calls are bounded and never all at once ─────────────────────────
test("settleLimited keeps at most N in flight and keeps each outcome", async () => {
  let inFlight = 0, peak = 0;
  const out = await settleLimited([1, 2, 3, 4, 5, 6, 7], 3, async n => { inFlight++; peak = Math.max(peak, inFlight); await new Promise(r => setTimeout(r, 2)); inFlight--; if (n === 4) throw new Error("x"); return n * 2; });
  assert.equal(peak, 3);
  assert.deepEqual(out.map(o => o.status), ["fulfilled", "fulfilled", "fulfilled", "rejected", "fulfilled", "fulfilled", "fulfilled"]);
});

test("Gmail search: one unreadable thread is counted, not silently dropped; all failing is a failed search", async () => {
  const ok = (id: string) => json({ id, messages: [{ internalDate: "1790000000000", payload: { headers: [{ name: "Subject", value: `S ${id}` }, { name: "From", value: "F" }] } }] });
  const f = (async (url: string) => url.includes("/threads?") ? json({ threads: [{ id: "aaaaaaaa00000001" }, { id: "aaaaaaaa00000002" }], nextPageToken: "n" }) : url.includes("00000002") ? json({}, 503) : ok("aaaaaaaa00000001")) as unknown as typeof fetch;
  const r = await searchThreads(bearerCall(f, "t"), "pilot scope");
  assert.deepEqual([r.results.length, r.omitted, r.more], [1, 1, true]);
  const dead = (async (url: string) => url.includes("/threads?") ? json({ threads: [{ id: "aaaaaaaa00000001" }] }) : json({}, 401)) as unknown as typeof fetch;
  await assert.rejects(searchThreads(bearerCall(dead, "t"), "pilot"), (e: unknown) => e instanceof ConnectorError && e.code === "NEEDS_RECONNECT");
});

test("a response body that stalls or breaks becomes PROVIDER_UNAVAILABLE, never an unhandled error", async () => {
  const broken = (async () => new Response("{not json", { status: 200 })) as unknown as typeof fetch;
  await assert.rejects(bearerCall(broken, "t")("https://x.example/a"), (e: unknown) => e instanceof ConnectorError && e.code === "PROVIDER_UNAVAILABLE");
});

// ── OAuth callback errors ────────────────────────────────────────────────────
test("OAuth: a refused scope gets its own safe message naming the read-only scopes the app must allow", () => {
  assert.equal(callbackErrorCode("invalid_scope", null), "SCOPE_REFUSED");
  assert.equal(callbackErrorCode("invalid_request", "Invalid scopes for app"), "SCOPE_REFUSED");
  assert.equal(callbackErrorCode("access_denied", "User denied the requested scopes"), "NOT_CONNECTED");
  assert.equal(callbackErrorCode("server_error", null), "NOT_CONNECTED");
  assert.equal(connectorMessage("SCOPE_REFUSED", "FIGMA"), "Figma refused the requested read-only access. The Figma app must allow: current_user:read, file_content:read, file_comments:read. Nothing was connected.");
  for (const c of CONNECTORS) assert.deepEqual(REQUIRED_ACCESS[c], PROVIDERS[c].scopes, `${c}: message scopes match the requested scopes`);
});

// ── Local fixtures: local development only ───────────────────────────────────
test("fixtures are active only with local auth AND the explicit flag, and never in production or hosted builds", () => {
  assert.equal(fixturesEnabled({ AUTH_MODE: "local", CONNECTOR_LOCAL_FIXTURES: "1", NODE_ENV: "development" }), true);
  assert.equal(fixturesEnabled({ AUTH_MODE: "local", NODE_ENV: "development" }), false);
  assert.equal(fixturesEnabled({ AUTH_MODE: "supabase", CONNECTOR_LOCAL_FIXTURES: "1" }), false);
  assert.equal(fixturesEnabled({ AUTH_MODE: "local", CONNECTOR_LOCAL_FIXTURES: "1", NODE_ENV: "production" }), false);
  assert.equal(fixturesEnabled({ AUTH_MODE: "local", CONNECTOR_LOCAL_FIXTURES: "1", VERCEL_ENV: "preview" }), false);
});

test("fixtures answer the real Jira endpoints so the production parser runs unchanged", async () => {
  assert.deepEqual(fixtureJql(searchJql("", "LEND", { type: "Epic" })).map(i => i.key), ["LEND-10"]);
  assert.deepEqual(fixtureJql(searchJql("", "LEND", { type: "subtask" })).map(i => i.key), ["LEND-15"]);
  const r = await searchIssuesPage(fixtureCall("JIRA", 0), FIXTURE_SITE, "repayment", null, { status: "indeterminate" });
  assert.ok(r.results.length > 0 && r.results.every(x => x.jira!.statusCategory === "indeterminate"));
  assert.ok(r.results.every(x => x.url!.startsWith("https://synthetic-jira.example/")));
});
