import type {
  ActivityEntry,
  Initiative,
  NewInitiativeInput,
} from "@/lib/domain/types";

/**
 * The one data-access contract.
 *
 * Both implementations — Supabase and local fixtures — satisfy this interface
 * and return identical domain shapes. UI code must never know, or be able to
 * tell, which one is active (CLAUDE.md §17).
 *
 * Mutations are gated by DEMO_WRITE_ENABLED inside each implementation and
 * throw WriteDisabledError when writes are off (CLAUDE.md §18).
 */
export interface Repository {
  listInitiatives(): Promise<Initiative[]>;
  getInitiativeBySlug(slug: string): Promise<Initiative | null>;
  listActivity(initiativeId: string, limit?: number): Promise<ActivityEntry[]>;
  createInitiative(input: NewInitiativeInput): Promise<Initiative>;
}

/** Derives a stable, URL-safe slug. Collisions are resolved by the caller. */
export function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return base.length > 0 ? base : "initiative";
}

export function uniqueSlug(name: string, taken: Iterable<string>): string {
  const existing = new Set(taken);
  const base = slugify(name);
  if (!existing.has(base)) return base;

  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base}-${n}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}
