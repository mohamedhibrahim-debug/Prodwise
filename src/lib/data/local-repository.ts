import "server-only";

import { assertWriteAllowed } from "@/lib/env";
import type {
  ActivityEntry,
  Initiative,
  NewInitiativeInput,
} from "@/lib/domain/types";
import { SEED_ACTIVITY, SEED_INITIATIVES } from "./fixtures";
import { uniqueSlug, type Repository } from "./repository";

/**
 * In-memory repository used when no Supabase project is configured.
 *
 * It exists so the application runs end to end with zero configuration. State
 * lives for the lifetime of the server process and is not durable — that is
 * the accepted trade-off for a zero-config demo, and it is stated in the UI.
 *
 * It returns exactly the same domain shapes as the Supabase implementation, so
 * no UI code can tell which one is serving it.
 */

const initiatives: Initiative[] = SEED_INITIATIVES.map((i) => ({ ...i }));
const activity: ActivityEntry[] = SEED_ACTIVITY.map((a) => ({ ...a }));

function sortByUpdatedDesc(rows: Initiative[]): Initiative[] {
  return [...rows].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}

export const localRepository: Repository = {
  async listInitiatives() {
    return sortByUpdatedDesc(initiatives);
  },

  async getInitiativeBySlug(slug) {
    return initiatives.find((i) => i.slug === slug) ?? null;
  },

  async listActivity(initiativeId, limit = 10) {
    return activity
      .filter((a) => a.initiativeId === initiativeId)
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, limit);
  },

  async createInitiative(input: NewInitiativeInput) {
    // Phase 1 write safety — enforced here, in the data layer, not in the UI.
    assertWriteAllowed();

    const now = new Date().toISOString();
    const created: Initiative = {
      id: crypto.randomUUID(),
      slug: uniqueSlug(
        input.name,
        initiatives.map((i) => i.slug),
      ),
      name: input.name.trim(),
      description: input.description?.trim() || null,
      knownReferences: input.knownReferences?.trim() || null,
      // A new initiative has no connected evidence, so its state is genuinely
      // unknown. Never seed it with an optimistic default.
      stage: "DISCOVERY",
      overallState: "UNKNOWN",
      stateSummary: null,
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    };

    initiatives.push(created);
    activity.push({
      id: crypto.randomUUID(),
      initiativeId: created.id,
      eventType: "INITIATIVE_CREATED",
      summary: "Initiative created",
      occurredAt: now,
    });

    return created;
  },
};
