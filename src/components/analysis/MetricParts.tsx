import Link from "next/link";
import type { ProjectMetric } from "@/lib/analysis/metric-types";
import { chartGeometry, chartLabelPlan, datePosition, formatMetricValue, isStale, periodLabel, periodTick, valueParts, type MetricCoverage, type MetricView, type TargetStatus } from "@/lib/analysis/metric-view";
import { formatDate } from "@/lib/domain/labels";
import styles from "./metrics.module.css";

/* Metric presentation. Server-rendered inline SVG: no chart library, no client JS.
   Every unrecorded period is drawn as a hatched gap labelled "Not recorded" — never a zero. */

const GLYPH: Record<TargetStatus["kind"], string> = { MET: "✓", NOT_MET: "!", NOT_RECORDED: "–", NO_OBSERVATIONS: "–", NO_TARGET: "○" };
export function TargetStatusMark({ status, withDetail = false }: { status: TargetStatus; withDetail?: boolean }) {
  return <span className={styles.status} data-kind={status.kind}>
    <span className={styles.statusGlyph} aria-hidden="true">{GLYPH[status.kind]}</span>
    <span className={styles.statusLabel}>{status.label}</span>
    {withDetail && <span className={styles.statusDetail}>{status.detail}</span>}
  </span>;
}

export function MetricValue({ value, unit, size = "tile", missingLabel = "Not recorded" }: { value: number | null | undefined; unit: string; size?: "tile" | "hero"; missingLabel?: string }) {
  if (value === null || value === undefined) return <span className={styles.value} data-size={size} data-missing=""><span className={styles.valueMissing}>{missingLabel}</span></span>;
  const parts = valueParts(value, unit);
  return <span className={styles.value} data-size={size} title={formatMetricValue(value, unit)}>
    {parts.prefix && <span className={styles.valueUnit}>{parts.prefix}</span>}
    <span className={styles.valueNumber}>{parts.number}</span>
    {parts.suffix && <span className={styles.valueUnit}>{parts.suffix}</span>}
  </span>;
}

function DeltaLine({ view, grain }: { view: MetricView; grain: string }) {
  if (view.delta) {
    const direction = view.delta.value > 0 ? "up" : view.delta.value < 0 ? "down" : "flat";
    return <p className={styles.delta} data-direction={direction}>
      <span aria-hidden="true">{direction === "up" ? "▲" : direction === "down" ? "▼" : "■"}</span>
      {view.delta.text}{view.delta.relative && ` (${view.delta.relative})`}
      <span className={styles.deltaBase}> vs {view.previous ? periodLabel(view.previous.periodStart, view.previous.periodEnd) : "previous period"}</span>
    </p>;
  }
  return <p className={styles.delta} data-direction="none">{view.deltaNote ?? `No comparison · ${grain.toLowerCase()}`}</p>;
}

/**
 * A KPI tile in the shared stat-strip grammar (value · label · hint, a tone rule on top):
 * latest period value, the metric name, its period, change, target status and a sparkline.
 * Selecting it jumps to the metric's detail section.
 */
export function MetricTile({ metric, view, asOf }: { metric: ProjectMetric; view: MetricView; asOf: string }) {
  const latest = view.latest;
  const stale = isStale(view.captured, asOf);
  return <li className={styles.tile} data-kind={view.status.kind} data-stale={stale || undefined}>
    <a href={`#metric-${metric.id}`} className={styles.tileLink} aria-label={`${metric.name}: open detail`}>
      {latest ? <MetricValue value={latest.value} unit={metric.unit} /> : <span className={styles.value} data-size="tile" data-missing=""><span className={styles.valueMissing}>No observations yet</span></span>}
      <span className={styles.tileName}>{metric.name}</span>
      <span className={styles.tilePeriod}>{latest ? periodLabel(latest.periodStart, latest.periodEnd) : metric.periodGrain}{stale && <span className={styles.staleMark}> · stale</span>}</span>
      {latest?.value === 0 && <span className={styles.tileFallback}>Recorded zero</span>}
      {latest?.value === null && view.lastRecorded && <span className={styles.tileFallback}>Last recorded {formatMetricValue(view.lastRecorded.value!, metric.unit, true)} · {periodLabel(view.lastRecorded.periodStart, view.lastRecorded.periodEnd)}</span>}
      {latest && <DeltaLine view={view} grain={metric.periodGrain} />}
      <TargetStatusMark status={view.status} />
      {view.target && view.status.kind !== "NO_TARGET" && <span className={styles.tileTarget}>Target {view.target}</span>}
      {view.observations.length > 1 && <Sparkline view={view} />}
    </a>
  </li>;
}

