/** Server-only half of the register view: projection rows → plain rows for the client. */
import { filterPortfolioRows, type PortfolioRow } from './portfolio.ts';
import { ATTENTION_SLUG, TARGET_FLAGS, type RegisterRow } from './register-view.ts';

/** Server side: one PortfolioRow → one plain row. `targetText` is pre-formatted by the caller. */
export function toRegisterRow(r: PortfolioRow, today: string, targetText: string, moved: string | null): RegisterRow {
  const seen = new Set<string>();
  const attention = r.attention.filter(a => (seen.has(a.label) ? false : (seen.add(a.label), true)))
    .map(a => ({ kind: ATTENTION_SLUG[a.kind], label: a.label }));
  const flags = TARGET_FLAGS.filter(flag => filterPortfolioRows([r], { target: flag, record: 'all' }, today).length > 0);
  return {
    id: r.initiative.id, slug: r.initiative.slug, name: r.initiative.name,
    businessLine: r.initiative.businessLine,
    reference: r.initiative.knownReferences?.split(/[\n,]/)[0]?.trim() || null,
    isDemo: Boolean(r.initiative.isDemo), archived: Boolean(r.initiative.archivedAt),
    stage: r.initiative.stage, ownerId: r.ownerId, ownerLabel: r.ownerLabel,
    setup: { completed: r.setup.completed, total: r.setup.total, ready: r.setup.ready, label: r.setup.label },
    attention,
    target: { text: targetText, date: r.target?.value.date ?? null, moved, flags: [...flags] },
    latest: r.latestChange ? { sentence: r.latestChange.sentence, at: r.latestChange.occurredAt } : null,
  };
}

