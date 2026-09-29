import { test } from "node:test";
import assert from "node:assert/strict";
import { chartGeometry, chartLabelPlan, compactNumber, datePosition, formatMetricValue, isStale, metricCoverage, metricView, niceTicks, periodLabel, periodTick, targetStatus } from "../../lib/analysis/metric-view.ts";
import type { MetricObservation, ProjectMetric } from "../../lib/analysis/metric-types.ts";

const obs = (id: string, periodStart: string, periodEnd: string, value: number | null): MetricObservation => ({ id, periodStart, periodEnd, value, capturedAt: periodEnd + "T09:00:00.000Z", sourceEvidenceId: null, note: value === null ? "Not recorded." : "", origin: "SYNTHETIC_DEMO" });
const metric: ProjectMetric = { id: "m", workspaceId: "w", initiativeId: "i", name: "Success rate", definition: "d", unit: "%", formula: "f", sourceLabel: "Synthetic log", sourceEvidenceId: null, periodGrain: "Weekly", timezone: "Africa/Cairo", targetValue: 97, targetComparator: "AT_LEAST", targetOwnerLabel: "Synthetic owner", targetApprovedAt: "2026-08-01T00:00:00.000Z", targetNote: null, origin: "SYNTHETIC_DEMO", revision: 1, updatedAt: "2026-09-21T09:00:00.000Z",
  observations: [obs("c", "2026-09-14", "2026-09-20", 96.6), obs("a", "2026-08-31", "2026-09-06", 97.2), obs("b", "2026-09-07", "2026-09-13", 95.8)] };

test("values keep their unit: currency prefixes, percent attaches, counts follow", () => {
  assert.equal(formatMetricValue(4380000, "EGP", true), "EGP 4.38M");
  assert.equal(formatMetricValue(96.6, "%"), "96.6%");
  assert.equal(formatMetricValue(11240, "transactions", true), "11,240 transactions");
  assert.equal(formatMetricValue(0, "requests"), "0 requests");
  assert.equal(compactNumber(22000000), "22M");
});

test("periods read as recorded: week ranges, whole months, single days", () => {
  assert.equal(periodLabel("2026-09-14", "2026-09-20"), "14–20 Sep 2026");
  assert.equal(periodLabel("2026-08-01", "2026-08-31"), "Aug 2026");
  assert.equal(periodLabel("2026-09-16", "2026-09-16"), "16 Sep 2026");
  assert.equal(periodLabel("2026-08-31", "2026-09-06"), "31 Aug – 6 Sep 2026");
  assert.equal(periodTick("2026-08-01", "2026-08-31"), "Aug");
  assert.equal(periodTick("2026-09-14", "2026-09-20"), "14 Sep");
});

test("the latest period drives status; the delta uses percentage points for rates", () => {
  const v = metricView(metric);
  assert.equal(v.latest?.id, "c");
  assert.equal(v.status.kind, "NOT_MET");
  assert.match(v.status.detail, /0\.4 pp below/);
  assert.equal(v.delta?.text, "+0.8 pp");
  assert.equal(v.delta?.relative, null);
});

test("missing is not zero: an unrecorded latest period is not assessed and has no delta or fallback", () => {
  const v = metricView({ ...metric, observations: [...metric.observations, obs("d", "2026-09-21", "2026-09-27", null)] });
  assert.equal(v.latest?.value, null);
  assert.equal(v.status.kind, "NOT_RECORDED");
  assert.equal(v.delta, null);
  assert.equal(v.deltaNote, "Latest period not recorded");
  assert.equal(v.lastRecorded?.id, "c");
  assert.equal(v.missingCount, 1);
});

test("an unapproved target is never compared, and absence of observations is its own state", () => {
  assert.equal(targetStatus({ ...metric, targetApprovedAt: null }, metric.observations[0]!).kind, "NO_TARGET");
  assert.equal(targetStatus({ ...metric, targetValue: null, targetComparator: null, targetNote: "Proposed; not approved." }, null).detail, "Proposed; not approved.");
  assert.equal(targetStatus(metric, null).kind, "NO_OBSERVATIONS");
  assert.equal(targetStatus({ ...metric, targetComparator: "AT_MOST", targetValue: 3, unit: "days" }, obs("x", "2026-09-01", "2026-09-07", 3)).kind, "MET");
  const zero = metricView({ ...metric, unit: "requests", targetValue: 5, targetComparator: "AT_MOST", observations: [obs("z", "2026-09-01", "2026-09-07", 0)] });
  assert.equal(zero.status.kind, "MET", "zero is a real recorded value");
});