/** "Last captured 21 Sept 2026", marked stale after six weeks without a capture; never a guess when nothing was captured. */
export function Freshness({ captured, asOf, configured = true, compact = false }: { captured: string | null; asOf: string; configured?: boolean; compact?: boolean }) {
  if (!captured) return <span className={styles.freshness} data-unknown="">{configured ? "No observations yet" : "—"}</span>;
  const stale = isStale(captured, asOf);
  return <span className={styles.freshness} data-stale={stale || undefined}>{stale && <span className={styles.staleGlyph} aria-hidden="true">◷</span>}{compact ? "" : "Last captured "}{formatDate(captured)}{stale && <span className={styles.staleWord}> · stale</span>}</span>;
}

/** Latest-period statuses as one segmented bar with counts: met · below target · not assessed · no target (AN-2). */
export function CoverageBar({ coverage }: { coverage: MetricCoverage }) {
  const parts = ([["MET", coverage.met, "met"], ["NOT_MET", coverage.notMet, "below target"], ["NOT_RECORDED", coverage.notAssessed, "not assessed"], ["NO_TARGET", coverage.noTarget, "no approved target"]] as const).filter(([, n]) => n > 0);
  const label = parts.map(([, n, text]) => `${n} ${text}`).join(", ");
  return <span className={styles.coverage}>
    <span className={styles.coverageBar} role="img" aria-label={label}>{parts.map(([kind, n]) => <i key={kind} data-kind={kind} style={{ flexGrow: n }} />)}</span>
    <span className={styles.coverageText} aria-hidden="true">{parts.map(([kind, n, text]) => <span key={kind} className={styles.status} data-kind={kind}><span className={styles.statusGlyph}>{GLYPH[kind]}</span>{n} {text}</span>)}</span>
  </span>;
}

export function Sparkline({ view }: { view: MetricView }) {
  // Sparklines show shape, so they zoom to the recorded range (the "%" unit disables the zero baseline).
  const g = chartGeometry(view.observations, { width: 120, height: 28, target: null, unit: "%" });
  return <svg className={styles.spark} viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    {g.gaps.map(gap => <rect key={gap.observation.id} className={styles.sparkGap} x={gap.x + 1} y={0} width={Math.max(gap.width - 2, 1)} height={28} />)}
    {g.runs.map((run, i) => run.length > 1
      ? <polyline key={i} className={styles.sparkLine} points={run.map(p => `${p.x},${p.y}`).join(" ")} vectorEffect="non-scaling-stroke" />
      : <path key={i} className={styles.sparkDot} d={`M${run[0]!.x} ${run[0]!.y}h0`} vectorEffect="non-scaling-stroke" />)}
  </svg>;
}

