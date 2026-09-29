import type { MetricObservation, ProjectMetric } from "./metric-types.ts";

/* Pure presentation logic for recorded metrics. Nothing here fills a gap:
   a null observation stays "not recorded", an unapproved target is never
   compared, and no value is ever defaulted to zero. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const num = (value: number, digits = 2) => value.toLocaleString("en-GB", { maximumFractionDigits: digits });
const isPercent = (unit: string) => unit.trim() === "%";
const isCurrency = (unit: string) => /^[A-Z]{3}$/.test(unit.trim());

/** 1 234 567 → "1.23M"; below a million the full grouped value is kept. */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return num(value / 1e9, 2) + "B";
  if (abs >= 1e6) return num(value / 1e6, 2) + "M";
  return num(value, abs >= 100 ? 1 : 2);
}

/** A value with its unit, as a reader would say it. Currency prefixes, "%" attaches, other units follow. */
export function formatMetricValue(value: number, unit: string, compact = false): string {
  const body = compact ? compactNumber(value) : num(value, 3);
  if (isPercent(unit)) return body + "%";
  if (isCurrency(unit)) return unit.trim() + " " + body;
  return body + " " + unit.trim();
}

/** The same value split for display: number and unit rendered separately. */
export function valueParts(value: number, unit: string): { prefix: string; number: string; suffix: string } {
  const body = compactNumber(value);
  if (isPercent(unit)) return { prefix: "", number: body, suffix: "%" };
  if (isCurrency(unit)) return { prefix: unit.trim(), number: body, suffix: "" };
  return { prefix: "", number: body, suffix: unit.trim() };
}

const COMPARATOR: Record<"AT_MOST" | "AT_LEAST" | "EQUAL", string> = { AT_MOST: "≤", AT_LEAST: "≥", EQUAL: "=" };
export function targetText(metric: Pick<ProjectMetric, "targetValue" | "targetComparator" | "unit">): string | null {
  if (metric.targetValue === null || metric.targetComparator === null) return null;
  return `${COMPARATOR[metric.targetComparator]} ${formatMetricValue(metric.targetValue, metric.unit, true)}`;
}

/** "14–20 Sep 2026", "Aug 2026", "16 Sep 2026" — periods as recorded, never inferred. */
export function periodLabel(start: string, end: string): string {
  const [ys, ms, ds] = start.split("-").map(Number) as [number, number, number];
  const [ye, me, de] = end.split("-").map(Number) as [number, number, number];
  if (start === end) return `${ds} ${MONTHS[ms - 1]} ${ys}`;
  const lastDay = new Date(Date.UTC(ye, me, 0)).getUTCDate();
  if (ys === ye && ms === me && ds === 1 && de === lastDay) return `${MONTHS[ms - 1]} ${ys}`;
  if (ys === ye && ms === me) return `${ds}–${de} ${MONTHS[me - 1]} ${ye}`;
  if (ys === ye) return `${ds} ${MONTHS[ms - 1]} – ${de} ${MONTHS[me - 1]} ${ye}`;
  return `${ds} ${MONTHS[ms - 1]} ${ys} – ${de} ${MONTHS[me - 1]} ${ye}`;
}
/** Compact axis label for a period. */
export function periodTick(start: string, end: string): string {
  const [, ms, ds] = start.split("-").map(Number) as [number, number, number];
  const [ye, me, de] = end.split("-").map(Number) as [number, number, number];
  const lastDay = new Date(Date.UTC(ye, me, 0)).getUTCDate();
  if (ds === 1 && de === lastDay && ms === me) return MONTHS[ms - 1]!;
  return `${ds} ${MONTHS[ms - 1]}`;
}

export type TargetStatusKind = "MET" | "NOT_MET" | "NOT_RECORDED" | "NO_TARGET" | "NO_OBSERVATIONS";
export interface TargetStatus { kind: TargetStatusKind; label: string; detail: string }
export interface MetricView {
  observations: MetricObservation[];
  latest: MetricObservation | null;
  previous: MetricObservation | null;
  lastRecorded: MetricObservation | null;
  recordedCount: number;
  missingCount: number;
  approvedTarget: boolean;
  target: string | null;
  status: TargetStatus;
  delta: { value: number; text: string; relative: string | null } | null;
  deltaNote: string | null;
  captured: string | null;
}

