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
  MemoryClaim,
  EvidencePatch,
  EvidenceRecord,
  FindingState,
  Initiative,
  InitiativeSnapshot,
  NewClaimInput,
  NewEvidenceInput,
  NewInitiativeInput,
} from "@/lib/domain/types";
import { canOrdinaryUpdateStatus, validateVerification } from "@/lib/domain/trust";
import { readStore, writeStore, writeStoreAtomic, type StoredClaim } from "./store";
import { runReview } from "../review/engine";
import { normalise } from "../review/normalise";
import { uniqueSlug, type Repository } from "./repository";
import { partitionEvidenceLinks } from "./claim-evidence-links";

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
  structured?: {
    entityType: string;
    entityId: string;
    payload: Record<string, unknown>;
    actorLabel: string;
  },
): ActivityEntry {
  const entry: ActivityEntry = {
    id: crypto.randomUUID(),
    initiativeId,
    eventType,
    summary,
    occurredAt: nowIso(),
    entityType: structured?.entityType ?? null,
    entityId: structured?.entityId ?? null,
    payload: structured?.payload ?? null,
    actorLabel: structured?.actorLabel ?? null,
  };
  writeStore((s) => {
    s.activity.push(entry);
  });
  return entry;
}

/** Resolves a claim's provenance so no caller has to touch the link table. */
function withEvidence(claim: StoredClaim): MemoryClaim {
  const store = readStore();
  const linked = store.claimEvidence
    .filter((l) => l.claimId === claim.id)
    .map((l) => l.evidenceId);
  const evidence = store.evidence
    .filter((e) => linked.includes(e.id))
    .sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt));
  return {
    ...claim,
    evidence,
    anchors: store.claimEvidence
      .filter((l) => l.claimId === claim.id)
      .map((l) => ({ evidenceId: l.evidenceId, locator: l.locator, excerpt: l.excerpt })),
    origin: claim.origin,
    verifiedAt: claim.verifiedAt,
    verifiedActorId: claim.verifiedActorId,
    verifiedActorLabel: claim.verifiedActorLabel,
    verificationBasis: claim.verificationBasis,
    verificationNote: claim.verificationNote,
  };
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

  async listInitiativeSnapshots() {
    const store = readStore();
    return store.initiatives
      .map((initiative): InitiativeSnapshot => ({
        initiative: { ...initiative },
        evidence: store.evidence.filter((e) => e.initiativeId === initiative.id),
        claims: store.claims
          .filter((c) => c.initiativeId === initiative.id)
          .map((claim) => withEvidence(claim)),
        findingStates: store.findingStates.filter(
          (state) => state.initiativeId === initiative.id,
        ),
      }))
      .sort(
        (a, b) =>
          Date.parse(b.initiative.updatedAt) -
          Date.parse(a.initiative.updatedAt),
      );
  },

  async getInitiativeSnapshot(initiativeId) {
    const all = await this.listInitiativeSnapshots();
    return all.find((snapshot) => snapshot.initiative.id === initiativeId) ?? null;
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
    const created: StoredClaim = {
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
      origin: "HUMAN_ENTRY",
      verifiedAt: null,
      verifiedActorId: null,
      verifiedActorLabel: null,
      verificationBasis: null,
      verificationNote: null,
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
    if (
      patch.status !== undefined &&
      !canOrdinaryUpdateStatus(existing.status, patch.status)
    ) {
      throw new Error("Verify this claim to make it active.");
    }

    const merged: StoredClaim = {
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

    const current = store.claimEvidence.filter((l) => l.claimId === claimId);
    const { retained, removed, addedEvidenceIds } = partitionEvidenceLinks(
      current,
      evidenceIds,
    );
    const now = nowIso();
    const retainedIds = new Set(retained.map((link) => link.evidenceId));

    writeStore((s) => {
      s.claimEvidence = s.claimEvidence.filter(
        (link) => link.claimId !== claimId || retainedIds.has(link.evidenceId),
      );
      for (const evidenceId of addedEvidenceIds) {
        s.claimEvidence.push({
          claimId,
          evidenceId,
          createdAt: now,
          locator: null,
          excerpt: null,
        });
      }
    });

    const byId = new Map(store.evidence.map((e) => [e.id, e]));

    for (const id of addedEvidenceIds) {
      logActivity(
        claim.initiativeId,
        "CLAIM_EVIDENCE_LINKED",
        `${claim.subject} linked to evidence ${byId.get(id)?.title ?? id}`,
      );
    }
    for (const link of removed) {
      const id = link.evidenceId;
      logActivity(
        claim.initiativeId,
        "CLAIM_EVIDENCE_UNLINKED",
        `${claim.subject} unlinked from evidence ${byId.get(id)?.title ?? id}`,
      );
    }
  },

  async verifyClaim(id, input) {
    assertWriteAllowed();
    const actorLabel = input.actor.label.trim();
    if (!actorLabel) throw new Error("Actor is required.");
    let result: MemoryClaim | null = null;
    let failure: string | null = null;
    writeStore((s) => {
      const claim = s.claims.find((c) => c.id === id);
      if (!claim) {
        failure = `Claim ${id} was not found.`;
        return;
      }
      const linked = s.claimEvidence
        .filter((l) => l.claimId === id)
        .map((l) => s.evidence.find((e) => e.id === l.evidenceId))
        .filter((e): e is EvidenceRecord => Boolean(e));
      failure = validateVerification(
        { ...claim, evidence: linked },
        {
          basis: input.basis,
          note: input.note,
          expectedUpdatedAt: input.expectedUpdatedAt,
        },
      );
      if (failure) return;
      const previousStatus = claim.status;
      const verifiedAt = nowIso();
      Object.assign(claim, {
        status: "ACTIVE",
        verifiedAt,
        verifiedActorId: input.actor.id,
        verifiedActorLabel: actorLabel,
        verificationBasis: input.basis,
        verificationNote: input.note?.trim() || null,
        updatedAt: verifiedAt,
      });
      s.activity.push({
        id: crypto.randomUUID(),
        initiativeId: claim.initiativeId,
        eventType: "CLAIM_VERIFIED",
        summary: `${claim.subject} verified`,
        occurredAt: verifiedAt,
        entityType: "claim",
        entityId: claim.id,
        payload: {
          previousStatus,
          basis: input.basis,
          note: input.note?.trim() || null,
          evidence: linked.map((e) => ({ id: e.id, boundary: e.boundary })),
          origin: claim.origin,
          actor: { ...input.actor, label: actorLabel },
        },
        actorLabel,
      });
      result = withEvidence(claim);
    });
    if (failure) throw new Error(failure);
    if (!result) throw new Error(`Claim ${id} was not found.`);
    return result;
  },

  async setEvidenceAnchor(claimId, evidenceId, input) {
    assertWriteAllowed();
    const locator = input.locator?.trim() || null;
    const excerpt = input.excerpt?.trim() || null;
    if (input.locator !== null && !locator) throw new Error("Locator cannot be blank.");
    if (input.excerpt !== null && !excerpt) throw new Error("Excerpt cannot be blank.");
    if (excerpt && excerpt.length > 2000) throw new Error("Excerpt must be 2000 characters or fewer.");
    let found = false;
    writeStore((s) => {
      const link = s.claimEvidence.find((l) => l.claimId === claimId && l.evidenceId === evidenceId);
      const claim = s.claims.find((c) => c.id === claimId);
      if (!link || !claim) return;
      found = true;
      const before = { locator: link.locator, excerpt: link.excerpt };
      link.locator = locator;
      link.excerpt = excerpt;
      s.activity.push({
        id: crypto.randomUUID(), initiativeId: claim.initiativeId,
        eventType: "CLAIM_EVIDENCE_ANCHOR_UPDATED",
        summary: `${claim.subject} evidence anchor updated`, occurredAt: nowIso(),
        entityType: "claim", entityId: claimId,
        payload: { evidenceId, before, after: { locator, excerpt }, actor: input.actor },
        actorLabel: input.actor.label,
      });
    });
    if (!found) throw new Error("That evidence link was not found.");
  },

  /* ── Review findings ─────────────────────────────────────────────────────
     Only the human decision is stored. The findings are derived. */

  async resolveConflict(plan) {
    assertWriteAllowed();
    return writeStoreAtomic((s) => {
      let now = nowIso();
      const current = s.claims.filter((claim) => claim.initiativeId === plan.initiativeId)
        .map((claim) => ({ ...claim, evidence: s.claimEvidence
          .filter((link) => link.claimId === claim.id)
          .map((link) => s.evidence.find((e) => e.id === link.evidenceId)!)
          .filter(Boolean) }));
      const finding = runReview(plan.initiativeId, current)
        .find((item) => item.fingerprint === plan.fingerprint && item.type === "CONFLICT");
      if (!finding || finding.contentDigest !== plan.contentDigest
          || finding.claims.length !== plan.members.length
          || finding.claims.some((claim) => !plan.members.some((member) => member.id === claim.claimId)))
        throw new Error("FINDING_STALE");
      const members = plan.members.map((member) => {
        const claim = s.claims.find((candidate) => candidate.id === member.id);
        if (!claim || claim.initiativeId !== plan.initiativeId || claim.status !== "ACTIVE"
            || claim.updatedAt !== member.expectedUpdatedAt) throw new Error("CLAIM_STALE");
        return claim;
      });
      const state = s.findingStates.find((item) => item.initiativeId === plan.initiativeId
        && item.fingerprint === plan.fingerprint);
      if (state?.outcome && state.resolvedAt === now) {
        now = new Date(Date.parse(now) + 1).toISOString();
      }
      if (plan.outcome === "CHOSE_EXISTING") {
        const chosen = members.find((claim) => claim.id === plan.chosenClaimId);
        if (!chosen || plan.correctedValue !== null || plan.decisionDomain !== null)
          throw new Error("INVALID_DECISION_SHAPE");
        for (const member of plan.members) {
          const claim = members.find((candidate) => candidate.id === member.id)!;
          if (member.keep !== (normalise(claim.value) === normalise(chosen.value)))
            throw new Error("FINDING_STALE");
        }
      } else if (plan.outcome === "CORRECTED_VALUE") {
        if (!plan.correctedValue?.trim() || plan.chosenClaimId !== null
          || members.some((claim) => normalise(claim.value) === normalise(plan.correctedValue!)))
          throw new Error("CHOOSE_EXISTING_VALUE");
      } else throw new Error("INVALID_DECISION_SHAPE");
      if (!plan.actor.label.trim()) throw new Error("ACTOR_REQUIRED");
      if (!plan.rationale.trim()) throw new Error("RATIONALE_REQUIRED");

      const chosen = members.find((claim) => claim.id === plan.chosenClaimId);
      let decisionClaimId: string | null = null;
      const decidedValue = chosen?.value ?? plan.correctedValue!.trim();
      if (plan.outcome === "CORRECTED_VALUE") {
        const domains = new Set(members.map((member) => member.domain));
        const domain = plan.decisionDomain ?? (domains.size === 1 ? members[0]!.domain : null);
        if (!domain || !domains.has(domain)) throw new Error("DECISION_DOMAIN_REQUIRED");
        decisionClaimId = crypto.randomUUID();
        s.claims.push({
          id: decisionClaimId, initiativeId: plan.initiativeId,
          type: "DECISION", status: "ACTIVE", subject: plan.subject,
          attribute: plan.attribute, phase: plan.phase, value: decidedValue,
          domain, confidence: null, supersededByClaimId: null, createdBy: null,
          createdAt: now, updatedAt: now, origin: "HUMAN_DECISION",
          verifiedAt: now, verifiedActorId: plan.actor.id,
          verifiedActorLabel: plan.actor.label.trim(), verificationBasis: "DIRECT_KNOWLEDGE",
          verificationNote: plan.rationale.trim(),
        });
      }
      const replacement = plan.chosenClaimId ?? decisionClaimId!;
      const snapshots = members.map((claim) => {
        const keep = plan.outcome === "CHOSE_EXISTING"
          && normalise(claim.value) === normalise(chosen!.value);
        const result = { id: claim.id, value: claim.value, statusBefore: "ACTIVE",
          statusAfter: keep ? "ACTIVE" : "SUPERSEDED",
          supersededBy: keep ? null : replacement };
        if (!keep) {
          claim.status = "SUPERSEDED";
          claim.supersededByClaimId = replacement;
          claim.updatedAt = now;
        }
        return result;
      });
      const nextState: FindingState = {
        initiativeId: plan.initiativeId, fingerprint: plan.fingerprint,
        ruleId: plan.ruleId, contentDigest: plan.contentDigest,
        subject: plan.subject, attribute: plan.attribute, phase: plan.phase,
        valuesRecorded: plan.valuesRecorded, status: "RESOLVED",
        outcome: plan.outcome, chosenClaimId: plan.chosenClaimId,
        decisionClaimId, decidedValue, resolution: plan.rationale,
        resolvedAt: now, actorId: plan.actor.id, actorLabel: plan.actor.label.trim(),
        confirmedWith: state?.confirmerLabel ?? null,
        confirmerLabel: null, confirmerSetAt: null, confirmerSetByLabel: null,
        createdAt: state?.createdAt ?? now, updatedAt: now,
      };
      if (state) Object.assign(state, nextState);
      else s.findingStates.push(nextState);
      s.activity.push({
        id: crypto.randomUUID(), initiativeId: plan.initiativeId,
        eventType: "FINDING_DECIDED",
        summary: `${plan.subject} — ${plan.attribute} decided: ${decidedValue}`,
        occurredAt: now, entityType: "finding", entityId: plan.fingerprint,
        payload: { schema: 1, fingerprint: plan.fingerprint, ruleId: plan.ruleId,
          contentDigest: plan.contentDigest, outcome: plan.outcome,
          subject: plan.subject, attribute: plan.attribute, phase: plan.phase,
          decidedValue, chosenClaimId: plan.chosenClaimId, decisionClaimId,
          members: snapshots, rationale: plan.rationale,
          confirmedWith: nextState.confirmedWith,
          actor: { id: plan.actor.id, label: plan.actor.label.trim() } },
        actorLabel: plan.actor.label.trim(),
      });
      return { outcome: plan.outcome, chosenClaimId: plan.chosenClaimId,
        decisionClaimId, supersededIds: snapshots
          .filter((item) => item.statusAfter === "SUPERSEDED").map((item) => item.id) };
    });
  },

  async listRecentActivity(limit = 8) {
    return [...readStore().activity]
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
      .slice(0, limit);
  },

  async assignFindingConfirmer(plan) {
    assertWriteAllowed();
    writeStoreAtomic((s) => {
      if (!plan.actor.label.trim() || (plan.label !== null
          && (plan.label.trim().length < 1 || plan.label.trim().length > 120)))
        throw new Error("INVALID_CONFIRMER");
      const current = s.claims.filter((claim) => claim.initiativeId === plan.initiativeId)
        .map((claim) => ({ ...claim, evidence: s.claimEvidence
          .filter((link) => link.claimId === claim.id)
          .map((link) => s.evidence.find((e) => e.id === link.evidenceId)!).filter(Boolean) }));
      const finding = runReview(plan.initiativeId, current)
        .find((item) => item.fingerprint === plan.fingerprint && item.type === "CONFLICT");
      const state = s.findingStates.find((item) => item.initiativeId === plan.initiativeId
        && item.fingerprint === plan.fingerprint);
      if (state?.outcome && !finding) throw new Error("DECISION_STANDING");
      if (!finding || (state?.outcome ? "REEMERGED" : "FIRST") !== plan.cycle)
        throw new Error("FINDING_STALE");
      const now = nowIso();
      const previousLabel = state?.confirmerLabel ?? null;
      const next: FindingState = state ?? {
        initiativeId: plan.initiativeId, fingerprint: plan.fingerprint,
        ruleId: finding.ruleId, contentDigest: null, subject: finding.subject,
        attribute: finding.claims[0]!.attribute, phase: finding.phase,
        valuesRecorded: null, status: "OPEN", resolution: null,
        resolvedAt: null, createdAt: now, updatedAt: now,
        outcome: null, chosenClaimId: null, decisionClaimId: null,
        decidedValue: null, confirmedWith: null, actorId: null, actorLabel: null,
        confirmerLabel: null, confirmerSetAt: null, confirmerSetByLabel: null,
      };
      next.confirmerLabel = plan.label;
      next.confirmerSetAt = plan.label === null ? null : now;
      next.confirmerSetByLabel = plan.label === null ? null : plan.actor.label.trim();
      next.updatedAt = now;
      if (!state) s.findingStates.push(next);
      s.activity.push({ id: crypto.randomUUID(), initiativeId: plan.initiativeId,
        eventType: "FINDING_CONFIRMER_ASSIGNED", summary: "Finding confirmer assigned",
        occurredAt: now, entityType: "finding", entityId: plan.fingerprint,
        payload: { schema: 1, fingerprint: plan.fingerprint, previousLabel,
          label: plan.label, cycle: plan.cycle,
          previousDecision: state?.outcome ? { outcome: state.outcome,
            decidedValue: state.decidedValue, confirmedWith: state.confirmedWith,
            decidedAt: state.resolvedAt } : null,
          actor: { id: plan.actor.id, label: plan.actor.label.trim() } },
        actorLabel: plan.actor.label.trim() });
    });
  },

  async listFindingStates(initiativeId) {
    return readStore()
      .findingStates.filter((s) => s.initiativeId === initiativeId)
      .map((s) => ({ ...s }));
  },

  async setFindingState(initiativeId, fingerprint, input) {
    assertWriteAllowed();

    if (readStore().findingStates.some((state) => state.initiativeId === initiativeId
        && state.fingerprint === fingerprint && state.outcome)) throw new Error("DECISION_IMMUTABLE");

    const now = nowIso();
    writeStore((s) => {
      const existing = s.findingStates.find(
        (f) => f.initiativeId === initiativeId && f.fingerprint === fingerprint,
      );
      const next: FindingState = {
        initiativeId,
        fingerprint,
        ruleId: input.ruleId,
        contentDigest: input.contentDigest,
        // Stored here as well as in Postgres. Dropping them locally would make
        // an orphaned row unreadable on the default demo path — exactly the
        // un-interpretable audit record the schema exists to prevent — and the
        // two adapters must not differ in what they preserve.
        subject: input.subject,
        attribute: input.attribute,
        phase: input.phase,
        valuesRecorded: input.valuesRecorded,
        status: "RESOLVED",
        resolution: input.resolution,
        resolvedAt: now,
        outcome: null, chosenClaimId: null, decisionClaimId: null,
        decidedValue: null, confirmedWith: null, actorId: null, actorLabel: null,
        confirmerLabel: existing?.confirmerLabel ?? null,
        confirmerSetAt: existing?.confirmerSetAt ?? null,
        confirmerSetByLabel: existing?.confirmerSetByLabel ?? null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      if (existing) Object.assign(existing, next);
      else s.findingStates.push(next);
    });

    logActivity(
      initiativeId,
      "FINDING_RESOLVED",
      `${input.subject} finding marked resolved: ${input.resolution}`,
    );
  },

  async reopenFindingState(initiativeId, fingerprint, actor) {
    assertWriteAllowed();
    const actorLabel = actor.label.trim();
    if (!actorLabel) throw new Error("Actor is required.");

    const store = readStore();
    const existing = store.findingStates.find(
      (f) => f.initiativeId === initiativeId && f.fingerprint === fingerprint,
    );
    if (existing?.outcome) throw new Error("DECISION_NOT_REOPENABLE");
    if (!existing || existing.status === "OPEN") return false;
    writeStore((s) => {
      const state = s.findingStates.find(
        (f) => f.initiativeId === initiativeId && f.fingerprint === fingerprint,
      )!;
      const previous = { status: state.status, resolution: state.resolution, resolvedAt: state.resolvedAt };
      state.status = "OPEN";
      state.resolution = null;
      state.resolvedAt = null;
      state.updatedAt = nowIso();
      s.activity.push({
        id: crypto.randomUUID(), initiativeId, eventType: "FINDING_REOPENED",
        summary: "Finding reopened", occurredAt: state.updatedAt,
        entityType: "finding", entityId: fingerprint,
        payload: {
          previousStatus: previous.status,
          previousResolution: previous.resolution,
          previousResolvedAt: previous.resolvedAt,
          contentDigest: state.contentDigest,
          ruleId: state.ruleId,
          subject: state.subject,
          actor: { ...actor, label: actorLabel },
        },
        actorLabel,
      });
    });
    return true;
  },
};
