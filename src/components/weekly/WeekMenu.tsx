'use client';
import { Menu, MenuLabel, MenuLink } from '@/components/primitives/Popover';
import Link from 'next/link';
import { weekLabel } from '@/lib/domain/labels';
import styles from './weekly.module.css';

/**
 * One way to move between weeks: ‹ › steps, and the week itself opens a list
 * of recorded reviews. Replaces the native week input and the separate link row.
 */
export function WeekMenu({ week, range, prev, next, history, year }: {
  week: string;
  /** e.g. "21–27 Sept 2026" */
  range: string;
  prev: string; next: string;
  history: { week: string; status: 'DRAFT' | 'FINAL' }[];
  year: string;
}) {
  return <div className={styles.week} role="group" aria-label="Review week">
    <Link prefetch={false} className="pw-btn" data-variant="ghost" data-size="sm" href={`/weekly-review?week=${prev}`} aria-label={`Previous week, ${weekLabel(prev, year)}`}>‹</Link>
    <Menu label="Recorded reviews" triggerClassName={`pw-btn ${styles.weekTrigger}`} triggerAttributes={{ 'data-variant': 'secondary', 'data-size': 'sm' }} width={240}
      trigger={<><strong>{weekLabel(week, year)}</strong><span className={styles.weekRange}>{range}</span><svg aria-hidden="true" viewBox="0 0 12 12" className={styles.weekCaret}><path d="m3 4.5 3 3 3-3" /></svg></>}>
      <MenuLabel>Recorded reviews</MenuLabel>
      {history.length ? history.map(r => <MenuLink key={r.week} href={`/weekly-review?week=${r.week}`} trailing={r.status === 'FINAL' ? 'Final' : 'Draft'}>{r.week === week ? `${weekLabel(r.week, year)} · open now` : weekLabel(r.week, year)}</MenuLink>)
        : <MenuLabel>No reviews recorded yet.</MenuLabel>}
    </Menu>
    <Link prefetch={false} className="pw-btn" data-variant="ghost" data-size="sm" href={`/weekly-review?week=${next}`} aria-label={`Next week, ${weekLabel(next, year)}`}>›</Link>
  </div>;
}