const H = 180, W = 600;
/** The trend over recorded periods: one series, target line, gaps for unrecorded periods, Actual Live marker. */
export function TrendChart({ metric, view, actualLive }: { metric: ProjectMetric; view: MetricView; actualLive: string | null }) {
  if (!view.observations.length) return <div className={styles.chartEmpty}><strong>No observations recorded yet.</strong> {metric.targetNote ?? "The trend appears once a period is recorded."}</div>;
  const g = chartGeometry(view.observations, { width: W, height: H, target: view.approvedTarget ? metric.targetValue : null, unit: metric.unit });
  const live = datePosition(view.observations, actualLive);
  const pct = (y: number) => `${(y / H) * 100}%`;
  const id = `chart-${metric.id}`, n = view.observations.length;
  const values = view.observations.map(o => `${periodLabel(o.periodStart, o.periodEnd)}: ${o.value === null ? "not recorded" : formatMetricValue(o.value, metric.unit)}`).join("; ");
  const latestPoint = [...g.points].reverse().find(p => p.y !== null);
  const plan = chartLabelPlan(latestPoint ? { x: latestPoint.x, y: latestPoint.y! } : null, g.targetY, W);
  return <figure className={styles.chart} data-dense={n > 7 || undefined}>
    <div className={styles.chartBody}>
      <div className={styles.axisY} aria-hidden="true">{g.ticks.map(t => <span key={t.value} style={{ top: pct(t.y) }}>{formatMetricValue(t.value, metric.unit, true).replace(/ [a-z].*$/, "")}</span>)}</div>
      <div className={styles.plot}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-labelledby={`${id}-t ${id}-d`} focusable="false">
          <title id={`${id}-t`}>{`${metric.name} by period (${metric.unit})`}</title>
          <desc id={`${id}-d`}>{`${values}.${view.target && view.approvedTarget ? ` Approved target ${view.target}.` : " No approved target."}`}</desc>
          <defs><pattern id={`${id}-hatch`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" className={styles.hatchLine} /></pattern></defs>
          {g.ticks.map(t => <line key={t.value} className={styles.grid} x1={0} x2={W} y1={t.y} y2={t.y} vectorEffect="non-scaling-stroke" />)}
          {g.gaps.map(gap => <rect key={gap.observation.id} x={gap.x + 2} y={0} width={gap.width - 4} height={H} fill={`url(#${id}-hatch)`} className={styles.gap}><title>{`${periodLabel(gap.observation.periodStart, gap.observation.periodEnd)}: not recorded`}</title></rect>)}
          {g.targetY !== null && <line className={styles.target} x1={0} x2={W} y1={g.targetY} y2={g.targetY} vectorEffect="non-scaling-stroke" />}
          {live !== null && <line className={styles.live} x1={live * W} x2={live * W} y1={0} y2={H} vectorEffect="non-scaling-stroke" />}
          {g.runs.filter(r => r.length > 1).map((run, i) => <polyline key={i} className={styles.line} points={run.map(p => `${p.x},${p.y}`).join(" ")} vectorEffect="non-scaling-stroke" />)}
          {g.points.filter(p => p.y !== null).map(p => <g key={p.observation.id}>
            <path className={styles.markerRing} d={`M${p.x} ${p.y}h0`} vectorEffect="non-scaling-stroke" />
            <path className={styles.marker} data-latest={p === latestPoint || undefined} d={`M${p.x} ${p.y}h0`} vectorEffect="non-scaling-stroke"><title>{`${periodLabel(p.observation.periodStart, p.observation.periodEnd)}: ${formatMetricValue(p.observation.value!, metric.unit)}`}</title></path>
          </g>)}
        </svg>
        {g.gaps.map(gap => <span key={gap.observation.id} className={styles.gapLabel} style={{ left: `${((gap.x + gap.width / 2) / W) * 100}%` }} aria-hidden="true">Not recorded</span>)}
        {g.targetY !== null && <span className={styles.targetLabel} data-side={plan.targetSide} style={{ top: pct(g.targetY) }} aria-hidden="true">Target {view.target}</span>}
        {live !== null && <span className={styles.liveLabel} data-side={live > 0.55 ? "left" : "right"} style={{ left: `${live * 100}%` }} aria-hidden="true">Actual Live · {formatDate(actualLive!)}</span>}
        {latestPoint && <span className={styles.pointLabel} data-side={latestPoint.x / W > 0.8 ? "left" : "center"} data-below={plan.pointBelow || undefined} style={{ left: `${(latestPoint.x / W) * 100}%`, top: pct(latestPoint.y!) }} aria-hidden="true">{formatMetricValue(latestPoint.observation.value!, metric.unit, true)}</span>}
      </div>
    </div>
    <ol className={styles.axisX} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} aria-hidden="true">
      {view.observations.map(o => <li key={o.id}>{periodTick(o.periodStart, o.periodEnd)}</li>)}
    </ol>
    <figcaption className={styles.legend}>
      <span><i className={styles.legendLine} aria-hidden="true" />Recorded value</span>
      {g.targetY !== null && <span><i className={styles.legendTarget} aria-hidden="true" />Approved target</span>}
      {g.gaps.length > 0 && <span><i className={styles.legendGap} aria-hidden="true" />Not recorded · not zero</span>}
      {live !== null && <span><i className={styles.legendLive} aria-hidden="true" />Actual Live · timing alone does not establish cause</span>}
    </figcaption>
  </figure>;
}

