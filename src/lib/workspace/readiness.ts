import type { Initiative, MemoryClaim } from '../domain/types.ts';
import type { DeliveryFact, DeliveryMember } from '../delivery/types.ts';
import { factFor, ownerFor } from '../delivery/model.ts';

export interface InitiativeContext {
  id: string; workspaceId: string; initiativeId: string; label: string; note: string | null;
  revision: number; createdAt: string; updatedAt: string; retiredAt: string | null;
}
export type ReadinessKey = 'name' | 'businessLine' | 'owner' | 'stage' | 'objective' | 'context' | 'source' | 'confirmed' | 'target' | 'milestone';
export interface ReadinessRequirement { key: ReadinessKey; label: string; met: boolean; detail: string; href: string; }
export interface ReadinessInput {
  initiative: Initiative; facts: DeliveryFact[]; members: DeliveryMember[]; claims: Pick<MemoryClaim, 'status' | 'verifiedAt'>[];
  currentContext: InitiativeContext | null; activeSourceLinks: number; previouslyReady?: boolean;
}

/** Setup coverage only. Never suppresses a finding or implies release readiness. */
export function deriveReadiness({ initiative: i, facts, members, claims, currentContext, activeSourceLinks, previouslyReady = false }: ReadinessInput) {
  const base = `/initiatives/${i.slug}`;
  const scoped = facts.filter(f => f.workspaceId === i.workspaceId && f.initiativeId === i.id);
  const owner = members.find(m => m.id === ownerFor(scoped, i.id) && m.workspaceId === i.workspaceId && m.active && m.role !== 'VIEWER');
  const target = factFor(scoped, i.id, 'TARGET_LIVE');
  const milestone = factFor(scoped, i.id, 'NEXT_MILESTONE');
  const targetMet = Boolean(target?.value.date || target?.value.unknown === true);
  const milestoneMet = Boolean(milestone?.value.unknown === true || (milestone?.value.text?.trim() && (milestone.value.date || milestone.value.dateUnknown === true)));
  const contextMet = Boolean(currentContext && currentContext.workspaceId === i.workspaceId && currentContext.initiativeId === i.id && !currentContext.retiredAt);
  const requirements: ReadinessRequirement[] = [
    {key:'name',label:'Initiative name',met:Boolean(i.name.trim()),detail:i.name,href:`${base}/manage?section=basics`},
    {key:'businessLine',label:'Business line',met:Boolean(i.businessLine),detail:i.businessLine,href:`${base}/manage?section=basics`},
    {key:'owner',label:'Primary owner',met:Boolean(owner),detail:owner?.displayName ?? 'Assign an active owner',href:`${base}/manage?section=ownership`},
    {key:'stage',label:'Lifecycle stage',met:Boolean(i.stage),detail:i.stage,href:`${base}/manage?section=basics`},
    {key:'objective',label:'Objective / problem',met:Boolean(i.description?.trim()),detail:i.description?.trim() || 'Describe the problem this initiative addresses',href:`${base}/manage?section=basics`},
    {key:'context',label:'Current scope / phase',met:contextMet,detail:contextMet ? currentContext!.label : 'Choose a current context',href:`${base}/manage?section=context`},
    {key:'source',label:'Linked source',met:activeSourceLinks > 0,detail:activeSourceLinks ? `${activeSourceLinks} mapped ${activeSourceLinks === 1 ? 'item' : 'items'}` : 'Map a source to this initiative',href:`${base}/setup?step=sources`},
    {key:'confirmed',label:'Person-confirmed Knowledge entry',met:claims.some(c => c.status === 'ACTIVE' && Boolean(c.verifiedAt)),detail:claims.some(c => c.status === 'ACTIVE' && Boolean(c.verifiedAt)) ? 'At least one active entry has a recorded verification' : claims.some(c => c.status === 'ACTIVE') ? 'Active entries exist, but none has a recorded verification yet. Verify one in Knowledge.' : 'Add your first Knowledge entry and verify it',href:`${base}/knowledge`},
    {key:'target',label:'Target Live',met:targetMet,detail:target?.value.unknown ? 'Explicitly unknown' : target?.value.date ?? 'Not recorded',href:`${base}/setup?step=delivery`},
    {key:'milestone',label:'Next milestone',met:milestoneMet,detail:milestone?.value.unknown ? 'Explicitly unknown' : milestone?.value.text || 'Not recorded',href:`${base}/setup?step=delivery`},
  ];
  const completed = requirements.filter(r => r.met).length;
  const priority: ReadinessKey[] = ['owner','objective','context','source','target','milestone','confirmed','name','businessLine','stage'];
  const next = priority.map(key => requirements.find(r => r.key === key)!).find(r => !r.met) ?? null;
  return {requirements,completed,total:requirements.length,ready:completed === requirements.length,wasReady:previouslyReady && completed < requirements.length,
    label:i.archivedAt ? 'Archived' : completed === requirements.length ? 'Setup complete' : 'Setup incomplete',next:i.archivedAt ? null : next};
}
