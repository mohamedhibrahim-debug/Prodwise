import { capText, clip, type ProviderCall } from "./http.ts";
import { ConnectorError, type ConnectorSite, type ProviderResult, type ProviderSnapshot } from "./types.ts";

/**
 * Jira Cloud through Atlassian OAuth 2.0 (3LO): api.atlassian.com/ex/jira/{cloudId}.
 * Read-only. Jira status is delivery evidence; it is never translated into
 * Prodwise truth (a "Done" issue is not "Live" or "Approved").
 */
export const ACCESSIBLE_RESOURCES = "https://api.atlassian.com/oauth/token/accessible-resources";
const base = (site: ConnectorSite) => `https://api.atlassian.com/ex/jira/${encodeURIComponent(site.id)}/rest/api/3`;
export const ISSUE_KEY = /^[A-Z][A-Z0-9_]{0,19}-[1-9][0-9]{0,8}$/;
export const PROJECT_KEY = /^[A-Z][A-Z0-9_]{0,19}$/;

export function sitesFrom(body: unknown): ConnectorSite[] {
  if (!Array.isArray(body)) return [];
  return body.flatMap(r => {
    const x = r as { id?: unknown; url?: unknown; name?: unknown; scopes?: unknown };
    if (typeof x.id !== "string" || typeof x.url !== "string" || typeof x.name !== "string") return [];
    if (Array.isArray(x.scopes) && !x.scopes.includes("read:jira-work")) return [];
    try { if (new URL(x.url).protocol !== "https:") return []; } catch { return []; }
    return [{ id: x.id, url: x.url.replace(/\/$/, ""), name: clip(x.name, 120) }];
  });
}

/** JQL text search with nothing but letters, digits and simple punctuation, always quoted. */
export function searchJql(query: string, projectKey: string | null): string {
  const q = query.normalize("NFKC").trim();
  const clauses: string[] = [];
  if (projectKey) { if (!PROJECT_KEY.test(projectKey)) throw new ConnectorError("INVALID_REQUEST"); clauses.push(`project = "${projectKey}"`); }
  if (ISSUE_KEY.test(q.toUpperCase())) clauses.push(`key = "${q.toUpperCase()}"`);
  else if (q) {
    const safe = q.replace(/[^\p{L}\p{N} _\-.:/]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    if (!safe) throw new ConnectorError("INVALID_REQUEST");
    clauses.push(`text ~ "${safe}"`);
  }
  if (!clauses.length) throw new ConnectorError("INVALID_REQUEST");
  return `${clauses.join(" AND ")} ORDER BY updated DESC`;
}

interface IssueFields {
  summary?: string; status?: { name?: string; statusCategory?: { name?: string } }; issuetype?: { name?: string }; priority?: { name?: string } | null;
  assignee?: { displayName?: string } | null; duedate?: string | null; updated?: string; created?: string; labels?: string[];
  fixVersions?: { name?: string; releaseDate?: string; released?: boolean }[]; parent?: { key?: string; fields?: { summary?: string } } | null;
  issuelinks?: { type?: { inward?: string; outward?: string }; inwardIssue?: LinkedIssue; outwardIssue?: LinkedIssue }[];
  description?: unknown; comment?: { comments?: { created?: string; author?: { displayName?: string }; body?: unknown }[] };
  project?: { key?: string; name?: string };
}
interface LinkedIssue { key?: string; fields?: { summary?: string; status?: { name?: string } } }
interface Issue { key?: string; fields?: IssueFields }

export async function listProjects(call: ProviderCall, site: ConnectorSite): Promise<{ key: string; name: string }[]> {
  const body = await call(`${base(site)}/project/search?maxResults=100&orderBy=name`) as { values?: { key?: string; name?: string }[] };
  return (body.values ?? []).flatMap(p => typeof p.key === "string" && PROJECT_KEY.test(p.key) && typeof p.name === "string" ? [{ key: p.key, name: clip(p.name, 120) }] : []);
}

export async function searchIssues(call: ProviderCall, site: ConnectorSite, query: string, projectKey: string | null): Promise<ProviderResult[]> {
  const body = await call(`${base(site)}/search/jql`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jql: searchJql(query, projectKey), maxResults: 20, fields: ["summary", "status", "issuetype", "updated", "duedate", "assignee"] }) }) as { issues?: Issue[] };
  return (body.issues ?? []).flatMap(i => {
    if (typeof i.key !== "string" || !ISSUE_KEY.test(i.key)) return [];
    const f = i.fields ?? {};
    return [{ reference: i.key, name: clip(f.summary ?? i.key, 200), kind: clip(f.issuetype?.name ?? "Issue", 50), url: `${site.url}/browse/${i.key}`, updatedAt: f.updated ?? null,
      detail: [f.status?.name, f.assignee?.displayName ? `Assignee ${f.assignee.displayName}` : "Unassigned", f.duedate ? `Due ${f.duedate}` : null].filter(Boolean).join(" · ") }];
  });
}

