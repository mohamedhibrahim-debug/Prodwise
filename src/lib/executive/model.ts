import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { PRODUCTS, type ExecutiveState, type PerformanceRow, type PerformanceImport, type PlanDate, type RoadmapPlan, type Product } from './types.ts';

export function validDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}
export function money(value: unknown): number {
  const text = String(value ?? '').trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) throw Error('Amount must be a non-negative number with at most two decimal places.');
  const cents = Math.round(Number(text.replaceAll(',', '')) * 100);
  if (!Number.isSafeInteger(cents)) throw Error('Amount exceeds the supported precision.');
  return cents;
}
export function sumAmounts(rows: PerformanceRow[]): number {
  const cents = rows.reduce((sum, row) => sum + row.amount, 0);
  if (!Number.isSafeInteger(cents)) throw Error('Total exceeds the supported precision.');
  return cents;
}
export function fingerprint(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export function rowKey(source: string, id: string): string { return fingerprint([source, id]); }
export function validateProduct(value: unknown): Product {
  if (!(PRODUCTS as readonly unknown[]).includes(value)) throw Error('Select a supported product.');
  return value as Product;
}
export function mergeRows(current: PerformanceRow[], incoming: PerformanceRow[]) {
  const seen = new Map(current.map(r => [r.key, r]));
  const added: PerformanceRow[] = [];
  let duplicates = 0;
  for (const row of incoming) {
    const old = seen.get(row.key);
    if (old) {
      if (!isDeepStrictEqual(old, row)) throw Error('A transaction already exists with different values. Nothing was imported; reconcile the source before retrying.');
      duplicates++;
    } else { seen.set(row.key, row); added.push(row); }
  }
  return { added, duplicates };
}
export function publishImport(state: ExecutiveState, rows: PerformanceRow[], meta: Omit<PerformanceImport, 'id' | 'added' | 'duplicates'>): ExecutiveState {
  if (state.imports.some(i => i.digest === meta.digest)) throw Error('This file has already been imported.');
  if (rows.some(r => r.product !== meta.product || r.date < meta.periodStart || r.date > meta.periodEnd)) throw Error('Reporting coverage does not include every transaction.');
  const { added, duplicates } = mergeRows(state.rows, rows);
  if (state.rows.length + added.length > 300_000) throw Error('This workspace has reached the initial import capacity. Contact the administrator before adding more transactions.');
  return { ...state, rows: [...state.rows, ...added], imports: [...state.imports, { ...meta, id: randomUUID(), added: added.length, duplicates }] };
}
export function readPlanDate(value: string, precision: string): PlanDate | null {
  if (!value.trim()) return null;
  if (precision === 'DAY' && validDay(value)) return { value, precision };
  if (precision === 'MONTH' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return { value, precision };
  if (precision === 'QUARTER' && /^\d{4}-Q[1-4]$/.test(value)) return { value, precision };
  throw Error('Use YYYY-MM-DD, YYYY-MM, or YYYY-Q1 for the selected date precision.');
}
export function dateBounds(date: PlanDate): [string, string] {
  if (date.precision === 'DAY') return [date.value, date.value];
  const year = Number(date.value.slice(0, 4));
  const startMonth = date.precision === 'MONTH' ? Number(date.value.slice(5)) : (Number(date.value.at(-1)) - 1) * 3 + 1;
  const endMonth = startMonth + (date.precision === 'QUARTER' ? 2 : 0);
  return [`${year}-${String(startMonth).padStart(2, '0')}-01`, new Date(Date.UTC(year, endMonth, 0)).toISOString().slice(0, 10)];
}
export function delayDays(target: PlanDate | null, actual: string | null): number | null {
  if (!target || target.precision !== 'DAY' || !actual) return null;
  return Math.round((Date.parse(actual + 'T00:00:00Z') - Date.parse(target.value + 'T00:00:00Z')) / 86400000);
}
export function savePlan(state: ExecutiveState, input: RoadmapPlan, actor: string, at: string): ExecutiveState {
  const before = state.plans.find(p => p.id === input.id) ?? null;
  if (input.initiativeId && state.plans.some(p => p.initiativeId === input.initiativeId && p.id !== input.id)) throw Error('This initiative already has a roadmap entry. Reload before editing.');
  if (before && before.initiativeId !== input.initiativeId) throw Error('An existing plan cannot be linked to a different initiative.');
  if ((before?.revision ?? 0) !== input.revision) throw Error('This plan changed. Reload before saving.');
  if (!input.name.trim() || !input.source.trim()) throw Error('Enter a plan name and its source or approval note.');
  if (input.name.length > 160 || Object.values(input).some(v => typeof v === 'string' && v.length > 2000)) throw Error('One of the fields is too long.');
  if (!['PROPOSED', 'COMMITTED', 'ON_HOLD'].includes(input.status)) throw Error('Select a plan status.');
  const start = input.start ? readPlanDate(input.start.value, input.start.precision) : null;
  const target = input.target ? readPlanDate(input.target.value, input.target.precision) : null;
  if (start && target && dateBounds(start)[0] > dateBounds(target)[1]) throw Error('Solution start cannot be after Target Live.');
  if (input.actual && (!validDay(input.actual) || input.actual > at.slice(0, 10))) throw Error('Actual Live must be a real date, no later than today.');
  if (input.forecast && !validDay(input.forecast)) throw Error('Enter a valid forecast date.');
  if (input.status === 'COMMITTED' && (!target || !input.owner.trim() || !input.squad.trim())) throw Error('A committed plan needs a squad, owner and target.');
  if (before?.originalTarget && fingerprint(before.target) !== fingerprint(target) && !input.delayReason.trim()) throw Error('Record the reason for changing the committed target.');
  const after: RoadmapPlan = { ...input, id: before?.id ?? randomUUID(), start, target,
    originalTarget: before?.originalTarget ?? (input.status === 'COMMITTED' ? target : null),
    revision: (before?.revision ?? 0) + 1, updatedAt: at, updatedBy: actor };
  return { ...state, plans: [...state.plans.filter(p => p.id !== after.id), after], planEvents: [...state.planEvents, { id: randomUUID(), planId: after.id, before, after, at, actor }] };
}
