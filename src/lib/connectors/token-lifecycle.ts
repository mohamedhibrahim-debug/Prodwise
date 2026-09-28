import { needsRefresh } from "./oauth.ts";
import { ConnectorError, type ProviderTokens } from "./types.ts";

/**
 * Access-token lifecycle for one connection, independent of storage and provider.
 * - Refreshes shortly before expiry, and once more on a 401.
 * - Atlassian rotates refresh tokens: when another request refreshed first, ours is
 *   refused, so the newer stored tokens are used instead of expiring the connection.
 * - A disconnect made meanwhile wins: refreshed tokens are never written back over it.
 * - Only a grant that is really dead marks the connection "needs reconnect".
 */
export interface TokenStore {
  /** Current stored state: sealed tokens while connected, otherwise null. */
  current(): Promise<{ connected: boolean; sealed: string | null }>;
  open(sealed: string): ProviderTokens;
  seal(tokens: ProviderTokens): string;
  save(sealed: string): Promise<void>;
  expire(): Promise<void>;
  refresh(tokens: ProviderTokens): Promise<ProviderTokens>;
}

export async function withTokens<T>(store: TokenStore, startSealed: string, fn: (accessToken: string) => Promise<T>, now = () => Date.now()): Promise<T> {
  let tokens = store.open(startSealed), refreshed = false, mine: string | null = null;
  const newerElsewhere = async (): Promise<ProviderTokens | null> => { const c = await store.current(); return c.connected && c.sealed && c.sealed !== startSealed && c.sealed !== mine ? store.open(c.sealed) : null; };
  const refresh = async () => {
    let next: ProviderTokens;
    try { next = await store.refresh(tokens); }
    catch (e) { const other = e instanceof ConnectorError && e.code === "NEEDS_RECONNECT" ? await newerElsewhere() : null; if (!other) throw e; tokens = other; refreshed = true; return; }
    if (!(await store.current()).connected) throw new ConnectorError("NOT_CONNECTED");
    tokens = next; refreshed = true; mine = store.seal(next); await store.save(mine);
  };
  try {
    if (needsRefresh(tokens, now())) await refresh();
    try { return await fn(tokens.accessToken); }
    catch (e) { if (!(e instanceof ConnectorError) || e.code !== "NEEDS_RECONNECT" || refreshed) throw e; await refresh(); return await fn(tokens.accessToken); }
  } catch (e) {
    if (e instanceof ConnectorError && e.code === "NEEDS_RECONNECT" && !(await newerElsewhere())) await store.expire();
    throw e;
  }
}
