import { publicOrigin } from "../connectors/oauth.ts";

/**
 * The origin used in links Prodwise sends out (verification email, OAuth).
 * Never built from request headers: Host / X-Forwarded-Host are caller-controlled.
 * Order: PRODWISE_PUBLIC_URL → Vercel production domain → local development only.
 */
export function appOrigin(env: Record<string, string | undefined> = process.env, requestHost: string | null = null): string | null {
  const configured = publicOrigin(env.PRODWISE_PUBLIC_URL);
  if (configured) return configured;
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return publicOrigin(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
  // Development only: a loopback Host is accepted, anything else is ignored.
  if (env.NODE_ENV !== "production") {
    const local = requestHost && /^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(requestHost) ? requestHost : `localhost:${env.PORT || "3000"}`;
    return `http://${local}`;
  }
  return null;
}
