import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './StatStrip.module.css';

/**
 * Which kind of thing a count describes. The tone colours the value and the
 * tile's top rule; the label always says what it is, so the tone is
 * reinforcement, never the only carrier (CLAUDE.md §16).
 */
export type StatTone = 'neutral' | 'attention' | 'decision' | 'schedule' | 'ready' | 'unknown' | 'risk' | 'dependency';

export interface StatItem {
  key: string;
  /** The factual count or value. Never a percentage of readiness. */
  value: ReactNode;
  label: string;
  /** One short line under the label: what the count means, or its scope. */
  hint?: string;
  href?: string;
  tone?: StatTone;
}

/**
 * The one stat-strip grammar for every summary band (Home, Portfolio Analysis,
 * Initiative Brief, Weekly Review): white tiles in one row, a tone rule on top
 * of each, tabular values. Linked tiles open the filtered list they count.
 */
export function StatStrip({ items, label, dense = false }: { items: StatItem[]; label: string; dense?: boolean }) {
  return <ul className={styles.strip} aria-label={label} data-dense={dense || undefined}>
    {items.map(item => {
      const body = <>
        <strong className={styles.value}>{item.value}</strong>
        <span className={styles.label}>{item.label}</span>
        {item.hint && <span className={styles.hint}>{item.hint}</span>}
      </>;
      return <li key={item.key} data-tone={item.tone ?? 'neutral'}>
        {item.href ? <Link prefetch={false} href={item.href} className={styles.tile}>{body}</Link> : <div className={styles.tile}>{body}</div>}
      </li>;
    })}
  </ul>;
}
