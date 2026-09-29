import type { AttentionKind } from '@/lib/workspace/portfolio';

/**
 * One vocabulary for attention reasons on Home and the Brief: a glyph, a short
 * label and an information-type tone. The tone maps to a `--kind-*` or
 * `--state-*` hue in the consuming module; the glyph and label always travel
 * with it, so a reason reads without colour (CLAUDE.md §16).
 *
 * Kinds are the portfolio's, unchanged: a decision awaiting a person, a
 * recorded blocker, a date that passed, a late dependency, changed support.
 */
export type AttentionTone = 'decision' | 'blocker' | 'past' | 'dependency' | 'support';
export const ATTENTION_KIND: Record<AttentionKind, { glyph: string; short: string; tone: AttentionTone; go: string }> = {
  DECISION: { glyph: '?', short: 'Decision needed', tone: 'decision', go: 'Review decision' },
  BLOCKER: { glyph: '■', short: 'Blocker', tone: 'blocker', go: 'Open delivery facts' },
  PAST_TARGET: { glyph: '▲', short: 'Past target', tone: 'past', go: 'Update delivery facts' },
  PAST_MILESTONE: { glyph: '▲', short: 'Past milestone', tone: 'past', go: 'Update delivery facts' },
  DEPENDENCY: { glyph: '⇢', short: 'Dependency late', tone: 'dependency', go: 'Review dependency' },
  SUPPORT_CHANGED: { glyph: '↻', short: 'Support changed', tone: 'support', go: 'Inspect support' },
};

/** Legend order for the attention band: the same ranking the portfolio uses to order rows. */
export const ATTENTION_TONES: { tone: AttentionTone; label: string; kinds: AttentionKind[]; filter: string; glyph: string }[] = [
  { tone: 'decision', label: 'Decision needed', kinds: ['DECISION'], filter: 'decision', glyph: '?' },
  { tone: 'blocker', label: 'Blocker', kinds: ['BLOCKER'], filter: 'blocker', glyph: '■' },
  { tone: 'past', label: 'Past target or milestone', kinds: ['PAST_TARGET', 'PAST_MILESTONE'], filter: 'past-target', glyph: '▲' },
  { tone: 'dependency', label: 'Dependency late', kinds: ['DEPENDENCY'], filter: 'dependency', glyph: '⇢' },
  { tone: 'support', label: 'Support changed', kinds: ['SUPPORT_CHANGED'], filter: 'support-changed', glyph: '↻' },
];
