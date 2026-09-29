import Link from 'next/link';
import { STAGES, type Stage } from '@/lib/domain/types';
import { STAGE_LABEL } from '@/lib/domain/labels';
import { stagePosition, type StageCount } from '@/lib/workspace/lifecycle-strip';
import styles from './LifecycleStrip.module.css';

/**
 * Lifecycle distribution: one ordinal bar (light → dark along the lifecycle)
 * with a counted legend. The same grammar Portfolio Analysis draws inline;
 * this is the shared component. Recorded stage only — position in the
 * lifecycle establishes neither readiness nor business success.
 */
export function LifecycleStrip({ counts, label, hrefFor, legend = 'full' }: {
  counts: StageCount[];
  label: string;
  /** Link for a legend entry, e.g. the register filtered by stage. */
  hrefFor?: (stage: Stage) => string;
  /** `full` lists all eight stages; `present` only the stages that have initiatives. */
  legend?: 'full' | 'present';
}) {
  const total = counts.reduce((n, s) => n + s.count, 0);
  const present = counts.filter(s => s.count > 0);
  return <div className={styles.strip}>
    <div className={styles.bar} role="img" aria-label={present.length ? `${label}: ${present.map(s => `${STAGE_LABEL[s.stage]} ${s.count}`).join(', ')}` : `${label}: no active initiatives`}>
      {present.map(s => <span key={s.stage} data-stage={s.stage} style={{ flexGrow: s.count }} title={`${STAGE_LABEL[s.stage]}: ${s.count}`} />)}
      {!total && <span className={styles.emptyBar} />}
    </div>
    <ol className={styles.legend} aria-label={`${label} by stage`}>
      {(legend === 'full' ? counts : present).map(s => {
        const body = <><i data-stage={s.stage} aria-hidden="true" /><span>{STAGE_LABEL[s.stage]}</span><b>{s.count}</b></>;
        return <li key={s.stage} data-empty={s.count === 0 || undefined}>{hrefFor && s.count ? <Link prefetch={false} href={hrefFor(s.stage)}>{body}</Link> : <span className={styles.plain}>{body}</span>}</li>;
      })}
    </ol>
  </div>;
}

/**
 * Where one initiative sits: eight equal steps, earlier stages quiet, the
 * recorded stage highlighted and named. An information-bearing strip, not a
 * hero, and never a claim that the earlier stages were "completed" — an
 * initiative may move backward or reopen (CLAUDE.md §7).
 */
export function LifecycleStepper({ stage, label = 'Lifecycle stage' }: { stage: Stage; label?: string }) {
  const { index } = stagePosition(stage);
  return <ol className={styles.stepper} aria-label={`${label}: ${STAGE_LABEL[stage]}`}>
    {STAGES.map((s, i) => <li key={s} data-stage={s} data-state={i < index ? 'earlier' : i === index ? 'current' : 'later'} aria-current={i === index ? 'step' : undefined} title={STAGE_LABEL[s]}>
      <span className={styles.step} aria-hidden="true" />
      <span className={i === index ? styles.stepLabel : 'visually-hidden'}>{STAGE_LABEL[s]}</span>
    </li>)}
  </ol>;
}
