import { capText, clip, settleLimited, type ProviderCall } from "./http.ts";
import { ConnectorError, type ProviderSnapshot, type SearchOutcome } from "./types.ts";

/**
 * Gmail, read-only (gmail.readonly). Only an explicit search is ever run and only
 * the threads a person selects are read. Prodwise never sends, labels or deletes.
 */
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
export const THREAD_ID = /^[0-9a-f]{8,32}$/i;

interface Header { name?: string; value?: string }
interface Part { mimeType?: string; filename?: string; headers?: Header[]; body?: { data?: string; size?: number }; parts?: Part[] }
interface Message { id?: string; internalDate?: string; payload?: Part; snippet?: string }
interface Thread { id?: string; messages?: Message[] }

const header = (p: Part | undefined, name: string) => p?.headers?.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
const iso = (internalDate?: string) => internalDate && /^\d+$/.test(internalDate) ? new Date(Number(internalDate)).toISOString() : null;

export function searchQuery(query: string): string {
  const q = query.normalize("NFKC").trim();
  // A search is required: Prodwise never lists a whole mailbox.
  if (q.length < 3 || q.length > 200) throw new ConnectorError("INVALID_REQUEST");
  return q;
}

/** Metadata for at most 15 threads, five at a time, each bounded: a search always finishes. */
export async function searchThreads(call: ProviderCall, query: string): Promise<SearchOutcome> {
  const list = await call(`${API}/threads?maxResults=15&q=${encodeURIComponent(searchQuery(query))}`) as { threads?: { id?: string }[]; nextPageToken?: string };
  const ids = (list.threads ?? []).map(t => t.id).filter((id): id is string => typeof id === "string" && THREAD_ID.test(id));
  const settled = await settleLimited(ids, 5, id => call(`${API}/threads/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, { timeoutMs: 10000 }) as Promise<Thread>);
  const failed = settled.filter(r => r.status === "rejected") as PromiseRejectedResult[];
  // Every thread failing is a failed search (reconnect, rate limit…), not an empty one.
  if (ids.length && failed.length === ids.length) throw failed[0]!.reason;
  const results = settled.flatMap(r => {
    if (r.status !== "fulfilled") return [];
    const t = r.value, first = t.messages?.[0], last = t.messages?.at(-1); if (!t.id || !first) return [];
    return [{ reference: t.id, name: clip(header(first.payload, "Subject") || "(no subject)", 200), kind: "Email thread", url: `https://mail.google.com/mail/#all/${t.id}`, updatedAt: iso(last?.internalDate),
      detail: [`From ${clip(header(first.payload, "From") ?? "unknown sender", 80)}`, `${t.messages?.length ?? 1} ${(t.messages?.length ?? 1) === 1 ? "message" : "messages"}`].join(" · ") }];
  });
  return { results, omitted: failed.length, more: typeof list.nextPageToken === "string" };
}

export function decodeBody(data: string | undefined): string {
  if (!data) return "";
  return Buffer.from(data, "base64url").toString("utf8");
}
export function htmlToText(html: string): string {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'");
}
/** Prefers text/plain; falls back to text/html. Attachments are listed by name, never read. */
export function messageText(part: Part | undefined): { text: string; attachments: string[] } {
  const plain: string[] = [], html: string[] = [], attachments: string[] = [];
  const walk = (p: Part | undefined) => {
    if (!p) return;
    if (p.filename) { attachments.push(p.filename); return; }
    if (p.mimeType === "text/plain") plain.push(decodeBody(p.body?.data));
    else if (p.mimeType === "text/html") html.push(htmlToText(decodeBody(p.body?.data)));
    for (const c of p.parts ?? []) walk(c);
  };
  walk(part);
  return { text: (plain.length ? plain : html).join("\n"), attachments };
}
/** Drops quoted history so each message contributes only what it added. */
export function stripQuoted(text: string): string {
  const lines = text.split(/\r?\n/), out: string[] = [];
  for (const line of lines) {
    if (/^On .{4,200} wrote:$/.test(line.trim()) || /^-{2,}\s*Original Message\s*-{2,}/i.test(line.trim()) || /^From: .+/.test(line.trim()) && out.length > 3) break;
    if (line.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

export async function threadSnapshot(call: ProviderCall, account: string, threadId: string): Promise<ProviderSnapshot> {
  if (!THREAD_ID.test(threadId)) throw new ConnectorError("INVALID_REQUEST");
  const t = await call(`${API}/threads/${threadId}?format=full`) as Thread;
  const messages = t.messages ?? []; if (!messages.length) throw new ConnectorError("NOT_FOUND");
  const subject = header(messages[0]!.payload, "Subject") || "(no subject)";
  const body = messages.map(m => {
    const { text, attachments } = messageText(m.payload);
    return [`--- ${iso(m.internalDate) ?? header(m.payload, "Date") ?? "date unknown"} · From: ${header(m.payload, "From") ?? "unknown"}`,
      header(m.payload, "To") ? `To: ${header(m.payload, "To")}` : null, header(m.payload, "Cc") ? `Cc: ${header(m.payload, "Cc")}` : null,
      stripQuoted(text) || "(no readable text)", attachments.length ? `Attachments (not read): ${attachments.join(", ")}` : null].filter(Boolean).join("\n");
  });
  const last = iso(messages.at(-1)!.internalDate);
  return { connector: "GMAIL", provider: "EMAIL", providerWorkspace: clip(account || "gmail", 300), containerReference: "gmail", containerName: "Gmail",
    item: { reference: threadId, name: clip(subject, 200), kind: "Email thread", url: `https://mail.google.com/mail/#all/${threadId}` },
    title: clip(`Email · ${subject}`, 200), text: capText(`Email thread "${subject}" (${messages.length} ${messages.length === 1 ? "message" : "messages"}; snapshot of Gmail at import).\n\n${body.join("\n\n")}`),
    evidenceSourceType: "EMAIL", externalUpdatedAt: last, occurredAt: last };
}
