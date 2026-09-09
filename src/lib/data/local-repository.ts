import "server-only";

import { assertWriteAllowed } from "@/lib/env";
import {
  CLAIM_STATUS_LABEL,
  EVIDENCE_RELATION_LABEL,
} from "@/lib/domain/labels";
import type {
  ActivityEntry,
  ClaimPatch,
  ClaimRecord,
  ClaimWithEvidence,
  EvidencePatch,
  EvidenceRecord,
  Initiative,
  NewClaimInput,
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

/** Resolves a claim's provenance so no caller has to touch the link table. */
function withEvidence(claim: ClaimRecord): ClaimWithEvidence {
  const store = readStore();
  const linked = store.claimEvidence
    .filter((l) => l.claimId === claim.id)
    .map((l) => l.evidenceId);
  const evidence = store.evidence
    .filter((e) => linked.includes(e.id))
    .sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt));
  return { ...claim, evidence };
}

/**
 * Logs the product-meaningful parts of an edit, in product language.
 *
 * A status move and a supersession are decisions worth an audit line; changing
 * a phase label or fixing a typo in the value is not, so those stay quiet.
 */
function logClaimChanges(before: ClaimRecord, after: ClaimRecord): void {
  if (before.status !== after.status) {
    if (after.status === "SUPERSEDED") {
      logActivity(
        after.initiativeId,
        "CLAIM_SUPERSEDED",
        `${after.subject} marked ${CLAIM_STATUS_LABEL.SUPERSEDED}`,
      );
    } else {
      logActivity(
        after.initiativeId,
        "CLAIM_STATUS_CHANGED",
        `${after.subject} changed from ${CLAIM_STATUS_LABEL[before.status]} to ${CLAIM_STATUS_LABEL[after.status]}`,
      );
    }
  }

  if (
    before.supersededByClaimId !== after.supersededByClaimId &&
    after.supersededByClaimId
  ) {
    const replacement = readStore().claims.find(
      (c) => c.id === after.supersededByClaimId,
    );
    logActivity(
      after.initiativeId,
      "CLAIM_SUPERSESSION_SET",
      `${after.subject} superseded by ${replacement?.subject ?? "another claim"}`,
    );
  }

  if (before.value !== after.value) {
    logActivity(
      after.initiativeId,
      "CLAIM_VALUE_CHANGED",
      `${after.subject} value changed from "${before.value}" to "${after.value}"`,
    );
  }
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
      businessLine: input.businessLine,
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

  /* ── Product Memory ────────────────────────────────────────────────────── */

  async listClaims(initiativeId) {
    const store = readStore();
    return store.claims
      .filter((c) => c.initiativeId === initiativeId)
      .map((c) => withEvidence(c))
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  },

  async getClaim(id) {
    const claim = readStore().claims.find((c) => c.id === id);
    return claim ? withEvidence(claim) : null;
  },

  async createClaim(input: NewClaimInput) {
    assertWriteAllowed();

    const now = nowIso();
    const created: ClaimRecord = {
      id: crypto.randomUUID(),
      initiativeId: input.initiativeId,
      type: input.type,
      // A claim nobody has verified yet is UNVERIFIED. It is not wrong, and it
      // is not low-confidence — it simply has not been checked.
      status: "UNVERIFIED",
      subject: input.subject.trim(),
      attribute: input.attribute.trim(),
      value: input.value.trim(),
      domain: input.domain,
      phase: input.phase?.trim() || null,
      confidence: null,
      supersededByClaimId: null,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    };

    writeStore((s) => {
      s.claims.push(created);
    });
    logActivity(
      created.initiativeId,
      "CLAIM_ADDED",
      `${created.subject} added as ${CLAIM_STATUS_LABEL[created.status]}`,
    );

    return created;
  },

  async updateClaim(id, patch: ClaimPatch) {
    assertWriteAllowed();

    const existing = readStore().claims.find((c) => c.id === id);
    if (!existing) throw new Error(`Claim ${id} was not found.`);

    const merged: ClaimRecord = {
      ...existing,
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.subject !== undefined ? { subject: patch.subject.trim() } : {}),
      ...(patch.attribute !== undefined
        ? { attribute: patch.attribute.trim() }
        : {}),
      ...(patch.value !== undefined ? { value: patch.value.trim() } : {}),
      ...(patch.domain !== undefined ? { domain: patch.domain } : {}),
      ...(patch.phase !== undefined ? { phase: patch.phase?.trim() || null } : {}),
      ...(patch.supersededByClaimId !== undefined
        ? { supersededByClaimId: patch.supersededByClaimId || null }
        : {}),
      updatedAt: nowIso(),
    };

    // Invariant, enforced here so it holds regardless of caller: a replacement
    // only means anything while the claim is actually superseded, and a claim
    // can never supersede itself.
    if (merged.status !== "SUPERSEDED") merged.supersededByClaimId = null;
    if (merged.supersededByClaimId === merged.id) {
      merged.supersededByClaimId = null;
    }

    writeStore((s) => {
      const i = s.claims.findIndex((c) => c.id === id);
      if (i >= 0) s.claims[i] = merged;
    });

    logClaimChanges(existing, merged);
    return merged;
  },

  async setClaimEvidence(claimId, evidenceIds) {
    assertWriteAllowed();

    const store = readStore();
    const claim = store.claims.find((c) => c.id === claimId);
    if (!claim) throw new Error(`Claim ${claimId} was not found.`);

    const before = new Set(
      store.claimEvidence.filter((l) => l.claimId === claimId).map((l) => l.evidenceId),
    );
    const after = new Set(evidenceIds);
    const now = nowIso();

    writeStore((s) => {
      s.claimEvidence = s.claimEvidence.filter((l) => l.claimId !== claimId);
      for (const evidenceId of after) {
        s.claimEvidence.push({ claimId, evidenceId, createdAt: now });
      }
    });

    const added = [...after].filter((id) => !before.has(id));
    const removed = [...before].filter((id) => !after.has(id));
    const byId = new Map(store.evidence.map((e) => [e.id, e]));

    for (const id of added) {
      logActivity(
        claim.initiativeId,
        "CLAIM_EVIDENCE_LINKED",
        `${claim.subject} linked to evidence ${byId.get(id)?.title ?? id}`,
      );
    }
    for (const id of removed) {
      logActivity(
        claim.initiativeId,
        "CLAIM_EVIDENCE_UNLINKED",
        `${claim.subject} unlinked from evidence ${byId.get(id)?.title ?? id}`,
      );
    }
  },
};
