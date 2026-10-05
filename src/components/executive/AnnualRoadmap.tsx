'use client';
import { useState } from 'react';
import Link from 'next/link';
import { InstrumentIcon } from '@/components/shell/InstrumentIcon';
import { bounds, planDateLabel, planVariance, type TimelineItem } from '@/lib/executive/roadmap-view';
import type { PlanEvent, RoadmapPlan } from '@/lib/executive/types';
import { PlanEditor } from './PlanEditor';
import styles from './Executive.module.css';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function AnnualRoadmap({ items, workspaceId, canWrite, today, events }: { items: TimelineItem[]; workspaceId: string; canWrite: boolean; today: string; events: PlanEvent[] }) {
  const [year, setYear] = useState(2027), [squad, setSquad] = useState(''), [query, setQuery] = useState(''), [zoom, setZoom] = useState('month');
  const [selectedId, setSelectedId] = useState<string | null>(null), [editor, setEditor] = useState<RoadmapPlan | null | undefined>(undefined);
  const selected = items.find(i => i.id === selectedId);
  const squads = [...new Set(items.map(i => i.squad || 'Unassigned'))].sort();
  const startYear = `${year}-01-01`, endYear = `${year}-12-31`;
  const position = (date: string) => Math.max(0, Math.min(100, (Date.parse(date) - Date.parse(startYear)) / (Date.parse(`${year + 1}-01-01`) - Date.parse(startYear)) * 100));
  const matches = items.filter(i => (!squad || (i.squad || 'Unassigned') === squad) && (i.name + ' ' + i.owner + ' ' + i.workstream).toLowerCase().includes(query.toLowerCase()));
  const scheduled = matches.filter(i => i.target && bounds(i.target)[1] >= startYear && (i.start ? bounds(i.start)[0] <= endYear : bounds(i.target)[0] <= endYear));
  const undated = matches.filter(i => !i.target);
  const groups = [...new Set(scheduled.map(i => i.squad || 'Unassigned'))].sort().map(name => ({ name, items: scheduled.filter(i => (i.squad || 'Unassigned') === name).sort((a, b) => a.workstream.localeCompare(b.workstream) || (a.start?.value ?? a.target?.value ?? '').localeCompare(b.start?.value ?? b.target?.value ?? '')) }));
  const years = [...new Set([2026, 2027, 2028, ...items.flatMap(i => [i.start?.value, i.target?.value, i.actual].filter(Boolean).map(d => Number(d!.slice(0, 4))))])].sort();
  return <>
    <div className={styles.toolbar}>
      <label>Planning year<select aria-label="Planning year" value={year} onChange={e => setYear(Number(e.target.value))}>{years.map(y => <option key={y}>{y}</option>)}</select></label>
      <label>Squad<select aria-label="Squad" value={squad} onChange={e => setSquad(e.target.value)}><option value="">All squads</option>{squads.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Search<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Initiative or owner" /></label>
      <div className={styles.spacer} />
      <div role="group" aria-label="Timeline scale"><button type="button" aria-pressed={zoom === 'month'} onClick={() => setZoom('month')}>Month</button><button type="button" aria-pressed={zoom === 'quarter'} onClick={() => setZoom('quarter')}>Quarter</button></div>
      {canWrite && <button className={styles.button} data-primary="true" onClick={() => setEditor(null)}><InstrumentIcon name="plus" />Add plan</button>}
    </div>
    <div className={styles.stats}>
      {[[scheduled.length, 'In the year plan'], [scheduled.filter(i => i.actual).length, 'With a recorded launch'], [scheduled.filter(i => planVariance(i).tone === 'attention').length, 'With recorded delay'], [undated.length, 'Awaiting target dates']].map(([value, label]) => <div className={styles.stat} key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </div>
    <section aria-label={`${year} roadmap`}>
      <div className={styles.sectionHead}><h2>{year} delivery plan</h2><span className={styles.meta}>Solution start to Target Live</span></div>
      {!scheduled.length ? <div className={styles.empty}><h2>No dated plans for {year}</h2><p>{matches.length ? 'Existing records may belong to another year or need a target date.' : 'No plans match this view.'}</p>{canWrite && <button className={styles.button} onClick={() => setEditor(null)}>Add planning initiative</button>}</div> :
        <div className={styles.scroll} tabIndex={0} aria-label="Scrollable annual timeline"><div className={styles.board}>
          <div className={styles.header}><span>Initiative / workstream</span><span>Accountable owner</span><div><div className={styles.quarters}>{[1,2,3,4].map(q => <span key={q}>Q{q} {year}</span>)}</div>{zoom === 'month' && <div className={styles.axis}>{months.map(m => <span key={m}>{m}</span>)}</div>}</div></div>
          {groups.map(group => <section key={group.name} aria-label={group.name}><h3 className={styles.groupTitle}>{group.name}<span>{group.items.length} initiatives</span></h3>{group.items.map(item => {
            const targetEnd = bounds(item.target!)[1], begin = item.start ? bounds(item.start)[0] : null;
            const x = position(begin ?? bounds(item.target!)[0]), end = position(targetEnd);
            const status = planVariance(item);
            return <div className={styles.row} key={item.id} data-selected={selectedId === item.id}>
              <button className={styles.name} onClick={() => setSelectedId(item.id)} aria-pressed={selectedId === item.id}>{item.name}<small>{item.workstream || 'Workstream unassigned'}{item.carryover ? ' / Carryover' : ''}</small><span className={styles.badge} data-tone={status.tone}>{!item.actual && item.target && targetEnd < today && item.status === 'COMMITTED' ? 'Past target / update needed' : status.label}</span></button>
              <div className={styles.owner}>{item.owner || 'Unassigned'}</div>
              <div className={styles.track}><div className={styles.gridlines} aria-hidden="true">{months.map(m => <i key={m} />)}</div>
                {today >= startYear && today <= endYear && <span className={styles.today} style={{ left: `${position(today)}%` }} />}
                {begin && <button className={styles.bar} data-proposed={item.status === 'PROPOSED'} data-held={item.status === 'ON_HOLD'} style={{ left: `${x}%`, width: `${Math.max(.5,end-x)}%` }} onClick={() => setSelectedId(item.id)} aria-label={`${item.name}: Solution ${planDateLabel(item.start)} to target ${planDateLabel(item.target)}`} title={`${planDateLabel(item.start)} to ${planDateLabel(item.target)}`}>{item.name}</button>}
                {!begin && <button className={styles.targetLabel} style={{ left: `${Math.min(position(bounds(item.target!)[0]), 82)}%`, width:'18%' }} onClick={() => setSelectedId(item.id)} title="Solution start not recorded">Target {planDateLabel(item.target)}<br/>Start not recorded</button>}
                {item.originalTarget && item.originalTarget.value !== item.target?.value && bounds(item.originalTarget)[1] >= startYear && bounds(item.originalTarget)[1] <= endYear && <span className={styles.mark} data-original="true" title={`Original target: ${planDateLabel(item.originalTarget)}`} style={{left:`${position(bounds(item.originalTarget)[1])}%`}} />}
                {targetEnd >= startYear && targetEnd <= endYear && <span className={styles.mark} title={`Target: ${planDateLabel(item.target)}`} style={{left:`${Math.min(99.7,position(targetEnd))}%`}} />}
                {item.actual && item.actual >= startYear && item.actual <= endYear && <span className={styles.mark} data-actual="true" style={{left:`${position(item.actual)}%`}} title={`Actual: ${item.actual}`} />}
                {item.forecast && item.forecast >= startYear && item.forecast <= endYear && <span className={styles.mark} data-forecast="true" style={{left:`${position(item.forecast)}%`}} title={`Forecast: ${item.forecast}`} />}
              </div>
            </div>;
          })}</section>)}
        </div></div>}
      <div className={styles.legend}><span><i />Target Live</span><span><i data-original="true" />Original commitment</span><span><i data-actual="true" />Actual Live</span><span><i data-forecast="true" />Forecast Live</span><span>Dashed bar: proposed</span></div>
    </section>
    {selected && <section className={styles.detail} aria-label="Selected initiative details">
      <div className={styles.sectionHead}><h2>{selected.name}</h2><div className={styles.toolbar}>{selected.deliveryHref && <Link href={selected.deliveryHref}>Open delivery record</Link>}{canWrite && <button className={styles.button} onClick={() => setEditor(selected)}>Edit plan</button>}<button className={styles.button} onClick={() => setSelectedId(null)} title="Close details" aria-label="Close details"><InstrumentIcon name="close" /></button></div></div>
      <p>{selected.outcome || 'Outcome not recorded.'}</p>
      <dl className={styles.facts}>{[
        ['Solution start', planDateLabel(selected.start)], ['Original commitment', planDateLabel(selected.originalTarget)], ['Target Live', planDateLabel(selected.target)], ['Actual Live', selected.actual ? `${selected.actual}${selected.actualPartial ? ' (partial)' : ''}` : 'Not recorded'],
        ['Forecast Live', selected.forecast || 'Not recorded'], ['Accountable owner', selected.owner || 'Unassigned'], ['Delay reason', selected.delayReason || 'Not recorded'], ['Next action', selected.nextAction || 'Not recorded'], ['Action owner', selected.nextActionOwner || 'Unassigned'], ['Source', selected.source],
      ].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
      {selected.originalTarget?.precision === 'DAY' && selected.actual && <p className={styles.meta}>Actual vs original commitment: {Math.round((Date.parse(selected.actual)-Date.parse(selected.originalTarget.value))/86400000)} days.</p>}
      {events.some(e => e.planId === selected.id) && <details><summary>Plan history</summary><ul>{events.filter(e => e.planId === selected.id).slice().reverse().map(e => <li key={e.id}>{e.at.slice(0,10)} / {e.actor}: {planDateLabel(e.before?.target ?? null)} to {planDateLabel(e.after.target)} / {e.after.status.toLowerCase().replace('_',' ')}</li>)}</ul></details>}
    </section>}
    {!!undated.length && <section><div className={styles.sectionHead}><h2>Awaiting target dates</h2><span className={styles.meta}>Across the portfolio</span></div><div className={styles.scroll}><table className={styles.table}><thead><tr><th>Initiative</th><th>Squad</th><th>Owner</th><th>Commitment</th></tr></thead><tbody>{undated.map(item => <tr key={item.id}><td><button onClick={() => setSelectedId(item.id)}>{item.name}</button></td><td>{item.squad || 'Unassigned'}</td><td>{item.owner || 'Unassigned'}</td><td>{item.status.toLowerCase().replace('_',' ')}</td></tr>)}</tbody></table></div></section>}
    {editor !== undefined && <PlanEditor plan={editor} workspaceId={workspaceId} close={() => setEditor(undefined)} />}
  </>;
}
