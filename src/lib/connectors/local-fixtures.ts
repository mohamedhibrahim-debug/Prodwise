import { ConnectorError, type Connector, type ConnectorSite } from "./types.ts";
import type { ProviderCall } from "./http.ts";

/**
 * LOCAL DEVELOPMENT ONLY. Synthetic provider responses so the connector experience can
 * be exercised without real Jira, Google or Figma accounts.
 *
 * - Active only when AUTH_MODE=local AND CONNECTOR_LOCAL_FIXTURES=1, and never in a
 *   production or hosted build (the same fence as local authentication).
 * - Answers the real provider URLs with the real response shapes, so the production
 *   parsers (jira.ts, gmail.ts, drive.ts, figma.ts) run unchanged on this data.
 * - Every name, person and link is visibly synthetic. Nothing here is a real system.
 */
export function fixturesEnabled(env: Record<string, string | undefined>): boolean {
  if (env.AUTH_MODE !== "local" || env.CONNECTOR_LOCAL_FIXTURES !== "1") return false;
  return env.NODE_ENV !== "production" && !env.VERCEL_ENV;
}

export const FIXTURE_SITE: ConnectorSite = { id: "fixture-site", url: "https://synthetic-jira.example", name: "Synthetic Jira (local fixture)" };
export const FIXTURE_ACCOUNT: Record<Connector, string> = {
  JIRA: "Synthetic PM (local fixture)",
  GMAIL: "fixture.pm@synthetic.example",
  GOOGLE_DRIVE: "fixture.pm@synthetic.example",
  FIGMA: "fixture.designer@synthetic.example",
};

