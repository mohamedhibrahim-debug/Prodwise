/**
 * The Initiatives register as plain, serialisable rows plus the facets the
 * client filters over. Facet semantics are taken from `filterPortfolioRows`
 * (the server filter the register used before) so a URL such as
 * `/initiatives?target=upcoming` means exactly what it meant before.
 */
import { applyListFilters, type FacetAccessors, type ListFilterState } from './list-filter.ts';
import type { AttentionKind } from './portfolio.ts';

export const REGISTER_FACETS = ['stage', 'owner', 'attention', 'target', 'setup', 'line', 'record'] as const;
export const REGISTER_SORTS = ['name', 'target', 'updated', 'attention'] as const;
export type RegisterSort = (typeof REGISTER_SORTS)[number];

export const ATTENTION_SLUG: Record<AttentionKind, string> = {
  DECISION: 'decision', BLOCKER: 'blocker', PAST_TARGET: 'past-target', PAST_MILESTONE: 'past-milestone',
  DEPENDENCY: 'dependency', SUPPORT_CHANGED: 'support-changed',
};
export const TARGET_FLAGS = ['upcoming', 'past', 'unknown', 'moved'] as const;

export interface RegisterRow {
  id: string; slug: string; name: string;
  businessLine: string; reference: string | null; isDemo: boolean; archived: boolean;
  stage: string; ownerId: string | null; ownerLabel: string;
  setup: { completed: number; total: number; ready: boolean; label: string };
  attention: { kind: string; label: string }[];
  target: { text: string; date: string | null; moved: string | null; flags: string[] };
  latest: { sentence: string; at: string } | null;
}

export const registerAccessors: FacetAccessors<RegisterRow> = {
  stage: r => [r.stage],
  owner: r => [r.ownerId ?? 'unassigned'],
  attention: r => (r.attention.length ? ['any', ...r.attention.map(a => a.kind)] : ['none']),
  target: r => r.target.flags,
  setup: r => [r.setup.ready ? 'ready' : 'incomplete'],
  line: r => [r.businessLine],
  // "all" is a pseudo value every row carries, so ?record=all shows both.
  record: r => [r.archived ? 'archived' : 'active', 'all'],
};

const registerText = (r: RegisterRow) => `${r.name} ${r.reference ?? ''}`;

/** Archived initiatives stay out of the register unless the URL asks for them. */
export function filterRegister(rows: readonly RegisterRow[], state: ListFilterState): RegisterRow[] {
  const effective = state.filters.record?.length ? state : { ...state, filters: { ...state.filters, record: ['active'] } };
  return sortRegister(applyListFilters(rows, effective, registerAccessors, registerText), state.sort);
}

export function sortRegister(rows: RegisterRow[], sort: string | null): RegisterRow[] {
  const byName = (a: RegisterRow, b: RegisterRow) => a.name.localeCompare(b.name);
  const copy = [...rows];
  switch (sort) {
    case 'target': return copy.sort((a, b) => (a.target.date ?? '9999').localeCompare(b.target.date ?? '9999') || byName(a, b));
    case 'updated': return copy.sort((a, b) => (b.latest?.at ?? '').localeCompare(a.latest?.at ?? '') || byName(a, b));
    case 'attention': return copy.sort((a, b) => Number(b.attention.length > 0) - Number(a.attention.length > 0) || byName(a, b));
    default: return copy.sort(byName);
  }
}

export function registerSearchText(r: RegisterRow): string { return registerText(r); }
