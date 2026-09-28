import { randomUUID } from "node:crypto";
import type { WorkspaceAccess } from "../auth/core.ts";
import type { StoreShape } from "../data/store.ts";
import { sha256Utf8 } from "../evidence/anchor.ts";
import type { Submission } from "../evidence/types.ts";
import { mapSourceItems, normalizeReference, type SourceRole } from "../workspace/source-mapping.ts";
import { CONNECTOR_LABEL, type ProviderSnapshot, type SourceItemSync, type SyncStatus } from "./types.ts";

export interface SnapshotImport { initiativeId: string; requestId: string; mode: "IMPORT" | "REFRESH"; role: SourceRole; snapshot: ProviderSnapshot }
export interface SnapshotResult { submissionId: string; changed: boolean; replay: boolean }

/**
 * Local-store mirror of public.import_connector_snapshot (migration 0039). Saves a
 * Source / Evidence snapshot only; it never writes Knowledge, facts or decisions.
 * Unchanged content saves nothing new; changed content keeps every earlier snapshot.
 */
export function applyConnectorSnapshot(s: StoreShape, ctx: WorkspaceAccess, input: SnapshotImport, now: string): SnapshotResult {
  const { snapshot: snap } = input;
  const i = s.initiatives.find(x => x.id === input.initiativeId && x.workspaceId === ctx.workspaceId);
  if (!i) throw new Error("This initiative is unavailable in your organization.");
  if (i.archivedAt) throw new Error("Archived — restore to import sources. Nothing was changed.");
  const text = snap.text, title = snap.title.trim(), sha = sha256Utf8(text);
  if (!text.trim() || text.length > 20000 || !title || title.length > 200) throw new Error("The snapshot is empty or too long to save as evidence.");
  const prior = s.evidenceSubmissions?.find(x => x.workspaceId === ctx.workspaceId && x.requestId === input.requestId);
  if (prior) { if (prior.createdBy !== ctx.actor.id || prior.textSha256 !== sha || prior.initiativeId !== i.id) throw new Error("This import request was already used."); return { submissionId: prior.id, changed: true, replay: true }; }
  if (input.mode === "IMPORT") {
    const lib = mapSourceItems({ containers: s.sourceContainers ?? [], items: s.sourceItems ?? [], mappings: s.sourceMappings ?? [], events: [] }, ctx,
      { initiativeId: i.id, provider: snap.provider, providerWorkspace: snap.providerWorkspace, containerReference: snap.containerReference, containerName: snap.containerName, role: input.role, items: [snap.item] }, now);
    s.sourceContainers = lib.containers; s.sourceItems = lib.items; s.sourceMappings = lib.mappings;
    for (const e of lib.events) s.activity.push({ id: e.id, workspaceId: ctx.workspaceId, initiativeId: i.id, eventType: "SOURCE_MAPPED", summary: "Source item mapped to initiative", occurredAt: e.at, entityType: "SOURCE_MAPPING", entityId: e.mappingId, payload: { before: e.before, after: e.after, actor: ctx.actor }, actorLabel: ctx.actor.label });
  }
  const container = s.sourceContainers?.find(c => c.workspaceId === ctx.workspaceId && c.provider === snap.provider && normalizeReference(c.providerWorkspace) === normalizeReference(snap.providerWorkspace) && normalizeReference(c.reference) === normalizeReference(snap.containerReference));
  const item = container && s.sourceItems?.find(x => x.workspaceId === ctx.workspaceId && x.containerId === container.id && normalizeReference(x.reference) === normalizeReference(snap.item.reference));
  if (!item || !s.sourceMappings?.some(m => m.workspaceId === ctx.workspaceId && m.initiativeId === i.id && m.itemId === item.id && !m.unlinkedAt)) throw new Error("This source is not linked to the initiative. Relink it before refreshing.");
  const syncs = (s.sourceItemSyncs ??= []);
  const sync = syncs.find(x => x.workspaceId === ctx.workspaceId && x.initiativeId === i.id && x.itemId === item.id);
  if (sync && sync.contentSha256 === sha) { Object.assign(sync, { lastCheckedAt: now, status: "CURRENT", externalUpdatedAt: snap.externalUpdatedAt, revision: sync.revision + 1 }); return { submissionId: sync.lastSubmissionId, changed: false, replay: false }; }
  const submissionId = randomUUID(), evidenceId = randomUUID();
  s.evidence.push({ id: evidenceId, initiativeId: i.id, title, sourceType: snap.evidenceSourceType, sourceId: null, sourceReference: item.reference, sourceUrl: item.url, contentSummary: text, boundary: "CURRENT_SCOPE", occurredAt: snap.occurredAt, capturedAt: now, lastVerifiedAt: null, createdBy: ctx.actor.id, createdAt: now, updatedAt: now });
  const submission: Submission = { id: submissionId, workspaceId: ctx.workspaceId, organizationId: ctx.organizationId, initiativeId: i.id, sourceItemId: item.id, evidenceId, kind: "PASTED", title, text, textSha256: sha, charLength: text.length, createdBy: ctx.actor.id, createdAt: now, requestId: input.requestId,
    origin: { connector: snap.connector, reference: item.reference, url: item.url, externalUpdatedAt: snap.externalUpdatedAt } };
  (s.evidenceSubmissions ??= []).push(submission);
  const previous = sync?.lastSubmissionId ?? null;
  if (sync) Object.assign(sync, { externalUpdatedAt: snap.externalUpdatedAt, contentSha256: sha, lastSubmissionId: submissionId, lastSyncedAt: now, lastSyncedBy: ctx.actor.id, lastCheckedAt: now, status: "CURRENT", revision: sync.revision + 1 });
  else syncs.push({ id: randomUUID(), workspaceId: ctx.workspaceId, initiativeId: i.id, itemId: item.id, connector: snap.connector, externalUpdatedAt: snap.externalUpdatedAt, contentSha256: sha, lastSubmissionId: submissionId, lastSyncedAt: now, lastSyncedBy: ctx.actor.id, lastCheckedAt: now, status: "CURRENT", revision: 1 });
  s.activity.push({ id: randomUUID(), workspaceId: ctx.workspaceId, initiativeId: i.id, eventType: sync ? "SOURCE_CHANGED" : "SOURCE_IMPORTED",
    summary: sync ? `Source changed since the last snapshot: ${item.name}. New snapshot saved; nothing confirmed.` : `Imported: ${item.name}. No product facts confirmed.`,
    occurredAt: now, entityType: "EVIDENCE", entityId: evidenceId, actorLabel: ctx.actor.label, payload: { submissionId, sourceItemId: item.id, connector: snap.connector, reference: item.reference, previousSubmissionId: previous } });
  return { submissionId, changed: true, replay: false };
}