test("relative change is reported for amounts and counts", () => {
  const v = metricView({ ...metric, unit: "EGP", targetValue: null, targetComparator: null, observations: [obs("a", "2026-09-07", "2026-09-13", 3050000), obs("b", "2026-09-14", "2026-09-20", 4380000)] });
  assert.equal(v.delta?.text, "+EGP 1.33M");
  assert.equal(v.delta?.relative, "+43.6%");
});

test("nice ticks are round and cover the range", () => {
  assert.deepEqual(niceTicks(0, 4380000, 4), [0, 2000000, 4000000, 6000000]);
  assert.deepEqual(niceTicks(95.8, 97.2, 4), [95.5, 96, 96.5, 97, 97.5]);
  assert.equal(niceTicks(Number.NaN, 1).length, 0);
});

test("chart geometry breaks the line at unrecorded periods and marks each as a gap", () => {
  const observations = [obs("a", "2026-09-01", "2026-09-07", 10), obs("b", "2026-09-08", "2026-09-14", null), obs("c", "2026-09-15", "2026-09-21", 20), obs("d", "2026-09-22", "2026-09-28", 30)];
  const g = chartGeometry(observations, { width: 400, height: 100, target: 25, unit: "requests" });
  assert.equal(g.runs.length, 2);
  assert.deepEqual(g.runs.map(r => r.length), [1, 2]);
  assert.equal(g.gaps.length, 1);
  assert.equal(g.gaps[0]!.x, 100);
  assert.equal(g.points[1]!.y, null, "an unrecorded period has no y, never a zero");
  assert.equal(g.ticks[0]!.value, 0);
  assert.ok(g.targetY !== null && g.targetY > 0 && g.targetY < 100);
});

test("dates are placed inside the period that contains them", () => {
  const observations = [obs("a", "2026-09-07", "2026-09-13", 1), obs("b", "2026-09-14", "2026-09-20", 2)];
  assert.equal(datePosition(observations, "2026-09-10")!.toFixed(4), ((0 + 3 / 7) / 2).toFixed(4));
  assert.equal(datePosition(observations, "2026-10-01"), null);
  assert.equal(datePosition(observations, null), null);
});

test("coverage counts statuses without inventing any", () => {
  const c = metricCoverage([metric, { ...metric, id: "n", targetValue: null, targetComparator: null }, { ...metric, id: "o", observations: [] }]);
  assert.deepEqual({ ...c, lastCaptured: null }, { configured: 3, met: 0, notMet: 1, notAssessed: 1, noTarget: 1, lastCaptured: null, synthetic: true });
  assert.equal(metricCoverage([]).lastCaptured, null);
});

test("chart labels: the target label moves left when the latest point's label would collide with it (E-4)", () => {
  // Latest point at the right edge, a few units under the target line: "571 merchants" would run into "Target ≥ 600".
  assert.deepEqual(chartLabelPlan({ x: 560, y: 40 }, 20, 600), { targetSide: "left", pointBelow: false });
  // Same point, target far below: no collision.
  assert.deepEqual(chartLabelPlan({ x: 560, y: 40 }, 150, 600), { targetSide: "right", pointBelow: false });
  // A latest point in the middle of the chart never displaces the target label.
  assert.equal(chartLabelPlan({ x: 300, y: 40 }, 30, 600).targetSide, "right");
  // A point at the very top gets its label below, so it stays inside the plot.
  assert.equal(chartLabelPlan({ x: 300, y: 4 }, null, 600).pointBelow, true);
  assert.deepEqual(chartLabelPlan(null, 20, 600), { targetSide: "right", pointBelow: false });
});

test("a metric is stale after six weeks without a capture; no capture is not stale, it is unknown", () => {
  assert.equal(isStale("2026-07-05T09:00:00.000Z", "2026-09-26T10:00:00.000Z"), true);
  assert.equal(isStale("2026-09-21T09:00:00.000Z", "2026-09-26T10:00:00.000Z"), false);
  assert.equal(isStale("2026-08-15T10:00:00.000Z", "2026-09-26T10:00:00.000Z"), false);
  assert.equal(isStale(null, "2026-09-26T10:00:00.000Z"), false);
});
