export const PRODUCTS = ['PGW', 'WALLET', 'SALEFNY', 'CASH_COLLECTION'] as const;
export type Product = typeof PRODUCTS[number];
export const PRODUCT_LABEL: Record<Product, string> = { PGW: 'Payment Gateway', WALLET: 'Pay by Wallet', SALEFNY: 'Salefny', CASH_COLLECTION: 'Cash Collection' };
export type BusinessUnit = 'BP' | 'FS' | 'UNASSIGNED';
export interface PerformanceRow {
  key: string; product: Product; source: string; date: string; kind: 'PAYMENT' | 'CASH_IN' | 'REFUND';
  amount: number; currency: 'EGP'; businessUnit: BusinessUnit;
  runner: string | null; supplier: string | null; terminal: string | null;
}
export interface PerformanceImport {
  id: string; fileName: string; digest: string; product: Product; source: string;
  periodStart: string; periodEnd: string; coverage: 'COMPLETE' | 'PARTIAL';
  recordedAt: string; recordedBy: string; rowCount: number; added: number; duplicates: number;
  excluded: number; note: string;
}
export interface AggregateEntry {
  id: string; product: Product; start: string; end: string; source: string; note: string;
  values: { principal: number | null; fees: number | null; collected: number | null; issuedCount: number | null; onboarded: number | null; remaining: number | null };
  recordedAt: string; recordedBy: string;
}
export interface MetricTarget { id: string; product: Product; month: string; amount: number; basis: string; approvedBy: string; approvedAt: string; }
export interface PlanDate { value: string; precision: 'DAY' | 'MONTH' | 'QUARTER'; }
export interface RoadmapPlan {
  initiativeId?: string | null;
  id: string; name: string; squad: string; workstream: string; owner: string; outcome: string;
  start: PlanDate | null; target: PlanDate | null; originalTarget: PlanDate | null;
  actual: string | null; forecast: string | null;
  status: 'PROPOSED' | 'COMMITTED' | 'ON_HOLD'; carryover: boolean;
  delayReason: string; nextAction: string; nextActionOwner: string; source: string;
  revision: number; updatedAt: string; updatedBy: string;
}
export interface PlanEvent { id: string; planId: string; before: RoadmapPlan | null; after: RoadmapPlan; at: string; actor: string; }
export interface ExecutiveState {
  schema: 1; revision: number; rows: PerformanceRow[]; imports: PerformanceImport[];
  aggregates: AggregateEntry[]; targets: MetricTarget[]; plans: RoadmapPlan[]; planEvents: PlanEvent[];
}
export const emptyExecutiveState = (): ExecutiveState => ({ schema: 1, revision: 0, rows: [], imports: [], aggregates: [], targets: [], plans: [], planEvents: [] });
