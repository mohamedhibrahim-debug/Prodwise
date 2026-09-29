/**
 * Home is a projection of the portfolio projection: no new facts, only
 * selection, grouping and counting. Every number here is a count of active
 * initiatives that the linked register filter reproduces exactly.
 */
import type { PortfolioProjection, PortfolioRow, ProjectionChange } from './portfolio.ts';

export interface PulseItem { key: string; label: string; count: number; href: string; tone: 'attention' | 'neutral'; }

/** Only categories with something in them; a zero is not news. */
export function portfolioPulse(p: Pick<PortfolioProjection, 'rows' | 'summary'>): PulseItem[] {
  const active = p.rows.filter(r => !r.initiative.archivedAt);
  const withKind = (kind: string) => active.filter(r => r.attention.some(a => a.kind === kind)).length;
  const items: PulseItem[] = [
    { key: 'attention', label: 'Need attention', count: p.summary.attentionInitiatives, href: '/initiatives?attention=any', tone: 'attention' },
    { key: 'decision', label: 'Decisions needed', count: withKind('DECISION'), href: '/initiatives?attention=decision', tone: 'attention' },
    { key: 'blocker', label: 'Recorded blockers', count: withKind('BLOCKER'), href: '/initiatives?attention=blocker', tone: 'attention' },
    { key: 'past', label: 'Past target', count: withKind('PAST_TARGET'), href: '/initiatives?attention=past-target', tone: 'attention' },
    { key: 'upcoming', label: 'Targets in 28 days', count: p.summary.upcomingTargets, href: '/initiatives?target=upcoming', tone: 'neutral' },
    { key: 'unknown', label: 'No Target Live', count: p.summary.unknownTargets, href: '/initiatives?target=unknown', tone: 'neutral' },
    { key: 'setup', label: 'Setup incomplete', count: p.summary.setupIncomplete, href: '/initiatives?setup=incomplete', tone: 'neutral' },
  ];
  return items.filter(item => item.count > 0);
}

export interface ChangeLine { change: ProjectionChange; more: string[] }

/**
 * Recent meaningful changes for Home. Archived initiatives never appear (a
 * verification or test initiative that was archived is not portfolio news).
 * One event touching two initiatives is shown once; changes by the same
 * person to the same initiative within ten minutes read as one line.
 */
export function homeChanges(changes: ProjectionChange[], rows: PortfolioRow[], limit = 6): { added: ProjectionChange[]; lines: ChangeLine[] } {
  const live = new Set(rows.filter(r => !r.initiative.archivedAt).map(r => r.initiative.id));
  const visible = changes.filter(c => live.has(c.initiativeId));
  const added = visible.filter(c => c.sentence === 'Added to Prodwise');
  const seen = new Set<string>();
  const unique = visible.filter(c => c.sentence !== 'Added to Prodwise').filter(c => {
    const key = `${c.sentence}|${c.occurredAt.slice(0, 19)}`;
    if (seen.has(key)) return false; seen.add(key); return true;
  });
  const lines: ChangeLine[] = [];
  for (const c of unique) {
    const last = lines.at(-1);
    if (last && last.change.initiativeId === c.initiativeId && last.change.actorLabel === c.actorLabel && Math.abs(Date.parse(last.change.occurredAt) - Date.parse(c.occurredAt)) <= 600000) last.more.push(c.sentence);
    else lines.push({ change: c, more: [] });
  }
  return { added, lines: lines.slice(0, limit - (added.length ? 1 : 0)) };
}
