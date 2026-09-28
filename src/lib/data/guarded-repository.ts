import type { Repository } from './repository';
import { AccessError, authorizeBusiness, type WorkspaceAccess } from '../auth/core';
import { withRepositoryContext } from '../auth/repository-context';
import { cleanInput } from '@/lib/domain/text-input';
const writes = new Set(['createInitiative','createEvidence','updateEvidence','createClaim','updateClaim','setClaimEvidence',
  'verifyClaim','setEvidenceAnchor','resolveConflict','assignFindingConfirmer','setFindingState','reopenFindingState']);
function workspaceOf(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return 'workspaceId' in value ? value.workspaceId as string : undefined;
}
/** One production data entry point. Every method rechecks current membership,
 * even a direct server action or a previously rendered form. */
export function guardedRepository(resolve: () => Promise<WorkspaceAccess>, rawFor: (ctx: WorkspaceAccess) => Repository,
  writesEnabled: () => boolean, local: () => boolean, resolveWrite = resolve): Repository {
  return new Proxy({} as Repository, { get(_target, name) {
    // Repository is synchronous; Promise assimilation must not invent a then
    // operation and leave a server render awaiting an unresolved callback.
    if (typeof name !== 'string' || name === 'then') return undefined;
    return async (...args: unknown[]) => {
      const ctx = await (writes.has(name) ? resolveWrite() : resolve());
      if (writes.has(name)) authorizeBusiness(ctx, writesEnabled());
      const raw = rawFor(ctx);
      const method = Reflect.get(raw, name) as (...values: unknown[]) => Promise<unknown>;
      if (typeof method !== 'function') throw new AccessError('ACCESS_DENIED', 'Unsupported workspace operation.');
      return withRepositoryContext(ctx, async () => {
        const owned = (row: unknown) => row && (!local() || workspaceOf(row) === ctx.workspaceId);
        const assertOwned = async (kind: 'initiative' | 'claim' | 'evidence', id: unknown) => {
          if (typeof id !== 'string') throw new AccessError('ACCESS_DENIED', 'That item could not be found in this workspace.');
          const row = kind === 'claim' ? await raw.getClaim(id) : kind === 'evidence' ? await raw.getEvidence(id)
            : (await raw.listInitiatives()).find(item => item.id === id);
          if (!owned(row)) throw new AccessError('ACCESS_DENIED', 'That item could not be found in this workspace.');
          if (writes.has(name)) {
            const initiative = kind === 'initiative' ? row : (await raw.listInitiatives()).find(i => i.id === (row as {initiativeId?:string}).initiativeId);
            if ((initiative as {archivedAt?:string|null})?.archivedAt) throw new AccessError('INITIATIVE_ARCHIVED','Archived — restore to edit. Nothing was changed.');
          }
        };
        // Hand-entered text: invisible characters removed, lengths bounded, links must be web links.
        if (name === 'createEvidence' || name === 'createClaim') args[0] = cleanInput(args[0] as Record<string, unknown>);
        if (name === 'updateEvidence' || name === 'updateClaim') args[1] = cleanInput(args[1] as Record<string, unknown>);
        if (writes.has(name)) {
          if (name === 'createEvidence' || name === 'createClaim' || name === 'resolveConflict' || name === 'assignFindingConfirmer') {
            const input = args[0] as Record<string, unknown>;
            await assertOwned('initiative', input.initiativeId);
            args[0] = { ...input, actor: ctx.actor };
          } else if (name !== 'createInitiative') {
            const kind = name === 'updateEvidence' ? 'evidence' : ['setFindingState','reopenFindingState'].includes(name) ? 'initiative' : 'claim';
            await assertOwned(kind, args[0]);
          }
          if (name === 'updateClaim') {
            const patch = args[1] as { supersededByClaimId?: string | null };
            if (patch.supersededByClaimId) {
              await assertOwned('claim', patch.supersededByClaimId);
              if ((await raw.getClaim(args[0] as string))?.initiativeId !== (await raw.getClaim(patch.supersededByClaimId))?.initiativeId) throw new AccessError('ACCESS_DENIED', 'Replacement facts must belong to this initiative.');
            }
          }
          if (name === 'setClaimEvidence') {
            const claim = await raw.getClaim(args[0] as string);
            for (const id of args[1] as string[]) {
              await assertOwned('evidence', id);
              if ((await raw.getEvidence(id))?.initiativeId !== claim?.initiativeId) throw new AccessError('ACCESS_DENIED', 'Sources must belong to this initiative.');
            }
          }
          if (name === 'verifyClaim') args[1] = { ...(args[1] as object), actor: ctx.actor };
          if (name === 'setEvidenceAnchor') {
            await assertOwned('evidence', args[1]);
            if ((await raw.getClaim(args[0] as string))?.initiativeId !== (await raw.getEvidence(args[1] as string))?.initiativeId) throw new AccessError('ACCESS_DENIED', 'Sources must belong to this initiative.');
            args[2] = { ...(args[2] as object), actor: ctx.actor };
          }
          if (name === 'reopenFindingState') args[2] = ctx.actor;
        }
        const result = await Reflect.apply(method, raw, args);
        if (!local()) return result;
        if (Array.isArray(result)) {
          if (name === 'listInitiativeSnapshots') return result.filter(item => owned(item.initiative));
          return result.filter(owned);
        }
        if (name === 'getInitiativeSnapshot') return result && owned((result as { initiative: unknown }).initiative) ? result : null;
        if (['getInitiativeBySlug','getClaim','getEvidence'].includes(name)) return owned(result) ? result : null;
        return result;
      });
    };
  } });
}