/** Local mirror of public.record_source_check: the last snapshot stays; the transition is recorded once. */
export function applySourceCheck(s: StoreShape, ctx: WorkspaceAccess, initiativeId: string, itemId: string, status: Exclude<SyncStatus, "CURRENT">, now: string): void {
  const sync: SourceItemSync | undefined = s.sourceItemSyncs?.find(x => x.workspaceId === ctx.workspaceId && x.initiativeId === initiativeId && x.itemId === itemId);
  if (!sync) throw new Error("This source has no connected snapshot.");
  if (s.initiatives.find(x => x.id === initiativeId)?.archivedAt) throw new Error("Archived — restore to refresh sources. Nothing was changed.");
  const before = sync.status; Object.assign(sync, { lastCheckedAt: now, status, revision: sync.revision + 1 });
  if (before === status || status === "FAILED") return;
  const item = s.sourceItems?.find(x => x.id === itemId);
  s.activity.push({ id: randomUUID(), workspaceId: ctx.workspaceId, initiativeId, eventType: "SOURCE_UNAVAILABLE",
    summary: `${status === "NOT_FOUND" ? `Source not found in ${CONNECTOR_LABEL[sync.connector]} (deleted, moved or no longer shared)` : "No access to this source for the person who refreshed it"}: ${item?.name ?? "source"}. The last snapshot is kept.`,
    occurredAt: now, entityType: "SOURCE_ITEM", entityId: itemId, actorLabel: ctx.actor.label, payload: { connector: sync.connector, reference: item?.reference ?? null, status } });
}
