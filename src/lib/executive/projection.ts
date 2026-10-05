import type { ExecutiveState, Product, BusinessUnit } from './types.ts';

export interface MonthlyPerformance {
  month: string; gross: number; count: number; refunds: number; refundCount: number;
  cashIn: number; cashInCount: number; payments: number; paymentCount: number;
  runners: number; suppliers: number; terminals: number; days: number;
  complete: boolean; firstDate: string; lastDate: string; sources: string[];
  byUnit: { unit: BusinessUnit; amount: number; count: number }[];
}
export function projectPerformance(state: ExecutiveState, product: Product): MonthlyPerformance[] {
  const groups = new Map<string, typeof state.rows>();
  for (const row of state.rows) if (row.product === product) { const month = row.date.slice(0, 7); const rows = groups.get(month) ?? []; rows.push(row); groups.set(month, rows); }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([month, rows]) => {
    const paid = rows.filter(r => r.kind !== 'REFUND'), refunds = rows.filter(r => r.kind === 'REFUND');
    const sum = (list: typeof rows) => list.reduce((s, r) => s + r.amount, 0);
    const count = (key: 'runner' | 'supplier' | 'terminal') => new Set(paid.map(r => r[key]).filter(Boolean)).size;
    const start = month + '-01', end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10);
    const sources = [...new Set(rows.map(r => r.source))];
    // Coverage is declared by the importer, never inferred from the first/last transaction.
    const complete = sources.every(source => state.imports.some(i => i.product === product && i.source === source && i.coverage === 'COMPLETE' && i.periodStart <= start && i.periodEnd >= end));
    const cash = paid.filter(r => r.kind === 'CASH_IN'), payments = paid.filter(r => r.kind === 'PAYMENT');
    const dates = rows.map(r => r.date).sort();
    return { month, gross: sum(paid), count: paid.length, refunds: sum(refunds), refundCount: refunds.length,
      cashIn: sum(cash), cashInCount: cash.length, payments: sum(payments), paymentCount: payments.length,
      runners: count('runner'), suppliers: count('supplier'), terminals: count('terminal'), days: new Set(paid.map(r => r.date)).size,
      complete, firstDate: dates[0]!, lastDate: dates.at(-1)!, sources,
      byUnit: (['BP', 'FS', 'UNASSIGNED'] as BusinessUnit[]).map(unit => ({ unit, amount: sum(paid.filter(r => r.businessUnit === unit)), count: paid.filter(r => r.businessUnit === unit).length })) };
  });
}
export function comparableGrowth(current: MonthlyPerformance | undefined, previous: MonthlyPerformance | undefined, field: 'gross' | 'cashIn' | 'payments'): number | null {
  if (!current?.complete || !previous?.complete || !previous[field]) return null;
  const expected = new Date(Date.UTC(Number(current.month.slice(0,4)), Number(current.month.slice(5)) - 2, 1)).toISOString().slice(0,7);
  if (previous.month !== expected || [...current.sources].sort().join() !== [...previous.sources].sort().join()) return null;
  return (current[field] / previous[field] - 1) * 100;
}
