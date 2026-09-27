import "server-only";
import { randomUUID } from "node:crypto";
import { writeStoreAtomic } from "./store";
import { validateStageUpdate, type StageUpdate } from "../workspace/stage-policy";
import type { WorkspaceAccess } from "../auth/core";
/** Local fixture adapter; persistence and audit share one replacement. */
export function updateLocalInitiativeStage(ctx:WorkspaceAccess,input:StageUpdate,ownerMemberId:string|null) {
  writeStoreAtomic(state=>{
    const initiative=state.initiatives.find(i=>i.id===input.initiativeId&&i.workspaceId===ctx.workspaceId);
    if(!initiative)throw new Error("This initiative is unavailable in your organization.");
    validateStageUpdate(ctx,input,initiative,ownerMemberId);
    if(initiative.stage===input.stage)return;
    const before=initiative.stage,now=new Date().toISOString();
    initiative.stage=input.stage;initiative.updatedAt=now;
    state.activity.push({id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId:initiative.id,eventType:"STAGE_CHANGED",
      summary:"Lifecycle stage changed",occurredAt:now,entityType:"INITIATIVE",entityId:initiative.id,
      payload:{before,after:input.stage,reason:input.reason.trim(),actor:ctx.actor},actorLabel:ctx.actor.label});
  });
}
