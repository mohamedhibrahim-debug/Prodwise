import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendLocalMetric, appendLocalObservation, localMetricsPath, readLocalMetrics } from "../../lib/analysis/metric-local-store.ts";
import { definitionRecord, parseDefinitionInput } from "../../lib/analysis/metric-input.ts";
import { metricView } from "../../lib/analysis/metric-view.ts";

const workspaceId = "a1000000-0000-4000-8000-000000000001";

test("define → observe round-trips through the local metrics file the reader uses", async () => {
  const root = mkdtempSync(join(tmpdir(), "prodwise-metrics-"));
  try {
    const path = localMetricsPath(root, workspaceId);
    assert.deepEqual(readLocalMetrics(path), [], "no file yet reads as no metrics, never an error");
    const parsed = parseDefinitionInput({ initiativeId: "i1", name: "Refund requests older than five days", definition: "d", unit: "requests", formula: "f", sourceLabel: "Refund desk register", periodGrain: "Calendar month", timezone: "Africa/Cairo", hasTarget: "yes", targetValue: "30", targetComparator: "AT_MOST", targetOwnerLabel: "Operations owner", targetApprovedAt: "2026-09-20" }, "2026-09-26");
    assert.ok(parsed.ok);
    if (!parsed.ok) return;
    const metric = definitionRecord(parsed.input, { id: "m1", workspaceId }, "2026-09-26T10:00:00.000Z");
    await appendLocalMetric(path, metric);
    await assert.rejects(appendLocalMetric(path, metric), /already recorded/);
    const obs = { id: "o1", periodStart: "2026-08-01", periodEnd: "2026-08-31", value: 27, capturedAt: "2026-09-02T09:00:00.000Z", sourceEvidenceId: null, note: "", origin: "HUMAN_ENTRY" as const };
    await appendLocalObservation(path, "m1", workspaceId, obs, "2026-09-26T11:00:00.000Z");
    await appendLocalObservation(path, "m1", workspaceId, { ...obs, id: "o0", periodStart: "2026-07-01", periodEnd: "2026-07-31", value: null, note: "Register not exported." }, "2026-09-26T11:01:00.000Z");
    await assert.rejects(appendLocalObservation(path, "m1", workspaceId, { ...obs, id: "o2" }, "2026-09-26T11:02:00.000Z"), /already recorded/);
    await assert.rejects(appendLocalObservation(path, "missing", workspaceId, obs, "2026-09-26T11:02:00.000Z"), /no longer available/);
    const stored = readLocalMetrics(path);
    assert.equal(stored.length, 1);
    assert.deepEqual(stored[0]!.observations.map(o => o.periodStart), ["2026-07-01", "2026-08-01"], "observations are kept in period order");
    assert.equal(stored[0]!.updatedAt, "2026-09-26T11:01:00.000Z");
    const view = metricView(stored[0]!);
    assert.equal(view.status.kind, "MET"); assert.equal(view.missingCount, 1); assert.equal(view.latest?.value, 27);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("synthetic demo metrics never accept human observations", async () => {
  const root = mkdtempSync(join(tmpdir(), "prodwise-metrics-"));
  try {
    const path = localMetricsPath(root, workspaceId);
    await appendLocalMetric(path, { id: "s1", workspaceId, initiativeId: "i1", name: "Synthetic", definition: "d", unit: "%", formula: "f", sourceLabel: "Synthetic export", sourceEvidenceId: null, periodGrain: "Weekly", timezone: "Africa/Cairo", targetValue: null, targetComparator: null, targetOwnerLabel: null, targetApprovedAt: null, targetNote: null, origin: "SYNTHETIC_DEMO", revision: 1, updatedAt: "2026-09-01T00:00:00.000Z", observations: [] });
    await assert.rejects(appendLocalObservation(path, "s1", workspaceId, { id: "o", periodStart: "2026-09-01", periodEnd: "2026-09-07", value: 1, capturedAt: "2026-09-08T00:00:00.000Z", sourceEvidenceId: null, note: "", origin: "HUMAN_ENTRY" }, "2026-09-26T00:00:00.000Z"), /read-only/);
    assert.throws(() => localMetricsPath(root, "../escape"), /verified workspace/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
