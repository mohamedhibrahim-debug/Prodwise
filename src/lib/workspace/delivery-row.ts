import { axis, computeWindow, days, rowMarks, xOf, type AxisMonth, type RoadmapItem, type RoadmapWindow, type RowMarks } from './roadmap-layout.ts';
import type { PortfolioRow } from './portfolio.ts';
import type { DeliveryFact } from '../delivery/types.ts';
import type { RelationshipRow } from './relationship-view.ts';
import { factDate } from '../delivery/display.ts';
import { businessLineText } from '../domain/labels.ts';
import { STAGE_LABEL } from '../domain/labels.ts';

/**
 * The Brief's one-row delivery timeline reuses the Roadmap's pure layout:
 * the same window rule, the same axis and the same marks, so a date drawn on
 * the Brief sits exactly where the Roadmap draws it. Nothing here estimates:
 * with no recorded Target Live there is no layout at all.
 */
export interface DeliveryRowLayout { window: RoadmapWindow; months: AxisMonth[]; marks: RowMarks; today: number }

export function deliveryRowLayout(item: RoadmapItem, cutoff: string): DeliveryRowLayout | null {
  if (!item.target) return null;
  const window = computeWindow([item], cutoff);
  const marks = rowMarks(item, window);
  if (!marks) return null;
  return { window, months: axis(window).months, marks, today: xOf(cutoff, window) };
}

/**
 * The same reduction the Roadmap page performs, for one portfolio row. Every
 * value is a recorded fact or a projection the rest of Prodwise already shows.
 */
export function toRoadmapItem(r: PortfolioRow, facts: Pick<DeliveryFact, 'initiativeId' | 'kind' | 'state' | 'value'>[], dependencies: RelationshipRow[]): RoadmapItem {
  const i = r.initiative;
  const fact = (kind: DeliveryFact['kind']) => facts.find(f => f.initiativeId === i.id && f.kind === kind && f.state === 'SET');
  const dev = fact('DEV_STARTED');
  return {
    id: i.id, slug: i.slug, name: i.name, stage: STAGE_LABEL[i.stage], businessLine: i.businessLine, businessLineLabel: businessLineText(i.businessLine),
    ownerId: r.ownerId, ownerLabel: r.ownerLabel, scope: fact('SCOPE')?.value.text ?? null,
    devStart: dev?.value.date ?? null,
    target: r.target?.state === 'SET' ? r.target.value.date : null, targetText: factDate(r.target), targetContext: r.target?.contextName ?? null,
    actual: r.actual?.state === 'SET' ? r.actual.value.date : null, actualExtent: r.actual?.value.extent ?? null, actualText: factDate(r.actual),
    milestone: r.milestone ? { date: r.milestone.state === 'SET' ? r.milestone.value.date : null, dateText: factDate(r.milestone), text: r.milestone.value.text ?? 'Next milestone' } : null,
    nextStep: r.nextStep?.value.text ?? null,
    movement: r.targetMovement ? { from: r.targetMovement.from, to: r.targetMovement.to, days: r.targetMovement.days } : null,
    attention: r.attention.map(a => ({ kind: a.kind, label: a.label, detail: a.detail, href: a.href })),
    dependencies: dependencies.filter(x => x.group === 'DEPENDS_ON').map(x => {
      const late = x.impact && x.impact.assessed && x.impact.late ? x.impact : null;
      return { id: x.relationship.id, otherName: x.other?.name ?? 'An initiative you can’t access', otherSlug: x.other?.slug ?? null, late: x.late,
        text: x.late ? x.impactText ?? 'Lands after the date it is needed.' : x.impact?.assessed ? 'No date impact on recorded dates' : 'Date impact not assessed',
        neededDate: late?.neededDate ?? null, providerDate: late?.providerDate ?? null, days: late?.days ?? null };
    }),
    pastTarget: r.timing.kind === 'NEEDS_UPDATE',
  };
}

/** Position of a date on a fixed horizon that starts today, as a percentage. Dates outside the horizon are clamped. */
export function horizonX(today: string, date: string, horizonDays = 28): number {
  return Math.max(0, Math.min(100, (days(today, date) / horizonDays) * 100));
}
