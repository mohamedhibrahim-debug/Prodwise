/**
 * Pure layout for the visual Roadmap. No clock, no storage, no React: every
 * position comes from a recorded date passed in, so the same inputs always
 * draw the same roadmap. Nothing here estimates, extends or invents a date.
 */

export type RoadmapAttentionKind = 'DECISION' | 'BLOCKER' | 'PAST_TARGET' | 'PAST_MILESTONE' | 'DEPENDENCY' | 'SUPPORT_CHANGED';
export interface RoadmapAttention { kind: RoadmapAttentionKind; label: string; detail: string; href: string; }
export interface RoadmapDependency {
  id: string; otherName: string; otherSlug: string | null;
  /** Assessed from two recorded dates and the provider lands after the needed date. */
  late: boolean; text: string;
  neededDate: string | null; providerDate: string | null; days: number | null;
}
/** One initiative, reduced to the recorded facts the roadmap may draw. */
export interface RoadmapItem {
  id: string; slug: string; name: string; stage: string;
  businessLine: string; businessLineLabel: string;
  ownerId: string | null; ownerLabel: string;
  scope: string | null;
  devStart: string | null;
  target: string | null;
  /** "Unknown" when someone recorded that it is unknown; "Not recorded" when nothing was entered. */
  targetText: string; targetContext: string | null;
  actual: string | null; actualExtent: 'PARTIAL' | 'FULL' | null; actualText: string;
  milestone: { date: string | null; dateText: string; text: string } | null;
  nextStep: string | null;
  movement: { from: string; to: string; days: number } | null;
  attention: RoadmapAttention[];
  dependencies: RoadmapDependency[];
  /** Past target with no full Actual Live recorded: a request for a human update. */
  pastTarget: boolean;
}

export type RoadmapView = '' | 'attention' | 'unknown' | 'moved' | 'dependency';
export type RoadmapGrouping = 'businessLine' | 'owner';
export interface RoadmapFilters { businessLine: string; owner: string; view: RoadmapView; group: RoadmapGrouping; }

