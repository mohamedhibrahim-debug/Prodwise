import { ConnectorError } from "./types.ts";

/** An authorized JSON/text call to one provider. The token never appears in errors. */
export type ProviderCall = (url: string, init?: RequestInit & { as?: "json" | "text"; timeoutMs?: number }) => Promise<unknown>;

export function classifyStatus(status: number): ConnectorError | null {
  if (status >= 200 && status < 300) return null;
  if (status === 401) return new ConnectorError("NEEDS_RECONNECT");
  if (status === 403) return new ConnectorError("NO_ACCESS");
  if (status === 404 || status === 410) return new ConnectorError("NOT_FOUND");
  if (status === 429) return new ConnectorError("RATE_LIMITED");
  if (status === 400 || status === 422) return new ConnectorError("INVALID_REQUEST");
  return new ConnectorError("PROVIDER_UNAVAILABLE");
}

export function bearerCall(f: typeof fetch, token: string): ProviderCall {
  return async (url, init = {}) => {
    const { as = "json", timeoutMs = 20000, ...rest } = init;
    let res: Response;
    try {
      res = await f(url, { ...rest, headers: { accept: as === "json" ? "application/json" : "text/plain", ...(rest.headers ?? {}), authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(timeoutMs) });
    } catch { throw new ConnectorError("PROVIDER_UNAVAILABLE"); }
    const error = classifyStatus(res.status); if (error) throw error;
    // The same deadline covers the body: a stalled or cut-off body is "didn't respond", not a crash.
    try { return as === "json" ? await res.json() : await res.text(); } catch { throw new ConnectorError("PROVIDER_UNAVAILABLE"); }
  };
}

/**
 * Runs fn over items with at most `limit` requests in flight and keeps each item's
 * outcome. A burst of parallel calls is what makes providers answer 429 and a
 * search look stuck; one slow or refused item must not sink the rest.
 */
export async function settleLimited<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try { out[i] = { status: "fulfilled", value: await fn(items[i]!) }; } catch (reason) { out[i] = { status: "rejected", reason }; }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}

/** Evidence snapshots are capped at the evidence limit; the cut is stated in the text. */
export function capText(text: string, limit = 20000): string {
  const clean = text.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u202A-\u202E\u2066-\u2069]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= limit) return clean;
  const note = "\n\n[Snapshot shortened to fit the evidence limit. Open the original for the rest.]";
  let cut = clean.slice(0, limit - note.length);
  if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1);
  return cut + note;
}

export const clip = (value: string, max: number) => { const v = value.replace(/\s+/g, " ").trim(); return v.length <= max ? v : `${v.slice(0, max - 1)}…`; };
