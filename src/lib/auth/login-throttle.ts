import { createHash } from "node:crypto";

/**
 * Sign-in attempt throttle. Keyed by email + client address, so one address
 * cannot lock a person out everywhere. After FREE_ATTEMPTS failures the wait
 * doubles from one minute up to fifteen; a success clears it.
 *
 * Process memory only: it is a first line for local and single-instance use.
 * Hosted sign-in is additionally rate-limited by Supabase Auth.
 */
const FREE_ATTEMPTS = 5, BASE_MS = 60_000, MAX_MS = 15 * 60_000, FORGET_MS = 60 * 60_000, MAX_KEYS = 10_000;
interface Entry { failures: number; lockedUntil: number; lastAt: number }
const entries = new Map<string, Entry>();

export const throttleKey = (email: string, client: string) =>
  createHash("sha256").update(`prodwise-login:${email.trim().toLowerCase()}:${client}`).digest("hex");

/** Milliseconds still to wait, or 0 when an attempt is allowed. */
export function loginWait(key: string, now = Date.now()): number {
  const e = entries.get(key);
  if (!e) return 0;
  if (now - e.lastAt > FORGET_MS) { entries.delete(key); return 0; }
  return Math.max(0, e.lockedUntil - now);
}

export function recordLoginFailure(key: string, now = Date.now()): void {
  const prev = entries.get(key), fresh = !prev || now - prev.lastAt > FORGET_MS;
  const failures = fresh ? 1 : prev.failures + 1;
  const over = failures - FREE_ATTEMPTS;
  const lockedUntil = over > 0 ? now + Math.min(MAX_MS, BASE_MS * 2 ** (over - 1)) : 0;
  if (!prev && entries.size >= MAX_KEYS) entries.delete(entries.keys().next().value!);
  entries.set(key, { failures, lockedUntil, lastAt: now });
}

export function recordLoginSuccess(key: string): void { entries.delete(key); }

export function waitMessage(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  return `Too many sign-in attempts. Wait ${minutes === 1 ? "a minute" : `${minutes} minutes`} and try again.`;
}
