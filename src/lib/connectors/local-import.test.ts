import test from "node:test";
import assert from "node:assert/strict";
import type { WorkspaceAccess } from "../auth/core.ts";
import type { StoreShape } from "../data/store.ts";
import { applyConnectorSnapshot, applySourceCheck } from "./local-import.ts";
import type { ProviderSnapshot } from "./types.ts";

const ws = "a0000000-0000-4000-8000-000000000002";
const ctx: WorkspaceAccess = { workspaceId: ws, organizationId: "a0000000-0000-4000-8000-000000000001", memberId: "a0000000-0000-4000-8000-000000000003", role: "ORG_OWNER", platformRole: null, isProductLead: false, actor: { id: "a0000000-0000-4000-8000-000000000004", label: "Synthetic owner" } };
const initiative = { id: "a0000000-0000-4000-8000-0000000000aa", workspaceId: ws, slug: "synthetic", name: "Synthetic", description: null, knownReferences: [], businessLine: null, stage: "DELIVERY", overallState: "UNKNOWN", stateSummary: null, isDemo: false, createdBy: ctx.actor.id, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", archivedAt: null } as unknown as StoreShape["initiatives"][number];
const store = (): StoreShape => ({ initiatives: [structuredClone(initiative)], activity: [], evidence: [], sources: [], claims: [], claimEvidence: [], findingStates: [] });
const snap = (text: string): ProviderSnapshot => ({ connector: "JIRA", provider: "JIRA", providerWorkspace: "synthetic.example", containerReference: "PAY", containerName: "Payments", item: { reference: "PAY-7", name: "Fee table", kind: "Epic", url: "https://synthetic.example/browse/PAY-7" }, title: "PAY-7 · Fee table", text, evidenceSourceType: "JIRA", externalUpdatedAt: "2026-09-20T10:00:00.000+0000", occurredAt: "2026-09-20T10:00:00.000+0000" });
const rid = (n: number) => `b0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("import saves a mapped Source + Evidence snapshot and nothing else", () => {
  const s = store();
  const r = applyConnectorSnapshot(s, ctx, { initiativeId: initiative.id, requestId: rid(1), mode: "IMPORT", role: "DELIVERY", snapshot: snap("Status: In Progress") }, "2026-09-26T10:00:00Z");
  assert.equal(r.changed, true);
  assert.equal(s.evidence[0]!.sourceType, "JIRA");
  assert.equal(s.evidence[0]!.sourceUrl, "https://synthetic.example/browse/PAY-7");
  assert.equal(s.evidenceSubmissions![0]!.origin!.connector, "JIRA");
  assert.equal(s.sourceItemSyncs!.length, 1);
  assert.deepEqual(s.activity.map(a => a.eventType), ["SOURCE_MAPPED", "SOURCE_IMPORTED"]);
  assert.equal(s.claims.length, 0);
  // The same request replays.
  assert.equal(applyConnectorSnapshot(s, ctx, { initiativeId: initiative.id, requestId: rid(1), mode: "IMPORT", role: "DELIVERY", snapshot: snap("Status: In Progress") }, "2026-09-26T10:01:00Z").replay, true);
  assert.equal(s.evidence.length, 1);
});

test("refresh: unchanged saves nothing; changed keeps history and signals; unavailable is recorded once", () => {
  const s = store();
  const first = applyConnectorSnapshot(s, ctx, { initiativeId: initiative.id, requestId: rid(1), mode: "IMPORT", role: "DELIVERY", snapshot: snap("Status: In Progress") }, "2026-09-26T10:00:00Z");
  const same = applyConnectorSnapshot(s, ctx, { initiativeId: initiative.id, requestId: rid(2), mode: "REFRESH", role: "DELIVERY", snapshot: snap("Status: In Progress") }, "2026-09-26T11:00:00Z");
  assert.equal(same.changed, false); assert.equal(same.submissionId, first.submissionId); assert.equal(s.evidence.length, 1);
  const changed = applyConnectorSnapshot(s, ctx, { initiativeId: initiative.id, requestId: rid(3), mode: "REFRESH", role: "DELIVERY", snapshot: snap("Status: Blocked") }, "2026-09-26T12:00:00Z");
  assert.equal(changed.changed, true); assert.equal(s.evidence.length, 2);
  assert.equal(s.activity.at(-1)!.eventType, "SOURCE_CHANGED");
  assert.equal((s.activity.at(-1)!.payload as { previousSubmissionId: string }).previousSubmissionId, first.submissionId);
  const itemId = s.sourceItemSyncs![0]!.itemId;
  applySourceCheck(s, ctx, initiative.id, itemId, "NOT_FOUND", "2026-09-26T13:00:00Z");
  applySourceCheck(s, ctx, initiative.id, itemId, "NOT_FOUND", "2026-09-26T14:00:00Z");
  assert.equal(s.activity.filter(a => a.eventType === "SOURCE_UNAVAILABLE").length, 1);
  assert.equal(s.sourceItemSyncs![0]!.lastSubmissionId, changed.submissionId, "the last snapshot is kept");
});

test("refresh of an unlinked source and imports into archived initiatives are refused", () => {
  const s = store();
  assert.throws(() => applyConnectorSnapshot(s, ctx, { initiativeId: initiative.id, requestId: rid(1), mode: "REFRESH", role: "DELIVERY", snapshot: snap("x") }, "2026-09-26T10:00:00Z"), /not linked/);
  s.initiatives[0]!.archivedAt = "2026-09-20T00:00:00Z";
  assert.throws(() => applyConnectorSnapshot(s, ctx, { initiativeId: initiative.id, requestId: rid(2), mode: "IMPORT", role: "DELIVERY", snapshot: snap("x") }, "2026-09-26T10:00:00Z"), /Archived/);
  assert.throws(() => applyConnectorSnapshot(store(), { ...ctx, workspaceId: "other" }, { initiativeId: initiative.id, requestId: rid(3), mode: "IMPORT", role: "DELIVERY", snapshot: snap("x") }, "2026-09-26T10:00:00Z"), /unavailable/);
});
