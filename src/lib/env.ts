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

/** True when a Supabase project is configured; otherwise local fixtures serve. */
export const isSupabaseConfigured =
  supabaseUrl.length > 0 && supabaseServiceRoleKey.length > 0;

/**
 * PHASE 1 WRITE SAFETY — see CLAUDE.md §18.
 *
 * Phase 1 intentionally has no authentication. Server-side service-role access
 * must therefore not leave an unrestricted public write surface. Every mutation
 * is gated on this flag, enforced inside the repository layer rather than in
 * the UI: disabling a button is not a security control.
 *
 * Defaults to false. Only an explicit "true" opens writes.
 */
export const isDemoWriteEnabled =
  process.env.DEMO_WRITE_ENABLED?.trim().toLowerCase() === "true";

export const WRITE_DISABLED_MESSAGE =
  "Demo mode — changes are disabled in the public version.";

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