/** Approved means every approval field is recorded, not merely a value. */
export function hasApprovedTarget(metric: ProjectMetric): boolean {
  return metric.targetValue !== null && metric.targetComparator !== null && Boolean(metric.targetOwnerLabel?.trim() && metric.targetApprovedAt);
}

export function targetStatus(metric: ProjectMetric, observation: MetricObservation | null): TargetStatus {
  const approved = hasApprovedTarget(metric), target = targetText(metric);
  if (!approved) return { kind: "NO_TARGET", label: "No approved target", detail: metric.targetNote ?? "No target has been approved, so this measure is not compared with one." };
  if (!observation) return { kind: "NO_OBSERVATIONS", label: "No observations yet", detail: `Target ${target}. Nothing has been recorded to compare with it.` };
  if (observation.value === null) return { kind: "NOT_RECORDED", label: "Not assessed", detail: `Target ${target}. The latest period was not recorded, so it is not compared.` };
  const value = observation.value, goal = metric.targetValue!;
  const met = metric.targetComparator === "AT_MOST" ? value <= goal : metric.targetComparator === "AT_LEAST" ? value >= goal : value === goal;
  const gap = Math.abs(value - goal), gapText = isPercent(metric.unit) ? `${num(gap)} pp` : formatMetricValue(gap, metric.unit, true);
  if (met) return { kind: "MET", label: "Target met", detail: `Target ${target}.` + (gap ? ` ${gapText} ${value > goal ? "above" : "below"} it.` : " Exactly on target.") };
  return { kind: "NOT_MET", label: "Target not met", detail: `Target ${target}. ${gapText} ${value > goal ? "above" : "below"} it.` };
}

export function metricView(metric: ProjectMetric): MetricView {
  const observations = [...metric.observations].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd) || a.periodStart.localeCompare(b.periodStart));
  const latest = observations.at(-1) ?? null, previous = observations.at(-2) ?? null;
  const recorded = observations.filter(o => o.value !== null);
  const lastRecorded = recorded.at(-1) ?? null;
  let delta: MetricView["delta"] = null, deltaNote: string | null = null;
  if (latest && previous) {
    if (latest.value !== null && previous.value !== null) {
      const value = latest.value - previous.value, sign = value > 0 ? "+" : value < 0 ? "−" : "±";
      const text = isPercent(metric.unit) ? `${sign}${num(Math.abs(value))} pp` : `${sign}${formatMetricValue(Math.abs(value), metric.unit, true)}`;
      const relative = !isPercent(metric.unit) && previous.value !== 0 ? `${sign}${num(Math.abs(value / previous.value) * 100, 1)}%` : null;
      delta = { value, text, relative };
    } else deltaNote = latest.value === null ? "Latest period not recorded" : "Previous period not recorded";
  } else if (latest) deltaNote = "No earlier period recorded";
  return {
    observations, latest, previous, lastRecorded, recordedCount: recorded.length, missingCount: observations.length - recorded.length,
    approvedTarget: hasApprovedTarget(metric), target: targetText(metric), status: targetStatus(metric, latest), delta, deltaNote,
    captured: observations.map(o => o.capturedAt).sort().at(-1) ?? null,
  };
}

/* ── Chart geometry ───────────────────────────────────────────────────── */

/** Round tick steps (1, 2, 2.5, 5 × 10ⁿ) covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) { const pad = Math.abs(min) * 0.1 || 1; min -= pad; max += pad; }
  const raw = (max - min) / count, power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(s => s * power).find(s => s >= raw)!;
  const start = Math.floor(min / step + 1e-9) * step, end = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

export interface ChartPoint { index: number; x: number; y: number | null; observation: MetricObservation }
export interface ChartGeometry {
  width: number; height: number;
  points: ChartPoint[];
  /** Polyline runs; a run ends at an unrecorded period so the line never bridges a gap. */
  runs: { x: number; y: number }[][];
  gaps: { x: number; width: number; observation: MetricObservation }[];
  ticks: { value: number; y: number }[];
  targetY: number | null;
  band: number;
}

/**
 * Periods are evenly spaced bands; each point sits at its band centre. The value
 * domain covers every recorded value and the approved target. Counts and amounts
 * keep a zero baseline unless their spread is narrow; rates zoom to their range.
 */
