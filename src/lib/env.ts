import "server-only";

/**
 * Server-only environment access.
 *
 * The `server-only` import is load-bearing: if any of this is ever pulled into
 * a client component the build fails rather than silently shipping a
 * service-role key to the browser.
 */

export const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? "";
export const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

/** Configuration indicator only. Auth never falls back to local fixtures. */
export const isSupabaseConfigured =
  supabaseUrl.length > 0 && supabaseServiceRoleKey.length > 0;

/**
 * Environment write restriction. Mandatory fresh workspace membership and role
 * authorization are separate and run first in the guarded repository/actions.
 *
 * Defaults to false. Only an explicit "true" opens writes.
 */
export const isDemoWriteEnabled =
  process.env.VERCEL_ENV !== "preview" &&
  process.env.DEMO_WRITE_ENABLED?.trim().toLowerCase() === "true";

export const WRITE_DISABLED_MESSAGE = "Changes are disabled in this environment.";

/** Thrown by the repository layer when a mutation is attempted while gated. */
export class WriteDisabledError extends Error {
  readonly code = "WRITE_DISABLED";

  constructor(message: string = WRITE_DISABLED_MESSAGE) {
    super(message);
    this.name = "WriteDisabledError";
  }
}

export function assertWriteAllowed(): void {
  if (!isDemoWriteEnabled) throw new WriteDisabledError();
}