// ── Jira ────────────────────────────────────────────────────────────────────
interface FixtureIssue { key: string; summary: string; type: string; subtask?: boolean; status: string; category: "new" | "indeterminate" | "done"; assignee: string | null; due: string | null; updated: string; parent: string | null; description: string }
const CATEGORY_NAME = { new: "To Do", indeterminate: "In Progress", done: "Done" } as const;
const CATEGORY_ID = { new: 2, indeterminate: 4, done: 3 } as const;
const PROJECTS: Record<string, string> = { LEND: "Lending (synthetic)", PAY: "Payments (synthetic)" };
export const FIXTURE_ISSUES: FixtureIssue[] = [
  { key: "LEND-1", summary: "Merchant working-capital programme", type: "Initiative", status: "In Progress", category: "indeterminate", assignee: "Synthetic Product Lead", due: "2027-03-31", updated: "2026-09-24T09:10:00.000+0000", parent: null, description: "Programme umbrella for merchant financing products." },
  { key: "LEND-10", summary: "Merchant Flex Finance — repayment engine", type: "Epic", status: "In Development", category: "indeterminate", assignee: "Synthetic Engineer A", due: "2026-11-15", updated: "2026-09-27T14:02:00.000+0000", parent: "LEND-1", description: "Deduct daily repayments from settlement activity." },
  { key: "LEND-11", summary: "Daily repayment calculation from settlement", type: "Story", status: "In Progress", category: "indeterminate", assignee: "Synthetic Engineer A", due: null, updated: "2026-09-27T11:40:00.000+0000", parent: "LEND-10", description: "Daily repayment = monthly installment / 30 (implementation note)." },
  { key: "LEND-12", summary: "Show repayment schedule on the merchant statement", type: "Story", status: "Done", category: "done", assignee: "Synthetic Engineer B", due: "2026-09-20", updated: "2026-09-19T16:25:00.000+0000", parent: "LEND-10", description: "Statement lists each scheduled repayment." },
  { key: "LEND-13", summary: "Finance confirmation of the repayment divisor", type: "Task", status: "To Do", category: "new", assignee: null, due: "2026-10-10", updated: "2026-09-25T08:00:00.000+0000", parent: "LEND-10", description: "Finance to confirm 27 or 30 as the divisor." },
  { key: "LEND-14", summary: "Rounding differs between statement and ledger", type: "Bug", status: "In Review", category: "indeterminate", assignee: "Synthetic Engineer B", due: null, updated: "2026-09-26T17:30:00.000+0000", parent: "LEND-10", description: "Statement rounds half-up; ledger rounds half-even." },
  { key: "LEND-15", summary: "Unit tests for the divisor boundary", type: "Sub-task", subtask: true, status: "Done", category: "done", assignee: "Synthetic Engineer A", due: null, updated: "2026-09-22T10:00:00.000+0000", parent: "LEND-11", description: "Covers 27 and 30." },
  { key: "LEND-16", summary: "Evaluate the settlement hold API", type: "Spike", status: "To Do", category: "new", assignee: "Synthetic Architect", due: "2026-10-31", updated: "2026-09-18T12:00:00.000+0000", parent: null, description: "Time-boxed investigation." },
  { key: "LEND-17", summary: "Early settlement fee rules", type: "Story", status: "Selected for Development", category: "new", assignee: null, due: null, updated: "2026-09-23T15:45:00.000+0000", parent: "LEND-10", description: "Fee applies when a merchant settles early. (Fixture: the first import attempt fails, a retry succeeds.)" },
  { key: "PAY-20", summary: "Instant settlement payout", type: "Epic", status: "To Do", category: "new", assignee: "Synthetic Engineer C", due: "2027-01-15", updated: "2026-09-21T09:00:00.000+0000", parent: null, description: "Pay merchants within minutes of settlement." },
  { key: "PAY-21", summary: "Payout cut-off handling for bank holidays", type: "Story", status: "In Progress", category: "indeterminate", assignee: "Synthetic Engineer C", due: "2026-10-30", updated: "2026-09-26T13:15:00.000+0000", parent: "PAY-20", description: "Cut-off moves to the next business day." },
  { key: "PAY-22", summary: "Duplicate payout on retry", type: "Bug", status: "Done", category: "done", assignee: "Synthetic Engineer C", due: null, updated: "2026-09-12T10:30:00.000+0000", parent: "PAY-20", description: "Idempotency key added." },
];
const issue = (key: string) => FIXTURE_ISSUES.find(i => i.key === key);
function issueFields(i: FixtureIssue) {
  const project = i.key.split("-")[0]!, parent = i.parent ? issue(i.parent) : null;
  return {
    summary: i.summary, issuetype: { name: i.type, subtask: i.subtask === true }, status: { name: i.status, statusCategory: { key: i.category, name: CATEGORY_NAME[i.category] } },
    assignee: i.assignee ? { displayName: i.assignee } : null, duedate: i.due, updated: i.updated, created: "2026-08-01T09:00:00.000+0000",
    project: { key: project, name: PROJECTS[project] ?? project }, parent: parent ? { key: parent.key, fields: { summary: parent.summary } } : null,
    labels: ["synthetic-fixture"], description: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: i.description }] }] }, comment: { comments: [] }, issuelinks: [], fixVersions: [],
  };
}
/** Evaluates the JQL searchJql() produces — and nothing else. */
export function fixtureJql(jql: string): FixtureIssue[] {
  const project = /project = "([A-Z0-9_]+)"/.exec(jql)?.[1] ?? null, key = /key = "([^"]+)"/.exec(jql)?.[1] ?? null, parent = /parent = "([^"]+)"/.exec(jql)?.[1] ?? null;
  const type = /issuetype = "([^"]+)"/.exec(jql)?.[1] ?? null, subtasks = jql.includes("subTaskIssueTypes()"), category = /statusCategory = (\d)/.exec(jql)?.[1] ?? null;
  const words = (/text ~ "([^"]+)"/.exec(jql)?.[1] ?? "").toLowerCase().split(" ").filter(Boolean);
  return FIXTURE_ISSUES.filter(i => (!project || i.key.startsWith(`${project}-`)) && (!key || i.key === key) && (!parent || i.parent === parent)
    && (!type || i.type.toLowerCase() === type.toLowerCase()) && (!subtasks || i.subtask === true) && (!category || String(CATEGORY_ID[i.category]) === category)
    && words.every(w => `${i.summary} ${i.description} ${i.key}`.toLowerCase().includes(w)))
    .sort((a, b) => b.updated.localeCompare(a.updated));
}

