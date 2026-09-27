import "server-only";
import { requireBusinessWriteAccess } from "@/lib/auth/access";
import { adminClient, isLocalAuth, configuredWorkspaceId } from "@/lib/auth/service";
import { withRepositoryContext } from "@/lib/auth/repository-context";
import { readDeliveryFresh } from "@/lib/delivery/repository";
import { LocalDeliveryStore } from "@/lib/delivery/local-store";
import { localDeliveryPath } from "@/lib/delivery/local-path";
import { ownerFor } from "@/lib/delivery/model";
import { updateLocalInitiativeStage } from "@/lib/data/local-stage";
import { validateStageUpdate, type StageUpdate } from "./stage-policy";
export type { StageUpdate } from "./stage-policy";
/** Audited canonical record write; review commentary is never used as authority. */
export async function updateInitiativeStage(input:StageUpdate):Promise<void> {
  const ctx=await requireBusinessWriteAccess();
  const read=await readDeliveryFresh();
  const initiative=read.source.snapshots.find(s=>s.initiative.id===input.initiativeId)?.initiative;
  if(!initiative)throw new Error("This initiative is unavailable in your organization.");
  validateStageUpdate(ctx,input,initiative,ownerFor(read.state.facts,input.initiativeId));
  if(isLocalAuth()) {
    const fresh=await requireBusinessWriteAccess();
    const delivery=await new LocalDeliveryStore(localDeliveryPath(process.cwd(),fresh.workspaceId,configuredWorkspaceId())).read();
    await withRepositoryContext(fresh,async()=>updateLocalInitiativeStage(fresh,input,ownerFor(delivery.facts,input.initiativeId)));
    return;
  }
  const {error}=await adminClient().rpc("update_initiative_stage",{
    p_workspace_id:ctx.workspaceId,p_member_id:ctx.memberId??ctx.actor.id,p_initiative_id:input.initiativeId,
    p_stage:input.stage,p_expected_updated_at:input.expectedUpdatedAt,p_reason:input.reason.trim(),
  });
  if(error)throw new Error(error.message.includes("STALE")?"This initiative changed while you were editing. Reload before saving.":"The stage change was refused. Check your access and reload.");
}
