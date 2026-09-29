import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

/**
 * Top of a list page (Initiatives, Weekly Review, Notifications): one title,
 * at most one line of context, actions on the right. Explanations belong in
 * Help or in empty states, not here.
 */
export function PageHeader({ title, meta, actions, titleId }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode; titleId?: string }) {
  return <header className={styles.header}>
    <div className={styles.text}>
      <h1 id={titleId}>{title}</h1>
      {meta ? <p className={styles.meta}>{meta}</p> : null}
    </div>
    {actions ? <div className={styles.actions}>{actions}</div> : null}
  </header>;
}
