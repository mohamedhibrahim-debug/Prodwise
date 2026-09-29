'use client';
import { useRef } from 'react';
import { Menu, MenuButton } from '@/components/primitives/Popover';
import { activeFilterCount, clearListState, setFacet, toggleFacetValue, type ListFilterState } from '@/lib/workspace/list-filter';
import styles from './FilterBar.module.css';

export interface FilterFacet {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  /** Rows each option would show given the other filters. Options at zero are listed last and dimmed, never hidden once selected. */
  counts?: Map<string, number>;
  /** Single-choice facets replace their value instead of adding to it. */
  single?: boolean;
}

/**
 * Instant filter chips over already-loaded rows. Each facet is a compact
 * dropdown chip; selections apply immediately (no Apply button) and the
 * caller mirrors them into the URL.
 */
export function FilterBar({ state, onChange, facets, result, searchLabel, searchPlaceholder, search = true, children }: {
  state: ListFilterState;
  onChange: (next: ListFilterState) => void;
  facets: FilterFacet[];
  /** e.g. "12 of 14 initiatives" */
  result: string;
  searchLabel: string;
  searchPlaceholder?: string;
  /** Lists whose rows have no name-search semantics hide the search box; the bar keeps its label. */
  search?: boolean;
  children?: React.ReactNode;
}) {
  const active = activeFilterCount(state);
  return <div className={styles.bar} role="search" aria-label={searchLabel}>
    {search && <label className={styles.search}>
      <span className="visually-hidden">{searchLabel}</span>
      <svg aria-hidden="true" viewBox="0 0 16 16" className={styles.searchIcon}><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></svg>
      <input type="search" value={state.q} placeholder={searchPlaceholder ?? 'Search'} onChange={e => onChange({ ...state, q: e.target.value })} />
    </label>}
    <div className={styles.chips}>
      {facets.map(facet => <FacetChip key={facet.key} facet={facet} selected={state.filters[facet.key] ?? []}
        onToggle={value => onChange(facet.single ? setFacet(state, facet.key, (state.filters[facet.key] ?? []).includes(value) ? [] : [value]) : toggleFacetValue(state, facet.key, value))}
        onClear={() => onChange(setFacet(state, facet.key, []))} />)}
      {active > 0 && <button type="button" className={styles.clear} onClick={() => onChange(clearListState(state))}>Clear</button>}
    </div>
    <p className={styles.result} role="status" aria-live="polite">{result}</p>
    {children}
  </div>;
}

function FacetChip({ facet, selected, onToggle, onClear }: { facet: FilterFacet; selected: string[]; onToggle: (value: string) => void; onClear: () => void }) {
  const labelOf = (value: string) => facet.options.find(o => o.value === value)?.label ?? value;
  const summary = selected.length === 0 ? null : selected.length === 1 ? labelOf(selected[0]!) : `${selected.length} selected`;
  // Options that would show nothing given the other filters sink to the end; selected ones never hide.
  const live = (value: string) => (facet.counts?.get(value) ?? 1) > 0 || selected.includes(value);
  const options = [...facet.options].sort((a, b) => Number(live(b.value)) - Number(live(a.value)));
  return <div className={styles.chipWrap}>
    <Menu label={`${facet.label} filter`} triggerClassName={styles.chip} triggerAttributes={{ 'data-active': selected.length ? '' : undefined }} width={240}
      trigger={<><span className={styles.chipLabel}>{facet.label}</span>{summary && <span className={styles.chipValue}>{summary}</span>}<svg aria-hidden="true" viewBox="0 0 12 12" className={styles.caret}><path d="m3 4.5 3 3 3-3" /></svg></>}>
      {options.map(o => <MenuButton key={o.value} checked={selected.includes(o.value)} keepOpen={!facet.single} onSelect={() => onToggle(o.value)}
        trailing={facet.counts ? <span className={styles.optionCount}>{facet.counts.get(o.value) ?? 0}</span> : undefined}>{o.label}</MenuButton>)}
    </Menu>
    {selected.length > 0 && <button type="button" className={styles.chipClear} onClick={onClear} aria-label={`Clear ${facet.label} filter`}>×</button>}
  </div>;
}

/**
 * A date filter in the same chip grammar as the facets. The chip always reads
 * the date in the product's own format ("26 Sept 2026"); the browser's picker
 * only collects the value, so its locale never leaks into the page.
 */
export function DateChip({ label, value, display, active, onChange, onReset, resetLabel }: {
  label: string;
  /** YYYY-MM-DD */
  value: string;
  /** The value as the product writes dates, e.g. "26 Sept 2026". */
  display: string;
  /** True when the user chose a date (shows the clear affordance). */
  active: boolean;
  onChange: (value: string) => void;
  onReset: () => void;
  resetLabel: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const open = () => {
    const el = input.current; if (!el) return;
    try { el.showPicker(); } catch { el.focus(); }
  };
  return <div className={styles.chipWrap}>
    <button type="button" className={styles.chip} data-date="" data-active={active ? '' : undefined} onClick={open} aria-label={`${label}: ${display}. Choose a date`}>
      <span className={styles.chipLabel}>{label}</span><span className={styles.chipValue}>{display}</span>
      <svg aria-hidden="true" viewBox="0 0 12 12" className={styles.caret}><path d="m3 4.5 3 3 3-3" /></svg>
    </button>
    <input ref={input} type="date" className={styles.dateInput} tabIndex={-1} aria-hidden="true" value={value} onChange={e => onChange(e.target.value)} />
    {active && <button type="button" className={styles.chipClear} onClick={onReset} aria-label={resetLabel}>×</button>}
  </div>;
}