/** Every recorded period as a table: the accessible alternative to the chart, with each note. */
export function ObservationTable({ metric, view }: { metric: ProjectMetric; view: MetricView }) {
  if (!view.observations.length) return null;
  const rows = [...view.observations].reverse();
  return <details className={styles.table}>
    <summary>Recorded periods as a table <span>{view.recordedCount} recorded{view.missingCount ? ` · ${view.missingCount} not recorded` : ""}</span></summary>
    <div className={styles.tableWrap}><table>
      <caption className="visually-hidden">{metric.name} observations</caption>
      <thead><tr><th scope="col">Period</th><th scope="col">Value</th><th scope="col">Captured</th><th scope="col">Note</th></tr></thead>
      <tbody>{rows.map(o => <tr key={o.id} data-missing={o.value === null || undefined}>
        <th scope="row">{periodLabel(o.periodStart, o.periodEnd)}</th>
        <td>{o.value === null ? "Not recorded" : formatMetricValue(o.value, metric.unit)}</td>
        <td>{formatDate(o.capturedAt)}</td>
        <td>{o.note || "—"}</td>
      </tr>)}</tbody>
    </table></div>
  </details>;
}

/** The metric's contract, collapsed by default: what it measures, where it comes from, how it is calculated, and who approved its target. */
export function MetricContract({ metric, view, sourceHref, asOf }: { metric: ProjectMetric; view: MetricView; sourceHref: string | null; asOf: string }) {
  const first = view.observations[0], last = view.observations.at(-1);
  return <details className={styles.contract}>
    <summary><span className={styles.contractChevron} aria-hidden="true">▸</span>Metric contract <span>{metric.sourceLabel} · {view.approvedTarget ? `target ${view.target}` : "no approved target"} · {metric.origin === "SYNTHETIC_DEMO" ? "synthetic demo record" : "recorded by a person"}</span></summary>
    <dl>
      <div><dt>Definition</dt><dd>{metric.definition}</dd></div>
      <div><dt>Source</dt><dd>{sourceHref ? <Link prefetch={false} href={sourceHref}>{metric.sourceLabel} →</Link> : metric.sourceLabel}{!metric.sourceEvidenceId && <span>No evidence record linked</span>}</dd></div>
      <div><dt>Period</dt><dd>{metric.periodGrain} · {metric.timezone.replace("_", " ")}{first && last && <span>{view.observations.length} {view.observations.length === 1 ? "period" : "periods"} · {periodLabel(first.periodStart, first.periodEnd)} to {periodLabel(last.periodStart, last.periodEnd)}</span>}</dd></div>
      <div><dt>Formula</dt><dd>{metric.formula}</dd></div>
      <div><dt>Target</dt><dd>{view.approvedTarget ? view.target : "No approved target"}{metric.targetNote && <span>{metric.targetNote}</span>}</dd></div>
      <div><dt>Owner · approval</dt><dd>{view.approvedTarget ? <>{metric.targetOwnerLabel}<span>Approved {formatDate(metric.targetApprovedAt!)}</span></> : "Not approved"}</dd></div>
      <div><dt>Freshness</dt><dd><Freshness captured={view.captured} asOf={asOf} /><span>Definition updated {formatDate(metric.updatedAt)} · revision {metric.revision}</span></dd></div>
      <div><dt>Coverage</dt><dd>{view.observations.length ? `${view.recordedCount} of ${view.observations.length} periods recorded` : "No periods recorded"}{view.missingCount > 0 && <span>{view.missingCount} not recorded — shown as gaps, never zero</span>}</dd></div>
      <div><dt>Origin</dt><dd>{metric.origin === "SYNTHETIC_DEMO" ? "Synthetic demo record" : "Recorded by a person"}</dd></div>
    </dl>
  </details>;
}

/** Latest-period status counts for an initiative's metrics: glyph + count + words, never colour alone. */
export function CoverageMarks({ coverage }: { coverage: { met: number; notMet: number; notAssessed: number; noTarget: number } }) {
  const items = ([["MET", coverage.met, "met"], ["NOT_MET", coverage.notMet, "below target"], ["NOT_RECORDED", coverage.notAssessed, "not assessed"], ["NO_TARGET", coverage.noTarget, "no approved target"]] as const).filter(([, n]) => n > 0);
  return <span className={styles.marks}>{items.map(([kind, n, label]) => <span key={kind} className={styles.status} data-kind={kind}><span className={styles.statusGlyph} aria-hidden="true">{GLYPH[kind]}</span><span className={styles.statusLabel}>{n} {label}</span></span>)}</span>;
}
