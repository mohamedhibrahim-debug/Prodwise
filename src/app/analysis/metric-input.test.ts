import { test } from "node:test";
import assert from "node:assert/strict";
import { definitionRecord, parseDefinitionInput, parseNumber, parseObservationInput } from "../../lib/analysis/metric-input.ts";

const today = "2026-09-26";
const good = { initiativeId: "i1", name: "Refund requests older than five days", definition: "Open refund requests older than five business days at month end.", unit: "requests", formula: "Count of open refund requests with age > 5 business days at period end", sourceLabel: "Refund desk register", sourceEvidenceId: "", periodGrain: "Calendar month", timezone: "Africa/Cairo" };

test("numbers are read as people type them and never coerced to zero", () => {
  assert.equal(parseNumber("4,380,000"), 4380000);
  assert.equal(parseNumber("96.6"), 96.6);
  assert.equal(parseNumber("−3"), -3);
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber("about 40"), null);
  assert.equal(parseNumber("0"), 0);
});

test("a definition needs every contract field; a target exists only with all four approval fields", () => {
  const ok = parseDefinitionInput(good, today);
  assert.ok(ok.ok);
  if (ok.ok) { assert.equal(ok.input.target, null); assert.equal(ok.input.sourceEvidenceId, null); assert.equal(ok.input.timezone, "Africa/Cairo"); }
  const missing = parseDefinitionInput({ ...good, name: "  ", formula: "" }, today);
  assert.ok(!missing.ok);
  if (!missing.ok) assert.deepEqual(Object.keys(missing.errors).sort(), ["formula", "name"]);
  const partial = parseDefinitionInput({ ...good, hasTarget: "yes", targetValue: "30", targetComparator: "AT_MOST" }, today);
  assert.ok(!partial.ok);
  if (!partial.ok) assert.deepEqual(Object.keys(partial.errors).sort(), ["targetApprovedAt", "targetOwnerLabel"]);
  const future = parseDefinitionInput({ ...good, hasTarget: "yes", targetValue: "30", targetComparator: "AT_MOST", targetOwnerLabel: "Operations owner", targetApprovedAt: "2026-10-01" }, today);
  assert.ok(!future.ok && "targetApprovedAt" in future.errors);
  const approved = parseDefinitionInput({ ...good, hasTarget: "yes", targetValue: "30", targetComparator: "AT_MOST", targetOwnerLabel: "Operations owner", targetApprovedAt: "2026-09-20", targetNote: "Agreed at the September review." }, today);
  assert.ok(approved.ok);
  if (approved.ok) assert.deepEqual(approved.input.target, { value: 30, comparator: "AT_MOST", ownerLabel: "Operations owner", approvedAt: "2026-09-20", note: "Agreed at the September review." });
  const grain = parseDefinitionInput({ ...good, periodGrain: "custom", periodGrainCustom: "Per settlement cycle" }, today);
  assert.ok(grain.ok && grain.input.periodGrain === "Per settlement cycle");
  const zone = parseDefinitionInput({ ...good, timezone: "Mars/Olympus" }, today);
  assert.ok(!zone.ok && "timezone" in zone.errors);
  const long = parseDefinitionInput({ ...good, unit: "x".repeat(41) }, today);
  assert.ok(!long.ok && "unit" in long.errors);
});

test("the stored record is origin HUMAN_ENTRY, revision 1, with no observations and the approval as a timestamp", () => {
  const parsed = parseDefinitionInput({ ...good, hasTarget: "yes", targetValue: "30", targetComparator: "AT_MOST", targetOwnerLabel: "Operations owner", targetApprovedAt: "2026-09-20" }, today);
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  const record = definitionRecord(parsed.input, { id: "m1", workspaceId: "w1" }, "2026-09-26T10:00:00.000Z");
  assert.equal(record.origin, "HUMAN_ENTRY"); assert.equal(record.revision, 1); assert.deepEqual(record.observations, []);
  assert.equal(record.targetApprovedAt, "2026-09-20T00:00:00.000Z"); assert.equal(record.targetValue, 30); assert.equal(record.targetNote, null);
});

test("an observation carries a value or an explicit not-recorded note, within a valid period", () => {
  const base = { metricId: "m1", periodStart: "2026-09-14", periodEnd: "2026-09-20", capturedAt: "2026-09-21T09:00" };
  const ok = parseObservationInput({ ...base, value: "1,240" });
  assert.ok(ok.ok);
  if (ok.ok) { assert.equal(ok.input.value, 1240); assert.equal(ok.input.note, ""); assert.equal(ok.input.capturedAt, new Date("2026-09-21T09:00").toISOString()); }
  const gap = parseObservationInput({ ...base, notRecorded: "yes", note: "The export failed for this week." });
  assert.ok(gap.ok && gap.input.value === null);
  const silentGap = parseObservationInput({ ...base, notRecorded: "yes" });
  assert.ok(!silentGap.ok && "note" in silentGap.errors);
  const zeroTyped = parseObservationInput({ ...base, value: "0" });
  assert.ok(zeroTyped.ok && zeroTyped.input.value === 0, "a typed zero is a recorded zero");
  const blank = parseObservationInput({ ...base, value: "" });
  assert.ok(!blank.ok && "value" in blank.errors, "a blank value is never zero");
  const reversed = parseObservationInput({ ...base, periodEnd: "2026-09-10", value: "1" });
  assert.ok(!reversed.ok && "periodEnd" in reversed.errors);
  const early = parseObservationInput({ ...base, value: "1", capturedAt: "2026-09-01T09:00" });
  assert.ok(!early.ok && "capturedAt" in early.errors);
});
