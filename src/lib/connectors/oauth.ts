import { createHash, randomBytes } from "node:crypto";
import { ConnectorError, CONNECTOR_SLUG, type Connector, type ProviderTokens } from "./types.ts";

/**
 * OAuth 2.0 authorization-code configuration per provider. Read-only scopes only.
 * Google Gmail and Drive are separate connections with separate consent, so a
 * person can share documents without sharing their mailbox.
 */
export interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  extraAuthorizeParams: Record<string, string>;
  /** How the client authenticates to the token endpoint. */
  clientAuth: "json_body" | "form_body" | "basic";
  pkce: boolean;
  revokeUrl: string | null;
  env: { id: string; secret: string };
}

const GOOGLE = { authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", clientAuth: "form_body" as const, pkce: true, revokeUrl: "https://oauth2.googleapis.com/revoke", extraAuthorizeParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "false" }, env: { id: "GOOGLE_OAUTH_CLIENT_ID", secret: "GOOGLE_OAUTH_CLIENT_SECRET" } };

export const PROVIDERS: Record<Connector, ProviderConfig> = {
  JIRA: {
    authorizeUrl: "https://auth.atlassian.com/authorize", tokenUrl: "https://auth.atlassian.com/oauth/token",
    scopes: ["read:jira-work", "read:jira-user", "offline_access"],
    extraAuthorizeParams: { audience: "api.atlassian.com", prompt: "consent" },
    clientAuth: "json_body", pkce: false, revokeUrl: null, env: { id: "JIRA_OAUTH_CLIENT_ID", secret: "JIRA_OAUTH_CLIENT_SECRET" },
  },
  GMAIL: { ...GOOGLE, scopes: ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly"] },
  GOOGLE_DRIVE: { ...GOOGLE, scopes: ["openid", "email", "https://www.googleapis.com/auth/drive.readonly"] },
  FIGMA: {
    authorizeUrl: "https://www.figma.com/oauth", tokenUrl: "https://api.figma.com/v1/oauth/token",
    // Exactly the endpoints called: /v1/me, /v1/files/* (incl. /nodes) and /v1/files/*/comments.
    scopes: ["current_user:read", "file_content:read", "file_comments:read"],
    extraAuthorizeParams: {}, clientAuth: "basic", pkce: true, revokeUrl: null, env: { id: "FIGMA_OAUTH_CLIENT_ID", secret: "FIGMA_OAUTH_CLIENT_SECRET" },
  },
};

export interface ClientCredentials { clientId: string; clientSecret: string }
export function credentialsFor(connector: Connector, env: Record<string, string | undefined>): ClientCredentials | null {
  const c = PROVIDERS[connector].env; const clientId = env[c.id]?.trim(), clientSecret = env[c.secret]?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** The public origin callbacks return to. Must be https except for local development. */
export function publicOrigin(raw: string | undefined): string | null {
  if (!raw) return null;
  try { const u = new URL(raw.trim()); if (u.username || u.password || u.search || u.hash) return null; if (u.protocol !== "https:" && !(u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname))) return null; return u.origin; } catch { return null; }
}
export const redirectUri = (origin: string, connector: Connector) => `${origin}/api/connectors/${CONNECTOR_SLUG[connector]}/callback`;

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function authorizeUrl(connector: Connector, creds: ClientCredentials, redirect: string, state: string, challenge: string | null): string {
  const p = PROVIDERS[connector];
  const url = new URL(p.authorizeUrl);
  const params: Record<string, string> = { client_id: creds.clientId, redirect_uri: redirect, response_type: "code", state, scope: p.scopes.join(" "), ...p.extraAuthorizeParams };
  if (p.pkce && challenge) { params.code_challenge = challenge; params.code_challenge_method = "S256"; }
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

type Fetch = typeof fetch;
function tokenRequest(connector: Connector, creds: ClientCredentials, body: Record<string, string>): { url: string; init: RequestInit } {
  const p = PROVIDERS[connector];
  if (p.clientAuth === "json_body") return { url: p.tokenUrl, init: { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ ...body, client_id: creds.clientId, client_secret: creds.clientSecret }) } };
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
  const form = new URLSearchParams(body);
  if (p.clientAuth === "basic") headers.authorization = `Basic ${Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64")}`;
  else { form.set("client_id", creds.clientId); form.set("client_secret", creds.clientSecret); }
  return { url: p.tokenUrl, init: { method: "POST", headers, body: form.toString() } };
}

/** Parses a token response. Provider error bodies are never surfaced; only a code is kept. */
export async function readTokenResponse(res: Response, previousRefresh: string | null, now: number): Promise<ProviderTokens> {
  if (res.status === 400 || res.status === 401) throw new ConnectorError("NEEDS_RECONNECT");
  if (res.status === 429) throw new ConnectorError("RATE_LIMITED");
  if (!res.ok) throw new ConnectorError("PROVIDER_UNAVAILABLE");
  const body = await res.json() as { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown };
  if (typeof body.access_token !== "string" || !body.access_token) throw new ConnectorError("PROVIDER_UNAVAILABLE");
  const expires = typeof body.expires_in === "number" && body.expires_in > 0 ? now + body.expires_in * 1000 : null;
  // Atlassian rotates refresh tokens on every use; Google usually does not return a new one.
  return { accessToken: body.access_token, refreshToken: typeof body.refresh_token === "string" && body.refresh_token ? body.refresh_token : previousRefresh, expiresAt: expires };
}

export async function exchangeCode(f: Fetch, connector: Connector, creds: ClientCredentials, code: string, redirect: string, verifier: string | null, now = Date.now()): Promise<ProviderTokens> {
  const body: Record<string, string> = { grant_type: "authorization_code", code, redirect_uri: redirect };
  if (PROVIDERS[connector].pkce && verifier) body.code_verifier = verifier;
  const { url, init } = tokenRequest(connector, creds, body);
  return readTokenResponse(await f(url, { ...init, signal: AbortSignal.timeout(15000) }), null, now);
}

export async function refreshTokens(f: Fetch, connector: Connector, creds: ClientCredentials, tokens: ProviderTokens, now = Date.now()): Promise<ProviderTokens> {
  if (!tokens.refreshToken) throw new ConnectorError("NEEDS_RECONNECT");
  const { url, init } = tokenRequest(connector, creds, { grant_type: "refresh_token", refresh_token: tokens.refreshToken });
  return readTokenResponse(await f(url, { ...init, signal: AbortSignal.timeout(15000) }), tokens.refreshToken, now);
}

export const needsRefresh = (t: ProviderTokens, now = Date.now()) => t.expiresAt !== null && t.expiresAt - now < 60_000;
