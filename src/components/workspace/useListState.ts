'use client';
import { useCallback, useState } from 'react';
import { serializeListState, type ListFilterState } from '@/lib/workspace/list-filter';

/**
 * List filter state that lives in the URL without a server round trip:
 * `history.replaceState` integrates with the Next.js router (see the
 * "Native History API" guide) so the URL stays shareable while filtering
 * runs in memory over rows the server already rendered.
 */
export function useListState(initial: ListFilterState, facets: readonly string[], keep: readonly string[] = []) {
  const [state, setState] = useState(initial);
  const update = useCallback((next: ListFilterState) => {
    setState(next);
    if (typeof window === 'undefined') return;
    const current = new URLSearchParams(window.location.search);
    const params = new URLSearchParams(serializeListState(next, facets));
    // Parameters another control owns (e.g. an open item) survive filtering.
    for (const key of keep) { const value = current.get(key); if (value) params.set(key, value); }
    const query = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, [facets, keep]);
  return [state, update] as const;
}