// ── Gmail ───────────────────────────────────────────────────────────────────
interface FixtureThread { id: string; subject: string; from: string; messages: { at: string; from: string; text: string }[]; slow?: boolean }
export const FIXTURE_THREADS: FixtureThread[] = [
  { id: "f1a0000000000001", subject: "Repayment divisor — Finance position (synthetic)", from: "Synthetic Finance Lead <finance@synthetic.example>", messages: [
    { at: "1790500000000", from: "Synthetic Finance Lead <finance@synthetic.example>", text: "Our model uses 27 business days per month for the daily repayment." },
    { at: "1790590000000", from: "Synthetic Engineer A <eng@synthetic.example>", text: "Implementation currently divides by 30. Can Finance confirm before we continue?" }] },
  { id: "f1a0000000000002", subject: "Pilot merchant list for Flex Finance (synthetic)", from: "Synthetic Ops <ops@synthetic.example>", messages: [
    { at: "1790300000000", from: "Synthetic Ops <ops@synthetic.example>", text: "Pilot capped at 40 merchants with 6 months of settlement history." }] },
  { id: "f1a0000000000003", subject: "Compliance review scheduling (synthetic)", from: "Synthetic Compliance <compliance@synthetic.example>", messages: [
    { at: "1790100000000", from: "Synthetic Compliance <compliance@synthetic.example>", text: "Review slot proposed for next month. No approval has been given yet." }] },
  { id: "f1a0000000000004", subject: "Board pack — long thread (slow fixture, ~25 s to import)", from: "Synthetic Chief of Staff <cos@synthetic.example>", slow: true, messages: [
    { at: "1790000000000", from: "Synthetic Chief of Staff <cos@synthetic.example>", text: "Attaching the board pack draft for the repayment programme." }] },
];
const b64 = (s: string) => Buffer.from(s).toString("base64url");
const threadBody = (t: FixtureThread, full: boolean) => ({ id: t.id, messages: t.messages.map(m => ({ id: `${t.id}-${m.at}`, internalDate: m.at, payload: { mimeType: "text/plain", headers: [{ name: "Subject", value: t.subject }, { name: "From", value: m.from }, { name: "To", value: "fixture.pm@synthetic.example" }], body: full ? { data: b64(m.text) } : {} } })) });

// ── Drive ───────────────────────────────────────────────────────────────────
const DRIVE_FILES = [
  { id: "fixtureDoc0000001", name: "Merchant Flex Finance — PRD v2.3 (synthetic)", mimeType: "application/vnd.google-apps.document", modifiedTime: "2026-09-20T10:00:00.000Z", text: "Daily repayment = monthly installment / 27. Islamic financing only." },
  { id: "fixtureSheet000001", name: "Repayment divisor model (synthetic)", mimeType: "application/vnd.google-apps.spreadsheet", modifiedTime: "2026-09-24T15:30:00.000Z", text: "month,installment,divisor\nOct,2700,27" },
  { id: "fixtureSlides00001", name: "Flex Finance steering deck (synthetic)", mimeType: "application/vnd.google-apps.presentation", modifiedTime: "2026-09-15T08:00:00.000Z", text: "Slide 1: Programme scope\nSlide 2: Pilot" },
  { id: "fixturePdf00000001", name: "Signed term sheet (synthetic).pdf", mimeType: "application/pdf", modifiedTime: "2026-09-02T12:00:00.000Z", text: "" },
];
const driveFile = (f: (typeof DRIVE_FILES)[number]) => ({ id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime, version: "7", webViewLink: `https://drive.synthetic.example/${f.id}`, owners: [{ displayName: "Synthetic PM" }], lastModifyingUser: { displayName: "Synthetic Finance Lead" } });

// ── Figma ───────────────────────────────────────────────────────────────────
export const FIXTURE_FIGMA_KEY = "SynthFigma0001";
const FIGMA_FILE = { name: "Merchant Flex — Checkout (synthetic)", lastModified: "2026-09-25T09:00:00Z", version: "42", document: { id: "0:0", type: "DOCUMENT", children: [
  { id: "1:1", type: "CANVAS", name: "Onboarding", children: [{ id: "10:1", type: "FRAME", name: "Eligibility check" }, { id: "10:2", type: "FRAME", name: "Offer summary" }] },
  { id: "1:2", type: "CANVAS", name: "Repayments", children: [{ id: "20:1", type: "FRAME", name: "Daily repayment breakdown" }, { id: "20:2", type: "SECTION", name: "Statement components" }, { id: "20:3", type: "COMPONENT", name: "Repayment row" }] },
] } };
const frameNode = (id: string) => { const f = FIGMA_FILE.document.children.flatMap(p => p.children).find(n => n.id === id); return f ? { ...f, children: [{ id: `${id}:t`, type: "TEXT", name: "Heading", characters: `${f.name} (synthetic)` }, { id: `${id}:b`, type: "TEXT", name: "Body", characters: "Daily repayment is deducted from settlement." }] } : null; };

