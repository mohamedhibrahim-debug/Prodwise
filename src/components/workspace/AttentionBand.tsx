import Link from 'next/link';
import type { AttentionKind } from '@/lib/workspace/portfolio';
import { ATTENTION_KIND, ATTENTION_TONES, type AttentionTone } from './attention-kind';
import styles from './AttentionBand.module.css';

/**
 * "n of N initiatives need attention": a proportion bar whose filled part is
 * split by each initiative's leading reason, with a counted legend. Counts in
 * the legend are initiatives that carry that reason (the same numbers the
 * register filters reproduce), so one initiative may appear under two kinds.
 * Colour + glyph + words on every segment and legend entry.
 */
export function AttentionBand({ rows, total, hrefFor, compact = false, noun = 'initiatives' }: {
  rows: { id: string; attention: { kind: AttentionKind }[] }[];
  total: number;
  /** Link for a legend entry; omitted entries are plain text (the Brief). */
  hrefFor?: (filter: string) => string;
  compact?: boolean;
  /** `reasons` when each row is one recorded reason (the Brief): the bar is split by reason kind and the summary counts reasons. */
  noun?: 'initiatives' | 'reasons';
}) {
  const flagged = rows.filter(r => r.attention.length);
  const leading = new Map<AttentionTone, number>();
  for (const r of flagged) { const t = ATTENTION_KIND[r.attention[0]!.kind].tone; leading.set(t, (leading.get(t) ?? 0) + 1); }
  const withTone = (tone: AttentionTone) => rows.filter(r => r.attention.some(a => ATTENTION_KIND[a.kind].tone === tone)).length;
  const summary = noun === 'reasons' ? `${total} recorded ${total === 1 ? 'reason' : 'reasons'}` : `${flagged.length} of ${total} ${total === 1 ? 'initiative needs' : 'initiatives need'} attention`;
  return <div className={styles.band} data-compact={compact || undefined}>
    <p className={styles.summary}>{noun === 'reasons' ? <><strong>{total}</strong> recorded {total === 1 ? 'reason' : 'reasons'}{total ? ' · by kind' : ''}</> : <><strong>{flagged.length}</strong> of {total} {total === 1 ? 'initiative' : 'initiatives'} {flagged.length === 1 ? 'needs' : 'need'} attention</>}</p>
    <div className={styles.bar} role="img" aria-label={`${summary}, coloured by leading reason`}>
      {ATTENTION_TONES.filter(t => leading.get(t.tone)).map(t => <span key={t.tone} data-tone={t.tone} style={{ flexGrow: leading.get(t.tone) }} title={`${t.label}: leading reason on ${leading.get(t.tone)}`} />)}
      {noun === 'initiatives' && total > flagged.length && <span className={styles.rest} style={{ flexGrow: total - flagged.length }} title={`${total - flagged.length} with no recorded reason under the current checks`} />}
    </div>
    <ul className={styles.legend}>
      {ATTENTION_TONES.map(t => { const n = noun === 'reasons' ? leading.get(t.tone) ?? 0 : withTone(t.tone); if (!n) return null; const body = <><i data-tone={t.tone} aria-hidden="true">{t.glyph}</i><span>{t.label}</span><b>{n}</b></>;
        return <li key={t.tone}>{hrefFor ? <Link prefetch={false} href={hrefFor(t.filter)}>{body}</Link> : body}</li>; })}
      {!flagged.length && <li className={styles.none}>No recorded decision, blocker, past date, late dependency or changed support under the current checks.</li>}
    </ul>
  </div>;
}
