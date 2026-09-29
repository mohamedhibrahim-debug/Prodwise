'use client';
import Link from 'next/link';
import { useMemo } from 'react';

/** The same glyph and tone for a reason as Home and the Brief: a decision is ?, not a warning triangle. */
const REASON: Record<string, { glyph: string; tone: string }> = { decision: { glyph: '?', tone: 'decision' }, blocker: { glyph: '■', tone: 'blocker' }, 'past-target': { glyph: '▲', tone: 'past' }, 'past-milestone': { glyph: '▲', tone: 'past' }, dependency: { glyph: '⇢', tone: 'dependency' }, 'support-changed': { glyph: '↻', tone: 'support' } };
const reason = (kind: string) => REASON[kind] ?? { glyph: '▲', tone: 'past' };
import { BusinessLine } from '@/components/primitives/BusinessLine';
import { FilterBar, type FilterFacet } from '@/components/workspace/FilterBar';
import { useListState } from '@/components/workspace/useListState';
import { facetCounts, type ListFilterState } from '@/lib/workspace/list-filter';
import { filterRegister, registerAccessors, registerSearchText, REGISTER_FACETS, type RegisterRow } from '@/lib/workspace/register-view';
import { formatDate } from '@/lib/domain/labels';
import table from '@/components/workspace/DataTable.module.css';
import styles from './RegisterView.module.css';

export interface RegisterOptions {
  stage: { value: string; label: string }[];
  owner: { value: string; label: string }[];
  line: { value: string; label: string }[];
}

const ATTENTION_OPTIONS = [
  { value: 'any', label: 'Any reason' }, { value: 'decision', label: 'Decision needed' }, { value: 'blocker', label: 'Recorded blocker' },
  { value: 'past-target', label: 'Past target' }, { value: 'past-milestone', label: 'Past milestone' },
  { value: 'dependency', label: 'Dependency date impact' }, { value: 'support-changed', label: 'Supporting evidence changed' },
];
const TARGET_OPTIONS = [
  { value: 'upcoming', label: 'Next 28 days' }, { value: 'past', label: 'Past target · update needed' },
  { value: 'unknown', label: 'No Target Live' }, { value: 'moved', label: 'Moved in last 28 days' },
];
const SETUP_OPTIONS = [{ value: 'incomplete', label: 'Setup incomplete' }, { value: 'ready', label: 'Setup complete' }];
const RECORD_OPTIONS = [{ value: 'archived', label: 'Archived only' }, { value: 'all', label: 'Active and archived' }];

