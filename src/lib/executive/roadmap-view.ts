import type { PlanDate, RoadmapPlan } from './types.ts';

export interface TimelineItem extends RoadmapPlan { deliveryHref?: string; readOnly?: boolean; actualPartial?: boolean; }
export function planDateLabel(date: PlanDate | null): string {
  if (!date) return 'Not recorded';
  if (date.precision === 'QUARTER') return date.value.slice(5) + ' ' + date.value.slice(0, 4);
  return new Date((date.precision === 'MONTH' ? date.value + '-01' : date.value) + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', ...(date.precision === 'DAY' ? { day: 'numeric' } : {}), year: 'numeric', timeZone: 'UTC' });
}
export function bounds(date: PlanDate): [string, string] {
  if (date.precision === 'DAY') return [date.value, date.value];
  const year = Number(date.value.slice(0, 4)), month = date.precision === 'MONTH' ? Number(date.value.slice(5)) : (Number(date.value.at(-1)) - 1) * 3 + 1;
  return [`${year}-${String(month).padStart(2, '0')}-01`, new Date(Date.UTC(year, month + (date.precision === 'QUARTER' ? 2 : 0), 0)).toISOString().slice(0, 10)];
}
export function planVariance(plan: TimelineItem): { label: string; tone: 'ready' | 'attention' | 'neutral' } {
  if (plan.status === 'ON_HOLD') return { label: 'On hold', tone: 'neutral' };
  const end = plan.actual ?? plan.forecast;
  if (!end || !plan.target || plan.target.precision !== 'DAY') return { label: plan.actual ? (plan.actualPartial ? 'Partially live' : 'Live') : plan.status === 'PROPOSED' ? 'Proposed' : 'Committed', tone: plan.actual ? 'ready' : 'neutral' };
  const days = Math.round((Date.parse(end) - Date.parse(plan.target.value)) / 86400000);
  return { label: days > 0 ? `${plan.actual ? 'Live' : 'Forecast'} +${days}d` : plan.actual ? (plan.actualPartial ? 'Partially live' : 'Live on time') : 'Forecast on time', tone: days > 0 ? 'attention' : plan.actual ? 'ready' : 'neutral' };
}