const DAY = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
function ms(date: string): number { return Date.parse(`${date}T00:00:00Z`); }
function iso(t: number): string { return new Date(t).toISOString().slice(0, 10); }
export function days(from: string, to: string): number { return Math.round((ms(to) - ms(from)) / DAY); }
function addDays(date: string, n: number): string { return iso(ms(date) + n * DAY); }
function monthStart(date: string): string { return `${date.slice(0, 7)}-01`; }
function nextMonth(date: string): string { const d = new Date(`${monthStart(date)}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return iso(d.getTime()); }

/** Every recorded date the roadmap would draw for one scheduled initiative. */
export function drawnDates(item: RoadmapItem): string[] {
  if (!item.target) return [];
  const out = [item.devStart, item.target, item.actual, item.milestone?.date ?? null, item.movement?.from ?? null];
  for (const d of item.dependencies) if (d.late) out.push(d.neededDate, d.providerDate);
  return out.filter((d): d is string => typeof d === 'string' && ISO.test(d));
}

export interface RoadmapWindow { start: string; end: string; }
/**
 * From about two weeks before the earliest recorded date (or the cutoff) to
 * about three weeks after the latest, snapped to whole months; `end` is exclusive.
 * At least three months so a single date still reads as a roadmap.
 */
export function computeWindow(items: RoadmapItem[], cutoff: string, extra: string[] = []): RoadmapWindow {
  const dates = [cutoff, ...extra.filter(d => ISO.test(d)), ...items.flatMap(drawnDates)].sort();
  const start = monthStart(addDays(dates[0]!, -14));
  // Three weeks on the right leaves room for the date label beside the last target.
  let end = nextMonth(addDays(dates.at(-1)!, 21));
  let guard = 0;
  while (monthCount({ start, end }) < 3 && guard++ < 3) end = nextMonth(end);
  return { start, end };
}
export function monthCount(w: RoadmapWindow): number {
  return (Number(w.end.slice(0, 4)) - Number(w.start.slice(0, 4))) * 12 + Number(w.end.slice(5, 7)) - Number(w.start.slice(5, 7));
}

/** Percentage across the window, clamped. A zero-length window never yields NaN. */
export function xOf(date: string, w: RoadmapWindow): number {
  const span = Math.max(1, days(w.start, w.end));
  return Math.max(0, Math.min(100, days(w.start, date) / span * 100));
}

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export interface AxisMonth { key: string; label: string; year: number; x: number; width: number; }
export interface AxisQuarter { key: string; label: string; x: number; width: number; }
export function axis(w: RoadmapWindow): { months: AxisMonth[]; quarters: AxisQuarter[] } {
  const months: AxisMonth[] = [];
  for (let m = w.start; m < w.end && months.length < 120; m = nextMonth(m)) {
    const x = xOf(m, w); const n = nextMonth(m);
    months.push({ key: m, label: MONTH[Number(m.slice(5, 7)) - 1]!, year: Number(m.slice(0, 4)), x, width: xOf(n, w) - x });
  }
  const quarters: AxisQuarter[] = [];
  for (const m of months) {
    const q = Math.floor((Number(m.key.slice(5, 7)) - 1) / 3) + 1; const key = `${m.year}-Q${q}`;
    const last = quarters.at(-1);
    if (last?.key === key) last.width += m.width; else quarters.push({ key, label: `Q${q} ${m.year}`, x: m.x, width: m.width });
  }
  return { months, quarters };
}

/** Marks for one row, in window percentages. Only recorded dates become marks. */
export interface RowMarks {
  /** Development start → Target Live, both recorded and in order. Planned. */
  planned: { x: number; width: number } | null;
  /** Development start → Actual Live, both recorded and in order. Recorded delivery. */
  delivered: { x: number; width: number } | null;
  target: { x: number; past: boolean } | null;
  live: { x: number; partial: boolean } | null;
  milestone: { x: number } | null;
  ghost: { x: number; toX: number; days: number } | null;
  dependencies: { id: string; fromX: number; toX: number; days: number | null; name: string }[];
  /** The interactive extent: every drawn mark sits inside it. */
  hit: { x: number; width: number };
  /** Put the target label left of the diamond when it would run off the right edge. */
  labelSide: 'left' | 'right';
}
export function rowMarks(item: RoadmapItem, w: RoadmapWindow): RowMarks | null {
  if (!item.target) return null;
  const t = xOf(item.target, w);
  const span = (a: string | null, b: string | null) => a && b && a <= b ? { x: xOf(a, w), width: Math.max(0.4, xOf(b, w) - xOf(a, w)) } : null;
  const planned = span(item.devStart, item.target);
  const delivered = span(item.devStart, item.actual);
  const ghost = item.movement && item.movement.to === item.target ? { x: xOf(item.movement.from, w), toX: t, days: item.movement.days } : null;
  const dependencies = item.dependencies.filter(d => d.late && d.neededDate && d.providerDate)
    .map(d => ({ id: d.id, fromX: xOf(d.neededDate!, w), toX: xOf(d.providerDate!, w), days: d.days, name: d.otherName }));
  const xs = [t, planned?.x, delivered?.x, item.actual ? xOf(item.actual, w) : undefined, item.milestone?.date ? xOf(item.milestone.date, w) : undefined, ghost?.x, ...dependencies.flatMap(d => [d.fromX, d.toX])]
    .filter((v): v is number => typeof v === 'number');
  const lo = Math.min(...xs), hi = Math.max(...xs);
  return {
    planned, delivered,
    target: { x: t, past: item.pastTarget },
    live: item.actual ? { x: xOf(item.actual, w), partial: item.actualExtent === 'PARTIAL' } : null,
    milestone: item.milestone?.date ? { x: xOf(item.milestone.date, w) } : null,
    ghost, dependencies,
    hit: { x: lo, width: hi - lo },
    labelSide: t > 86 ? 'left' : 'right',
  };
}

/**
 * "Dependency date impact" is the shared portfolio attention reason, counted per
 * initiative on either end of a late dependency — the same number Analysis,
 * Home and the register show. Never a count of relationship rows.
 */
export function hasDependencyImpact(item: Pick<RoadmapItem, 'attention'>): boolean {
  return item.attention.some(a => a.kind === 'DEPENDENCY');
}

export function applyFilters(items: RoadmapItem[], f: Pick<RoadmapFilters, 'businessLine' | 'owner' | 'view'>): RoadmapItem[] {
  return items.filter(i =>
    (!f.businessLine || i.businessLine === f.businessLine) &&
    (!f.owner || (f.owner === 'unassigned' ? !i.ownerId : i.ownerId === f.owner)) &&
    (f.view === 'attention' ? i.attention.length > 0
      : f.view === 'unknown' ? !i.target
      : f.view === 'moved' ? Boolean(i.movement)
      : f.view === 'dependency' ? hasDependencyImpact(i)
      : true));
}

export interface RoadmapGroup { key: string; label: string; items: RoadmapItem[]; }
/**
 * Scheduled initiatives grouped and ordered by recorded target; initiatives
 * with no Target Live are split into their own lane and never placed on time.
 */
export function groupItems(items: RoadmapItem[], by: RoadmapGrouping): { groups: RoadmapGroup[]; unscheduled: RoadmapItem[] } {
  const scheduled = items.filter(i => i.target), unscheduled = items.filter(i => !i.target).sort((a, b) => a.name.localeCompare(b.name));
  const map = new Map<string, RoadmapGroup>();
  for (const i of scheduled) {
    const key = by === 'owner' ? i.ownerId ?? 'unassigned' : i.businessLine;
    const label = by === 'owner' ? i.ownerLabel : i.businessLineLabel;
    if (!map.has(key)) map.set(key, { key, label, items: [] });
    map.get(key)!.items.push(i);
  }
  const groups = [...map.values()];
  for (const g of groups) g.items.sort((a, b) => a.target!.localeCompare(b.target!) || a.name.localeCompare(b.name));
  groups.sort((a, b) => (a.key === 'unassigned' ? 1 : 0) - (b.key === 'unassigned' ? 1 : 0) || a.label.localeCompare(b.label));
  return { groups, unscheduled };
}

/** URL state, so a filtered roadmap is a shareable link. Defaults are omitted. */
export function filtersToQuery(f: RoadmapFilters, cutoff: string | null): string {
  const p = new URLSearchParams();
  if (f.businessLine) p.set('businessLine', f.businessLine);
  if (f.owner) p.set('owner', f.owner);
  if (cutoff) p.set('cutoff', cutoff);
  if (f.view) p.set('view', f.view);
  if (f.group === 'owner') p.set('group', 'owner');
  const s = p.toString();
  return s ? `?${s}` : '';
}
export function parseFilters(q: { businessLine?: string; owner?: string; view?: string; group?: string }): RoadmapFilters {
  const views: RoadmapView[] = ['', 'attention', 'unknown', 'moved', 'dependency'];
  return {
    businessLine: q.businessLine ?? '', owner: q.owner ?? '',
    view: views.includes((q.view ?? '') as RoadmapView) ? (q.view ?? '') as RoadmapView : '',
    group: q.group === 'owner' ? 'owner' : 'businessLine',
  };
}