/** Mutable only for the flaky fixture; module state lives as long as the dev server. */
const attempts = new Map<string, number>();

const wait = (ms: number, signal?: AbortSignal | null) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms); signal?.addEventListener("abort", () => { clearTimeout(t); reject(new ConnectorError("PROVIDER_UNAVAILABLE")); }, { once: true });
});

/** A ProviderCall that answers the real endpoint URLs with synthetic data after a short, realistic delay. */
export function fixtureCall(connector: Connector, delayMs = 450): ProviderCall {
  return async (url, init = {}) => {
    const u = new URL(url), path = u.pathname;
    await wait(delayMs);
    const body = typeof init.body === "string" ? JSON.parse(init.body) as { jql?: string } : {};
    if (connector === "JIRA") {
      if (url.includes("accessible-resources")) return [{ id: FIXTURE_SITE.id, url: FIXTURE_SITE.url, name: FIXTURE_SITE.name, scopes: ["read:jira-work"] }];
      if (path.endsWith("/myself")) return { accountId: "fixture-account", displayName: FIXTURE_ACCOUNT.JIRA };
      if (path.endsWith("/project/search")) return { values: Object.entries(PROJECTS).map(([key, name]) => ({ key, name })) };
      if (path.endsWith("/search/jql")) { const list = fixtureJql(body.jql ?? ""); return { issues: list.slice(0, 20).map(i => ({ key: i.key, fields: issueFields(i) })), isLast: list.length <= 20 }; }
      const key = /\/issue\/([^/?]+)/.exec(path)?.[1]; const found = key ? issue(decodeURIComponent(key)) : null;
      if (!found) throw new ConnectorError("NOT_FOUND");
      if (found.key === "LEND-17") { const n = (attempts.get(found.key) ?? 0) + 1; attempts.set(found.key, n); if (n % 2 === 1) throw new ConnectorError("PROVIDER_UNAVAILABLE"); }
      return { key: found.key, fields: issueFields(found) };
    }
    if (connector === "GMAIL") {
      if (path.endsWith("/threads")) { const words = (u.searchParams.get("q") ?? "").toLowerCase().split(/\s+/).filter(w => w && !w.includes(":")); return { threads: FIXTURE_THREADS.filter(t => words.every(w => `${t.subject} ${t.from} ${t.messages.map(m => m.text).join(" ")}`.toLowerCase().includes(w))).map(t => ({ id: t.id })) }; }
      const t = FIXTURE_THREADS.find(x => path.endsWith(`/threads/${x.id}`)); if (!t) throw new ConnectorError("NOT_FOUND");
      const full = u.searchParams.get("format") === "full";
      if (full && t.slow) await wait(25000);
      return threadBody(t, full);
    }
    if (connector === "GOOGLE_DRIVE") {
      if (path.endsWith("/files")) { const q = /name contains '((?:[^'\\]|\\.)*)'/.exec(u.searchParams.get("q") ?? "")?.[1]?.toLowerCase() ?? ""; return { files: DRIVE_FILES.filter(f => `${f.name} ${f.text}`.toLowerCase().includes(q)).map(driveFile) }; }
      const f = DRIVE_FILES.find(x => path.includes(`/files/${x.id}`)); if (!f) throw new ConnectorError("NOT_FOUND");
      if (path.endsWith("/export")) return f.text;
      return driveFile(f);
    }
    // FIGMA
    if (path.endsWith("/v1/me")) return { id: "fixture-designer", email: FIXTURE_ACCOUNT.FIGMA };
    if (!path.includes(`/files/${FIXTURE_FIGMA_KEY}`)) throw new ConnectorError("NOT_FOUND");
    if (path.endsWith("/comments")) return { comments: [{ id: "c1", message: "Should the divisor be shown to merchants? (synthetic)", client_meta: { node_id: "20:1:t" }, user: { handle: "synthetic-designer" }, created_at: "2026-09-24T00:00:00Z" }] };
    if (path.endsWith("/nodes")) { const id = u.searchParams.get("ids") ?? ""; const node = frameNode(id); return { nodes: { [id]: node ? { document: node } : null } }; }
    return FIGMA_FILE;
  };
}
