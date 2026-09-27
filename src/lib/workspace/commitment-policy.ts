import {canBusinessWrite,hasOrganizationAdminAuthority} from '../auth/roles.ts';
import type {WorkspaceAccess} from '../delivery/types.ts';
import type {Commitment} from './commitments.ts';
export const ACTION_STATUSES=['OPEN','IN_PROGRESS','DONE','CANCELLED'] as const;
export function canChangeCommitment(ctx:WorkspaceAccess,a:Commitment,ownerId:string|null,operation:'DETAILS'|'STATUS'){
 return canBusinessWrite(ctx)&&(hasOrganizationAdminAuthority(ctx)||ctx.isProductLead||ctx.memberId===ownerId||ctx.actor.id===a.createdBy||operation==='STATUS'&&ctx.memberId===a.assigneeMemberId);
}
