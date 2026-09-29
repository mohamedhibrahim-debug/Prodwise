import 'server-only';
import { getRepository } from '@/lib/data';
import { readManagement } from '@/lib/data/management-read';
import { readDelivery } from '@/lib/delivery/repository';
import { readRelationships } from '@/lib/data/relationships';
import { readQuestions } from '@/lib/data/questions';
import { readRisks } from '@/lib/data/risks';
import { readCommitments } from '@/lib/data/commitments';
import { readEvidence } from '@/lib/evidence/service';
import { listProjectMetrics } from '@/lib/analysis/metrics';
import { isDemoGuestSession } from '@/lib/auth/service';
import { isDemoWriteEnabled } from '@/lib/env';
import { projectAssistantContext, type AssistantContext } from './context-model';
import type { AssistantScreen } from './types';

/**
 * The only way Ask Prodwise sees data. Everything comes from the caller's own
 * verified session through the readers the pages use (each one calls
 * requireWorkspaceAccess itself), so the assistant can only ever see what that
 * person's screens would render. No identifier from the request is trusted:
 * the slug is resolved against the person's own snapshots, and one they cannot
 * open reads exactly like one that does not exist.
 *
 * Excluded by construction: platform/operator data, other people's connector
 * accounts and imported bodies. Evidence appears as titles and metadata only.
 */
export async function buildAssistantContext(screen: { kind: AssistantScreen; tab?: string | null; initiativeSlug?: string | null }): Promise<AssistantContext> {
  const [d, management, rel, qs, rs, commitments, guest] = await Promise.all([readDelivery(), readManagement(), readRelationships(), readQuestions(), readRisks(), readCommitments(), isDemoGuestSession()]);
  const snapshot = screen.kind === 'initiative' && screen.initiativeSlug ? d.source.snapshots.find(s => s.initiative.slug === screen.initiativeSlug) : undefined;
  const [activity, evidence, metrics] = await Promise.all([
    snapshot ? getRepository().listActivity(snapshot.initiative.id, 50) : getRepository().listRecentActivity(100),
    snapshot ? readEvidence(snapshot.initiative.id).catch(() => null) : Promise.resolve(null),
    listProjectMetrics(snapshot?.initiative.id).catch(() => []),
  ]);
  const asOf = d.presentation.scenarioAt ?? new Date().toISOString();
  return projectAssistantContext({
    screen: { kind: screen.kind, tab: screen.tab ?? null, initiativeSlug: snapshot?.initiative.slug ?? null },
    ctx: d.ctx, presentation: d.presentation, guest, writesEnabled: isDemoWriteEnabled,
    source: d.source, state: d.state, activity, management,
    relationships: rel.relationships, questions: qs.questions, risks: rs.tracking, commitments: commitments.actions,
    metrics, evidence, asOf, now: new Date().toISOString(),
  });
}
