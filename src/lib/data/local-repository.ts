import "server-only";

import { assertWriteAllowed } from "@/lib/env";
import { EVIDENCE_RELATION_LABEL } from "@/lib/domain/labels";
import type {
  ActivityEntry,
  EvidencePatch,
  EvidenceRecord,
  Initiative,
  NewEvidenceInput,
  NewInitiativeInput,
} from "@/lib/domain/types";
import { readStore, writeStore } from "./store";
import { uniqueSlug, type Repository } from "./repository";

/**
 * Repository used when no Supabase project is configured.
 *
 * Backed by the local JSON store, so evidence and boundary changes survive a
 * server restart. See store.ts for what that persistence is and is not.
 *
 * It returns exactly the same domain shapes as the Supabase implementation, so
 * no UI code can tell which one is serving it.
 */

function nowIso(): string {
  return new Date().toISOString();
}

function logActivity(
  initiativeId: string,
  eventType: string,
  summary: string,
): ActivityEntry {
  const entry: ActivityEntry = {
    id: crypto.randomUUID(),
    initiativeId,
    eventType,
    summary,
    occurredAt: nowIso(),
  };
  writeStore((s) => {
    s.activity.push(entry);
  });
  return entry;
}

export const localRepository: Repository = {
  async listInitiatives() {
    return [...readStore().initiatives].sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
  },

  async getInitiativeBySlug(slug) {
    return readStore().initiatives.find((i) => i.slug === slug) ?? null;
  },

  async listActivity(initiativeId, limit = 10) {
    return readStore()
      .activity.filter((a) => a.initiativeId === initiativeId)
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, limit);
  },

  async createInitiative(input: NewInitiativeInput) {
    // Write safety — enforced here, in the data layer, not in the UI.
    assertWriteAllowed();

    const now = nowIso();
    const created: Initiative = {
      id: crypto.randomUUID(),
      slug: uniqueSlug(
        input.name,
        readStore().initiatives.map((i) => i.slug),
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

    writeStore((s) => {
      s.initiatives.push(created);
    });
    logActivity(created.id, "INITIATIVE_CREATED", "Initiative created");

    return created;
  },

  /* ── Evidence ──────────────────────────────────────────────────────────── */

  async listEvidence(initiativeId) {
    return readStore()
      .evidence.filter((e) => e.initiativeId === initiativeId)
      .sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt));
  },

  async getEvidence(id) {
    return readStore().evidence.find((e) => e.id === id) ?? null;
  },

  async createEvidence(input: NewEvidenceInput) {
    assertWriteAllowed();

    const now = nowIso();
    const created: EvidenceRecord = {
      id: crypto.randomUUID(),
      initiativeId: input.initiativeId,
      sourceId: null,
      title: input.title.trim(),
      sourceType: input.sourceType,
      sourceReference: input.sourceReference?.trim() || null,
      sourceUrl: input.sourceUrl?.trim() || null,
      contentSummary: input.contentSummary?.trim() || null,
      boundary: input.boundary,
      occurredAt: input.occurredAt || null,
      capturedAt: now,
      // A record has never been re-verified at the moment it is captured.
      // Null means unknown, which is honest; it does not mean stale.
      lastVerifiedAt: null,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    };

    writeStore((s) => {
      s.evidence.push(created);
    });
    logActivity(
      created.initiativeId,
      "EVIDENCE_ADDED",
      `${created.title} added as ${EVIDENCE_RELATION_LABEL[created.boundary]}`,
    );

    return created;
  },

  async updateEvidence(id, patch: EvidencePatch) {
    assertWriteAllowed();

    const existing = readStore().evidence.find((e) => e.id === id);
    if (!existing) throw new Error(`Evidence ${id} was not found.`);

    const boundaryChanged =
      patch.boundary !== undefined && patch.boundary !== existing.boundary;
    const previousBoundary = existing.boundary;

    const updated: EvidenceRecord = {
      ...existing,
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.sourceType !== undefined ? { sourceType: patch.sourceType } : {}),
      ...(patch.boundary !== undefined ? { boundary: patch.boundary } : {}),
      ...(patch.sourceReference !== undefined
        ? { sourceReference: patch.sourceReference?.trim() || null }
        : {}),
      ...(patch.sourceUrl !== undefined
        ? { sourceUrl: patch.sourceUrl?.trim() || null }
        : {}),
      ...(patch.contentSummary !== undefined
        ? { contentSummary: patch.contentSummary?.trim() || null }
        : {}),
      ...(patch.occurredAt !== undefined
        ? { occurredAt: patch.occurredAt || null }
        : {}),
      ...(patch.lastVerifiedAt !== undefined
        ? { lastVerifiedAt: patch.lastVerifiedAt || null }
        : {}),
      updatedAt: nowIso(),
    };

    writeStore((s) => {
      const i = s.evidence.findIndex((e) => e.id === id);
      if (i >= 0) s.evidence[i] = updated;
    });

    // A boundary change is a product decision, so it is recorded as one.
    // Other edits are metadata corrections and do not deserve an audit line.
    if (boundaryChanged) {
      logActivity(
        updated.initiativeId,
        "EVIDENCE_RECLASSIFIED",
        `${updated.title} moved from ${EVIDENCE_RELATION_LABEL[previousBoundary]} to ${EVIDENCE_RELATION_LABEL[updated.boundary]}`,
      );
    }

    return updated;
  },

  async listSources(initiativeId) {
    return readStore()
      .sources.filter((s) => s.initiativeId === initiativeId)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
};
