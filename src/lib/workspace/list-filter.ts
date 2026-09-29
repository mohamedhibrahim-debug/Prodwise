/**
 * Client-side list filtering over rows the server already loaded.
 *
 * Pure and framework-free: the register and other lists keep their filter
 * state in the URL (so a filtered view is shareable and survives reload) but
 * apply it in memory, so a chip click never costs a server round trip.
 *
 * A facet is multi-select. Values inside one facet are OR-ed; facets are
 * AND-ed. Each row exposes the values it carries for a facet through an
 * accessor, which lets a row carry several values (an initiative with two
 * attention reasons matches either of them).
 */
export interface ListFilterState {
  q: string;
  filters: Record<string, string[]>;
  sort: string | null;
}

export type FacetAccessors<T> = Record<string, (row: T) => readonly string[]>;

const clean = (value: string) => value.trim();

/** Reads list state from a query string or a Next.js searchParams object. */
export function parseListState(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
  facets: readonly string[],
): ListFilterState {
  const get = (key: string): string | undefined => {
    if (input instanceof URLSearchParams) return input.get(key) ?? undefined;
    const raw = input[key];
    return Array.isArray(raw) ? raw.join(',') : raw;
  };
  const filters: Record<string, string[]> = {};
  for (const facet of facets) {
    const values = [...new Set((get(facet) ?? '').split(',').map(clean).filter(Boolean))];
    if (values.length) filters[facet] = values;
  }
  return { q: (get('q') ?? '').slice(0, 100), filters, sort: get('sort') || null };
}

/** Serialises state to a stable query string (facet order, then q, then sort). */
export function serializeListState(state: ListFilterState, facets: readonly string[]): string {
  const params = new URLSearchParams();
  for (const facet of facets) {
    const values = state.filters[facet];
    if (values?.length) params.set(facet, values.join(','));
  }
  if (state.q.trim()) params.set('q', state.q.trim());
  if (state.sort) params.set('sort', state.sort);
  return params.toString();
}

export function toggleFacetValue(state: ListFilterState, facet: string, value: string): ListFilterState {
  const current = state.filters[facet] ?? [];
  const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
  const filters = { ...state.filters };
  if (next.length) filters[facet] = next; else delete filters[facet];
  return { ...state, filters };
}

export function setFacet(state: ListFilterState, facet: string, values: string[]): ListFilterState {
  const filters = { ...state.filters };
  if (values.length) filters[facet] = [...new Set(values)]; else delete filters[facet];
  return { ...state, filters };
}

export function clearListState(state: ListFilterState): ListFilterState {
  return { q: '', filters: {}, sort: state.sort };
}

export function activeFilterCount(state: ListFilterState): number {
  return Object.values(state.filters).reduce((n, values) => n + values.length, 0) + (state.q.trim() ? 1 : 0);
}

function matchesFacets<T>(row: T, filters: Record<string, string[]>, accessors: FacetAccessors<T>, skip?: string): boolean {
  for (const [facet, wanted] of Object.entries(filters)) {
    if (facet === skip || !wanted.length) continue;
    const accessor = accessors[facet];
    if (!accessor) continue; // Unknown facets in a hand-edited URL are ignored, never fatal.
    const values = accessor(row);
    if (!wanted.some(v => values.includes(v))) return false;
  }
  return true;
}

/** Filters rows. `text` supplies the searchable text of a row (case-insensitive substring). */
export function applyListFilters<T>(
  rows: readonly T[],
  state: ListFilterState,
  accessors: FacetAccessors<T>,
  text: (row: T) => string,
): T[] {
  const q = state.q.trim().toLowerCase();
  return rows.filter(row => (!q || text(row).toLowerCase().includes(q)) && matchesFacets(row, state.filters, accessors));
}

/**
 * How many rows each value of `facet` would show, given every OTHER active
 * filter. This is what a chip menu shows next to each option, so the number
 * always equals the result count the user gets by picking it alone.
 */
export function facetCounts<T>(
  rows: readonly T[],
  state: ListFilterState,
  accessors: FacetAccessors<T>,
  text: (row: T) => string,
  facet: string,
): Map<string, number> {
  const q = state.q.trim().toLowerCase();
  const counts = new Map<string, number>();
  const accessor = accessors[facet];
  if (!accessor) return counts;
  for (const row of rows) {
    if (q && !text(row).toLowerCase().includes(q)) continue;
    if (!matchesFacets(row, state.filters, accessors, facet)) continue;
    for (const value of new Set(accessor(row))) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}
