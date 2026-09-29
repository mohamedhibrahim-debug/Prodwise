import Link from 'next/link';
import { Fragment } from 'react';
import { displayDate } from '@/lib/delivery/display';
import { deliveryRowLayout } from '@/lib/workspace/delivery-row';
import type { RoadmapItem } from '@/lib/workspace/roadmap-layout';
import styles from './DeliveryRow.module.css';

const pct = (n: number) => `${n}%`;
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} d`;
const short = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

/**
 * One compact timeline row for the Brief, drawn with the Roadmap's pure
 * layout and mark vocabulary: planned bar (dev start → Target Live),
 * delivered bar (dev start → Actual Live), target ◆, live ●, milestone,
 * a ghost for a moved target, the cutoff line. Every mark is a recorded
 * date; with no Target Live the row says so and offers the setup link.
 */
export function DeliveryRow({ item, cutoff, cutoffLabel, setupHref, roadmapHref, canRecord }: {
  item: RoadmapItem; cutoff: string; cutoffLabel: string; setupHref: string; roadmapHref: string; canRecord: boolean;
}) {
  const layout = deliveryRowLayout(item, cutoff);
  if (!layout) {
    return <div className={styles.none}>
      <p><strong>No delivery dates recorded.</strong> {item.milestone?.date || item.devStart ? 'A Target Live places this initiative on the timeline; other dates are drawn beside it.' : 'Target Live, development start and the next milestone are drawn here once recorded.'}</p>
      {canRecord ? <Link prefetch={false} className="pw-btn" data-variant="secondary" data-size="sm" href={setupHref}>Record Target Live</Link> : <span className={styles.quiet}>Recorded by the initiative owner or an administrator.</span>}
    </div>;
  }
  const { months, marks: m, today } = layout;
  const facts = [
    item.devStart ? { key: 'dev', mark: <i className={`${styles.key} ${styles.keyPlanned}`} aria-hidden="true" />, label: 'Development start', value: displayDate(item.devStart) } : null,
    { key: 'target', mark: <i className={`${styles.key} ${styles.keyTarget}`} data-past={m.target!.past || undefined} aria-hidden="true" />, label: 'Target Live', value: `${displayDate(item.target!)}${m.target!.past ? ' · past · update needed' : ''}${item.movement ? ` · moved ${signed(item.movement.days)} from ${displayDate(item.movement.from)}` : ''}` },
    item.milestone?.date ? { key: 'milestone', mark: <i className={`${styles.key} ${styles.keyMilestone}`} aria-hidden="true" />, label: item.milestone.text, value: displayDate(item.milestone.date) } : null,
    item.actual ? { key: 'live', mark: <i className={`${styles.key} ${styles.keyLive}`} data-partial={item.actualExtent === 'PARTIAL' || undefined} aria-hidden="true" />, label: item.actualExtent === 'PARTIAL' ? 'Partial live' : 'Actual Live', value: displayDate(item.actual) } : { key: 'live', mark: <i className={`${styles.key} ${styles.keyNone}`} aria-hidden="true" />, label: 'Actual Live', value: 'Not recorded' },
  ].filter((f): f is NonNullable<typeof f> => Boolean(f));
  const summary = `Delivery timeline. ${facts.map(f => `${f.label} ${f.value}`).join('. ')}. ${cutoffLabel} ${displayDate(cutoff)}.`;
  return <div className={styles.row}>
    <div className={styles.frame} role="img" aria-label={summary}>
      <div className={styles.axis} aria-hidden="true">
        {months.map((mo, n) => <span key={mo.key} style={{ left: pct(mo.x), width: pct(mo.width) }}>{mo.label}{(n === 0 || mo.key.slice(5, 7) === '01') && <small> {mo.year}</small>}</span>)}
      </div>
      <div className={styles.track} aria-hidden="true">
        {months.map(mo => <span key={mo.key} className={styles.monthLine} style={{ left: pct(mo.x) }} />)}
        {m.planned && <span className={styles.planned} style={{ left: pct(m.planned.x), width: pct(m.planned.width) }} />}
        {m.delivered && <span className={styles.delivered} style={{ left: pct(m.delivered.x), width: pct(m.delivered.width) }} />}
        {m.ghost && <Fragment>
          <span className={styles.ghostLine} style={{ left: pct(Math.min(m.ghost.x, m.ghost.toX)), width: pct(Math.abs(m.ghost.toX - m.ghost.x)) }} />
          <span className={styles.ghost} style={{ left: pct(m.ghost.x) }} />
          <span className={styles.moveLabel} style={{ left: pct((m.ghost.x + m.ghost.toX) / 2) }}>Target {signed(m.ghost.days)}</span>
        </Fragment>}
        {m.milestone && <span className={styles.milestone} style={{ left: pct(m.milestone.x) }} />}
        <span className={styles.today} style={{ left: pct(today) }}><span className={styles.todayFlag}>{cutoffLabel} · {short(cutoff)}</span></span>
        <span className={m.target!.past ? `${styles.target} ${styles.targetPast}` : styles.target} style={{ left: pct(m.target!.x) }} />
        {m.live && <span className={m.live.partial ? `${styles.live} ${styles.partial}` : styles.live} style={{ left: pct(m.live.x) }} />}
        {!item.actual && <span className={styles.label} data-side={m.labelSide} data-past={m.target!.past || undefined} style={{ left: pct(m.target!.x) }}>{m.target!.past ? '▲ ' : ''}{short(item.target!)}</span>}
        {m.live && <span className={`${styles.label} ${styles.liveLabel}`} data-side={m.live.x > 86 ? 'left' : 'right'} style={{ left: pct(m.live.x) }}>{m.live.partial ? 'Partial live' : 'Live'} {short(item.actual!)}</span>}
      </div>
    </div>
    <dl className={styles.facts}>
      {facts.map(f => <div key={f.key}>{f.mark}<dt>{f.label}</dt><dd>{f.value}</dd></div>)}
      <div className={styles.factsLink}><Link prefetch={false} href={roadmapHref}>Roadmap →</Link></div>
    </dl>
  </div>;
}