export function chartGeometry(observations: MetricObservation[], { width, height, target, unit }: { width: number; height: number; target: number | null; unit: string }): ChartGeometry {
  const n = observations.length, band = n ? width / n : width;
  const values = observations.flatMap(o => o.value === null ? [] : [o.value]);
  const domainValues = target === null ? values : [...values, target];
  let ticks: number[] = [];
  if (domainValues.length) {
    const lo = Math.min(...domainValues), hi = Math.max(...domainValues);
    const zeroBased = !isPercent(unit) && lo >= 0 && lo < hi * 0.5;
    ticks = niceTicks(zeroBased ? 0 : lo, hi, 4);
  }
  const min = ticks[0] ?? 0, max = ticks.at(-1) ?? 1, span = max - min || 1;
  const yOf = (v: number) => height - ((v - min) / span) * height;
  const points = observations.map((observation, index) => ({ index, x: band * (index + 0.5), y: observation.value === null ? null : yOf(observation.value), observation }));
  const runs: { x: number; y: number }[][] = [];
  let run: { x: number; y: number }[] = [];
  for (const p of points) {
    if (p.y === null) { if (run.length) runs.push(run); run = []; }
    else run.push({ x: p.x, y: p.y });
  }
  if (run.length) runs.push(run);
  return {
    width, height, points, runs, band,
    gaps: points.filter(p => p.y === null).map(p => ({ x: band * p.index, width: band, observation: p.observation })),
    ticks: ticks.map(value => ({ value, y: yOf(value) })),
    targetY: target === null || !domainValues.length ? null : yOf(target),
  };
}

/** Horizontal position (0–1) of a calendar date across the recorded periods, or null if outside them. */
export function datePosition(observations: MetricObservation[], date: string | null): number | null {
  if (!date || !observations.length) return null;
  const n = observations.length;
  const i = observations.findIndex(o => o.periodStart <= date && date <= o.periodEnd);
  if (i < 0) return null;
  const o = observations[i]!, dayMs = 86400000;
  const length = (Date.parse(o.periodEnd) - Date.parse(o.periodStart)) / dayMs + 1;
  const offset = (Date.parse(date) - Date.parse(o.periodStart)) / dayMs;
  return (i + offset / length) / n;
}

/* ── Label placement in the trend chart ──────────────────────────────── */

export interface ChartLabelPlan {
  /** The target line's label sits at the right edge unless the latest point's label would collide with it. */
  targetSide: "left" | "right";
  /** The latest value's label sits above its point unless that would leave the plot. */
  pointBelow: boolean;
}
/** Both labels are one line high; `lineHeight` is that height in chart units. */
export function chartLabelPlan(latest: { x: number; y: number } | null, targetY: number | null, width: number, lineHeight = 16): ChartLabelPlan {
  const pointBelow = latest !== null && latest.y < lineHeight * 1.5;
  const targetSide = latest !== null && targetY !== null && latest.x > width * 0.72 && Math.abs(targetY - latest.y) < lineHeight * 2.4 ? "left" : "right";
  return { targetSide, pointBelow };
}

/* ── Freshness ───────────────────────────────────────────────────────── */

/** A metric whose last capture is older than this, as of the scenario date or today, is shown as stale. */
export const STALE_AFTER_DAYS = 42;
export function isStale(capturedAt: string | null, asOf: string): boolean {
  if (!capturedAt) return false;
  return Date.parse(asOf) - Date.parse(capturedAt) > STALE_AFTER_DAYS * 86400000;
}

/* ── Portfolio coverage ──────────────────────────────────────────────── */

export interface MetricCoverage { configured: number; met: number; notMet: number; notAssessed: number; noTarget: number; lastCaptured: string | null; synthetic: boolean }
/** Per-initiative status counts, taken from each metric's latest recorded period. */
export function metricCoverage(metrics: ProjectMetric[]): MetricCoverage {
  const views = metrics.map(metricView);
  return {
    configured: metrics.length,
    met: views.filter(v => v.status.kind === "MET").length,
    notMet: views.filter(v => v.status.kind === "NOT_MET").length,
    notAssessed: views.filter(v => v.status.kind === "NOT_RECORDED" || v.status.kind === "NO_OBSERVATIONS").length,
    noTarget: views.filter(v => v.status.kind === "NO_TARGET").length,
    lastCaptured: views.map(v => v.captured).filter((c): c is string => Boolean(c)).sort().at(-1) ?? null,
    synthetic: metrics.some(m => m.origin === "SYNTHETIC_DEMO"),
  };
}
