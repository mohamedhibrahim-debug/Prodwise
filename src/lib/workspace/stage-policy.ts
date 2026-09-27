import { AccessError, type WorkspaceAccess } from "../auth/core.ts";
import { hasOrganizationAdminAuthority, canBusinessWrite } from "../auth/roles.ts";
import { STAGES, type Stage } from "../domain/types.ts";
export interface StageUpdate { initiativeId:string; stage:Stage; expectedUpdatedAt:string; reason:string; scopeWorkspaceId:string; }
export function validateStageUpdate(ctx:WorkspaceAccess,input:StageUpdate,initiative:{workspaceId?:string;updatedAt:string},ownerMemberId:string|null) {
  if(input.scopeWorkspaceId!==ctx.workspaceId||initiative.workspaceId!==ctx.workspaceId)throw new AccessError("SCOPE_CHANGED","Your organization changed. Reload before saving.");
  if(!canBusinessWrite(ctx)||(!hasOrganizationAdminAuthority(ctx)&&(ctx.memberId===null||ownerMemberId!==ctx.memberId)))throw new AccessError("STAGE_ACCESS","Only the assigned PM or an organization administrator can change the stage.");
  if(!STAGES.includes(input.stage))throw new AccessError("STAGE_INVALID","Choose a lifecycle stage.");
  if(!input.reason.trim()||input.reason.trim().length>2000)throw new AccessError("STAGE_REASON","Record the reason for this stage change (up to 2,000 characters).");
  if(initiative.updatedAt!==input.expectedUpdatedAt)throw new AccessError("STALE_INITIATIVE","This initiative changed while you were editing. Reload before saving.");
}