export function RegisterView({ rows, initial, options, stageLabel }: {
  rows: RegisterRow[]; initial: ListFilterState; options: RegisterOptions; stageLabel: Record<string, string>;
}) {
  const [state, setState] = useListState(initial, REGISTER_FACETS);
  const visible = useMemo(() => filterRegister(rows, state), [rows, state]);
  const activeTotal = rows.filter(r => !r.archived).length, archived = rows.length - activeTotal;
  const counts = (facet: string) => facetCounts(rows.filter(r => state.filters.record?.length || facet === 'record' ? true : !r.archived), state, registerAccessors, registerSearchText, facet);
  const facets: FilterFacet[] = [
    { key: 'stage', label: 'Stage', options: options.stage, counts: counts('stage') },
    { key: 'owner', label: 'Owner', options: options.owner, counts: counts('owner') },
    { key: 'attention', label: 'Attention', options: ATTENTION_OPTIONS, counts: counts('attention') },
    { key: 'target', label: 'Target', options: TARGET_OPTIONS, counts: counts('target') },
    { key: 'setup', label: 'Setup', options: SETUP_OPTIONS, counts: counts('setup'), single: true },
    ...(options.line.length > 1 ? [{ key: 'line', label: 'Business line', options: options.line, counts: counts('line') }] : []),
    ...(archived ? [{ key: 'record', label: 'Archived', options: RECORD_OPTIONS, single: true }] : []),
  ];
  const scopeTotal = state.filters.record?.includes('archived') ? archived : state.filters.record?.includes('all') ? rows.length : activeTotal;
  const sort = state.sort ?? 'name';
  const sortHeader = (key: string, label: string) => <th scope="col" aria-sort={sort === key ? (key === 'updated' || key === 'attention' ? 'descending' : 'ascending') : 'none'}>
    <button type="button" className={table.sortButton} data-active={sort === key || undefined} onClick={() => setState({ ...state, sort: key === 'name' ? null : key })}>
      {label}<span aria-hidden="true">{sort === key ? (key === 'updated' || key === 'attention' ? '↓' : '↑') : ''}</span>
    </button></th>;
  const result = `${visible.length} of ${scopeTotal} ${scopeTotal === 1 ? 'initiative' : 'initiatives'}${archived && !state.filters.record?.length ? ` · ${archived} archived hidden` : ''}`;
  return <>
    <FilterBar state={state} onChange={setState} facets={facets} result={result} searchLabel="Filter initiatives" searchPlaceholder="Search name or reference" />
    {visible.length ? <>
      <div className={`${table.wrap} ${styles.desktop}`}>
        <table className={table.table}>
          <caption className="visually-hidden">Initiatives with stage, owner, attention, Target Live, setup and latest change</caption>
          <colgroup><col className={styles.cName} /><col className={styles.cStage} /><col className={styles.cOwner} /><col className={styles.cAttention} /><col className={styles.cTarget} /><col className={styles.cSetup} /><col className={styles.cUpdated} /></colgroup>
          <thead><tr>{sortHeader('name', 'Initiative')}<th scope="col">Stage</th><th scope="col">Owner</th>{sortHeader('attention', 'Attention')}{sortHeader('target', 'Target Live')}<th scope="col">Setup</th>{sortHeader('updated', 'Updated')}</tr></thead>
          <tbody>{visible.map(r => <tr key={r.id} data-archived={r.archived || undefined}>
            <th scope="row"><Link href={`/initiatives/${r.slug}`} className={`${table.name} ${table.rowLink}`}>{r.name}</Link>
              <span className={table.meta}><BusinessLine code={r.businessLine as never} />{r.reference ? ` · ${r.reference}` : ''}{r.archived ? ' · Archived' : ''}{r.isDemo ? ' · Synthetic' : ''}</span></th>
            <td><span className={styles.stage}>{stageLabel[r.stage] ?? r.stage}</span></td>
            <td className={r.ownerId ? undefined : table.muted}>{r.ownerLabel}</td>
            <td>{r.attention.length ? <span className={styles.attention} title={r.attention.map(a => a.label).join(' · ')}>
              <span aria-hidden="true" className={styles.glyph}>{reason(r.attention[0]!.kind).glyph}</span>{r.attention[0]!.label}{r.attention.length > 1 && <span className={styles.more}>+{r.attention.length - 1}<span className="visually-hidden"> more: {r.attention.slice(1).map(a => a.label).join(', ')}</span></span>}
            </span> : <><span aria-hidden="true" className={table.dash}>—</span><span className="visually-hidden">No attention reasons recorded</span></>}</td>
            <td className={table.num}><span className={r.target.date ? undefined : table.muted}>{r.target.text}</span>{r.target.moved && <span className={styles.moved}>Moved {r.target.moved}</span>}</td>
            <td><Setup row={r} /></td>
            <td>{r.latest ? <span title={r.latest.sentence}><span className={table.num}>{formatDate(r.latest.at)}</span><span className={`${table.meta} ${table.ellipsis}`}>{r.latest.sentence}</span></span> : <span className={table.muted}>No recent change</span>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <ul className={styles.mobile}>{visible.map(r => <li key={r.id}>
        <Link href={`/initiatives/${r.slug}`} className={styles.mobileLink}>
          <span className={styles.mobileName}>{r.name}</span>
          <span className={styles.mobileMeta}><span className={styles.stage}>{stageLabel[r.stage] ?? r.stage}</span><span>{r.ownerLabel}</span><span className={table.num}>{r.target.date ? r.target.text : `Target ${r.target.text.toLowerCase()}`}</span></span>
          {r.attention.length > 0 && <span className={styles.attention} data-tone={reason(r.attention[0]!.kind).tone}><span aria-hidden="true" className={styles.glyph}>{reason(r.attention[0]!.kind).glyph}</span>{r.attention[0]!.label}{r.attention.length > 1 ? ` +${r.attention.length - 1}` : ''}</span>}
        </Link></li>)}</ul>
    </> : <div className={`${table.wrap} ${table.empty}`}><strong>{rows.length ? 'No initiatives match these filters.' : 'No initiatives recorded yet.'}</strong>{rows.length ? <button type="button" className={styles.linkButton} onClick={() => setState({ q: '', filters: {}, sort: state.sort })}>Clear filters</button> : null}</div>}
  </>;
}

function Setup({ row: r }: { row: RegisterRow }) {
  return <span className={styles.setup} title={`${r.setup.label}: ${r.setup.completed} of ${r.setup.total} recorded`}>
    <span className={styles.meter} aria-hidden="true"><span style={{ inlineSize: `${(r.setup.completed / Math.max(1, r.setup.total)) * 100}%` }} data-ready={r.setup.ready || undefined} /></span>
    <span className={table.num}>{r.setup.completed}/{r.setup.total}</span>
    <span className="visually-hidden">{r.setup.label}</span>
  </span>;
}
