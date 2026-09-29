import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './TabToolbar.module.css';

/**
 * The only thing a tab puts above its content. The persistent initiative
 * header already names the initiative and the tab strip names the tab, so a
 * tab never re-titles itself: the heading is for assistive technology only,
 * and the visible line carries a factual summary, the tab's view controls and
 * its primary action.
 */
export function TabToolbar({ title, summary, controls, actions }: { title: string; summary?: ReactNode; controls?: ReactNode; actions?: ReactNode }) {
  return <div className={styles.toolbar}>
    <h2 className="visually-hidden">{title}</h2>
    {summary ? <p className={styles.summary}>{summary}</p> : null}
    {controls ? <div className={styles.controls}>{controls}</div> : null}
    {actions ? <div className={styles.actions}>{actions}</div> : null}
  </div>;
}

export interface SegmentItem { key: string; label: string; count?: number; href?: string; current?: boolean; onSelect?: () => void }

/** A segmented view switch. Links when the view lives in the URL, buttons when it is client state. */
export function Segmented({ label, items }: { label: string; items: SegmentItem[] }) {
  return <nav className={styles.segmented} aria-label={label}>
    {items.map(item => {
      const body = <>{item.label}{item.count !== undefined ? <span className={styles.segmentCount}>{item.count}</span> : null}</>;
      return item.href
        ? <Link key={item.key} prefetch={false} href={item.href} className={styles.segment} aria-current={item.current ? 'page' : undefined}>{body}</Link>
        : <button key={item.key} type="button" className={styles.segment} aria-pressed={Boolean(item.current)} onClick={item.onSelect}>{body}</button>;
    })}
  </nav>;
}

/** A compact status chip in the toolbar, e.g. "1 value differs →". */
export function ToolbarChip({ href, tone = 'neutral', children }: { href?: string; tone?: 'attention' | 'neutral'; children: ReactNode }) {
  return href
    ? <Link prefetch={false} href={href} className={styles.chip} data-tone={tone}>{children}</Link>
    : <span className={styles.chip} data-tone={tone}>{children}</span>;
}