/** Atlassian Document Format → readable plain text. Unknown nodes keep their text. */
export function adfToText(node: unknown): string {
  if (!node || typeof node !== "object") return typeof node === "string" ? node : "";
  const n = node as { type?: string; text?: string; content?: unknown[]; attrs?: { text?: string; url?: string; shortName?: string } };
  const inner = (sep = "") => (n.content ?? []).map(adfToText).join(sep);
  switch (n.type) {
    case "text": return n.text ?? "";
    case "hardBreak": return "\n";
    case "mention": return n.attrs?.text ?? "@someone";
    case "emoji": return n.attrs?.shortName ?? "";
    case "inlineCard": case "blockCard": return n.attrs?.url ?? "";
    case "paragraph": case "heading": return `${inner()}\n`;
    case "bulletList": case "orderedList": return `${(n.content ?? []).map(li => `- ${adfToText(li).trim()}`).join("\n")}\n`;
    case "listItem": return inner();
    case "codeBlock": return `${inner()}\n`;
    case "table": return `${(n.content ?? []).map(row => ((row as { content?: unknown[] }).content ?? []).map(c => adfToText(c).trim()).join(" | ")).join("\n")}\n`;
    default: return inner(n.type === "doc" ? "" : "");
  }
}

const ISSUE_FIELDS = ["summary", "status", "issuetype", "priority", "assignee", "duedate", "updated", "created", "labels", "fixVersions", "parent", "issuelinks", "description", "comment", "project"];

export async function issueSnapshot(call: ProviderCall, site: ConnectorSite, key: string): Promise<ProviderSnapshot> {
  if (!ISSUE_KEY.test(key)) throw new ConnectorError("INVALID_REQUEST");
  const issue = await call(`${base(site)}/issue/${encodeURIComponent(key)}?fields=${ISSUE_FIELDS.join(",")}`) as Issue;
  const f = issue.fields ?? {};
  let children: string | null = null;
  // Epics and parents: a factual count of child work by status category — not progress, not readiness.
  if (/epic/i.test(f.issuetype?.name ?? "") || !f.parent) {
    try {
      const kids = await call(`${base(site)}/search/jql`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jql: `parent = "${key}"`, maxResults: 100, fields: ["status"] }) }) as { issues?: Issue[]; isLast?: boolean };
      const list = kids.issues ?? [];
      if (list.length) {
        const byCategory = new Map<string, number>(); for (const k of list) { const c = k.fields?.status?.statusCategory?.name ?? "Unknown"; byCategory.set(c, (byCategory.get(c) ?? 0) + 1); }
        children = `${list.length}${kids.isLast === false ? "+" : ""} child work items (${[...byCategory].map(([c, n]) => `${c} ${n}`).join(" · ")})`;
      }
    } catch (e) { if (!(e instanceof ConnectorError) || e.code === "NEEDS_RECONNECT") throw e; }
  }
  return { connector: "JIRA", provider: "JIRA", providerWorkspace: new URL(site.url).host, containerReference: f.project?.key ?? key.split("-")[0]!, containerName: clip(f.project?.name ?? key.split("-")[0]!, 200),
    item: { reference: key, name: clip(f.summary ?? key, 200), kind: clip(f.issuetype?.name ?? "Issue", 50), url: `${site.url}/browse/${key}` },
    title: clip(`${key} · ${f.summary ?? "Jira work item"}`, 200), text: issueText(key, f, children), evidenceSourceType: "JIRA", externalUpdatedAt: f.updated ?? null, occurredAt: f.updated ?? null };
}

export function issueText(key: string, f: IssueFields, children: string | null): string {
  const lines = [
    `Jira work item ${key} (snapshot of Jira at import; Jira status is delivery evidence, not a Prodwise decision).`,
    `Summary: ${f.summary ?? "Not recorded"}`,
    `Type: ${f.issuetype?.name ?? "Not recorded"} · Status: ${f.status?.name ?? "Not recorded"}${f.status?.statusCategory?.name ? ` (${f.status.statusCategory.name})` : ""}${f.priority?.name ? ` · Priority: ${f.priority.name}` : ""}`,
    `Assignee: ${f.assignee?.displayName ?? "Unassigned"} · Due date: ${f.duedate ?? "Not set in Jira"}`,
    f.fixVersions?.length ? `Fix versions: ${f.fixVersions.map(v => `${v.name ?? "?"}${v.releaseDate ? ` (release date ${v.releaseDate}${v.released ? ", released" : ""})` : ""}`).join("; ")}` : null,
    f.parent?.key ? `Parent: ${f.parent.key} ${f.parent.fields?.summary ?? ""}`.trim() : null,
    f.labels?.length ? `Labels: ${f.labels.join(", ")}` : null,
    `Created: ${f.created ?? "?"} · Last updated in Jira: ${f.updated ?? "?"}`,
    children ? `Children: ${children}` : null,
    f.issuelinks?.length ? `Links:\n${f.issuelinks.map(l => { const o = l.outwardIssue, i = l.inwardIssue, other = o ?? i; return `- ${o ? l.type?.outward ?? "relates to" : l.type?.inward ?? "relates to"} ${other?.key ?? "?"} ${other?.fields?.summary ?? ""}${other?.fields?.status?.name ? ` (${other.fields.status.name})` : ""}`.trim(); }).join("\n")}` : null,
    `Description:\n${adfToText(f.description).trim() || "No description in Jira."}`,
    f.comment?.comments?.length ? `Latest comments:\n${f.comment.comments.slice(-5).map(c => `- ${c.created?.slice(0, 10) ?? "?"} ${c.author?.displayName ?? "Someone"}: ${adfToText(c.body).trim()}`).join("\n")}` : null,
  ];
  return capText(lines.filter(Boolean).join("\n"));
}
