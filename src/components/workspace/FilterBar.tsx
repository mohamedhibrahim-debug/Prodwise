'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
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
export function FilterBar({ state, onChange, facets, result, searchLabel, searchPlaceholder, children }: {
  state: ListFilterState;
  onChange: (next: ListFilterState) => void;
  facets: FilterFacet[];
  /** e.g. "12 of 14 initiatives" */
  result: string;
  searchLabel: string;
  searchPlaceholder?: string;
  children?: React.ReactNode;
}) {
  const active = activeFilterCount(state);
  return <div className={styles.bar} role="search" aria-label={searchLabel}>
    <label className={styles.search}>
      <span className="visually-hidden">{searchLabel}</span>
      <svg aria-hidden="true" viewBox="0 0 16 16" className={styles.searchIcon}><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></svg>
      <input type="search" value={state.q} placeholder={searchPlaceholder ?? 'Search'} onChange={e => onChange({ ...state, q: e.target.value })} />
    </label>
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
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>('[role=menuitemcheckbox]')?.focus());
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const onKey = (event: KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role=menuitemcheckbox]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); items[(at + 1) % items.length]?.focus(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); items[(at - 1 + items.length) % items.length]?.focus(); }
    else if (event.key === 'Home') { event.preventDefault(); items[0]?.focus(); }
    else if (event.key === 'End') { event.preventDefault(); items.at(-1)?.focus(); }
    else if (event.key === 'Tab') setOpen(false);
  };
  const labelOf = (value: string) => facet.options.find(o => o.value === value)?.label ?? value;
  const summary = selected.length === 0 ? null : selected.length === 1 ? labelOf(selected[0]!) : `${selected.length} selected`;
  const options = [...facet.options].sort((a, b) => Number((facet.counts?.get(b.value) ?? 1) > 0 || selected.includes(b.value)) - Number((facet.counts?.get(a.value) ?? 1) > 0 || selected.includes(a.value)));
  return <div className={styles.chipWrap} ref={root} onKeyDown={open ? onKey : undefined}>
    <button ref={trigger} type="button" className={styles.chip} data-active={selected.length > 0 || undefined}
      aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
      <span className={styles.chipLabel}>{facet.label}</span>{summary && <span className={styles.chipValue}>{summary}</span>}
      <svg aria-hidden="true" viewBox="0 0 12 12" className={styles.caret}><path d="m3 4.5 3 3 3-3" /></svg>
    </button>
    {selected.length > 0 && <button type="button" className={styles.chipClear} onClick={onClear} aria-label={`Clear ${facet.label} filter`}>×</button>}
    {open && <div ref={menu} id={id} role="menu" aria-label={facet.label} className={styles.menu}>
      {options.map(o => {
        const checked = selected.includes(o.value); const count = facet.counts?.get(o.value) ?? 0;
        return <button key={o.value} type="button" role="menuitemcheckbox" aria-checked={checked} tabIndex={-1}
          className={styles.option} data-empty={facet.counts && !count && !checked || undefined}
          onClick={() => { onToggle(o.value); if (facet.single) close(); }}>
          <span className={styles.check} aria-hidden="true">{checked ? '✓' : ''}</span>
          <span className={styles.optionLabel}>{o.label}</span>
          {facet.counts && <span className={styles.optionCount}>{count}</span>}
        </button>;
      })}
    </div>}
  </div>;
}
