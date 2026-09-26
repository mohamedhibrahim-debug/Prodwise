"use server";
import { revalidatePath } from "next/cache";
import { mutateDelivery, readDelivery } from "./repository";
import { requireDeliveryFinalizeAccess, requireDeliveryWriteAccess } from "./access-adapter";
import { applyAiDraft, createReview, editSection, finalizeReview, recordFact, refreshReview } from "./model";
import { draftWeeklyWording } from "./ai";
import type { FactKind } from "./types";
export interface DeliveryActionState { error: string | null; message: string | null; }
function text(form:FormData,key:string):string { return String(form.get(key) ?? "").trim(); }
function revision(form:FormData,key:string):number { const value=Number(text(form,key)); if (!Number.isSafeInteger(value) || value<0) throw new Error("Reload the form before saving."); return value; }
function refresh() { revalidatePath("/roadmap"); revalidatePath("/weekly-review"); revalidatePath("/initiatives","layout"); }
async function submit(work:()=>Promise<void>,message:string):Promise<DeliveryActionState> {
  try { await work(); refresh(); return {error:null,message}; }
  catch(error) { return {error:error instanceof Error ? error.message : "The change could not be saved. Reload and try again.",message:null}; }
}
export async function saveDeliveryFactAction(_previous:DeliveryActionState,form:FormData):Promise<DeliveryActionState> {
  return submit(async()=>{ await mutateDelivery(async({ctx,source,state})=>recordFact(state,source,ctx,{initiativeId:text(form,"initiativeId"),kind:text(form,"kind") as FactKind,expectedRevision:revision(form,"revision"),value:{date:text(form,"date")||null,text:text(form,"text")||null,memberId:text(form,"memberId")||null,extent:text(form,"extent") === "PARTIAL" ? "PARTIAL" : text(form,"extent") === "FULL" ? "FULL" : null},retract:form.get("retract") === "yes",basis:text(form,"basis") === "EVIDENCE" ? "EVIDENCE" : "DIRECT_KNOWLEDGE",note:text(form,"note"),evidenceId:text(form,"evidenceId")||null,locator:text(form,"locator")||null},new Date().toISOString())); },"Delivery fact confirmed and recorded.");
}
export async function createWeeklyReviewAction(_previous:DeliveryActionState,form:FormData):Promise<DeliveryActionState> {
  return submit(async()=>{ await mutateDelivery(async({ctx,source,state})=>state.reviews.some(r=>r.workspaceId===ctx.workspaceId && r.week===text(form,"week")) ? state : createReview(state,source,ctx,text(form,"week"),new Date().toISOString())); },"The shared review for this week is ready to open.");
}
export async function saveWeeklySectionAction(_previous:DeliveryActionState,form:FormData):Promise<DeliveryActionState> {
  return submit(async()=>{ await mutateDelivery(async({ctx,source,state})=>editSection(state,source,ctx,text(form,"reviewId"),revision(form,"reviewRevision"),text(form,"initiativeId"),revision(form,"sectionRevision"),{headline:text(form,"headline"),updates:text(form,"updates"),attention:text(form,"attention"),decisionNeeded:text(form,"decisionNeeded"),nextMilestone:text(form,"nextMilestone"),nextStep:text(form,"nextStep")},new Date().toISOString())); },"Your PM section is saved and marked reviewed.");
}
export async function refreshWeeklyReviewAction(_previous:DeliveryActionState,form:FormData):Promise<DeliveryActionState> {
  return submit(async()=>{ await mutateDelivery(async({ctx,source,state})=>refreshReview(state,source,ctx,text(form,"reviewId"),revision(form,"revision"),new Date().toISOString())); },"Delivery inputs refreshed. Changed PM notes were preserved and need review.");
}
export async function finalizeWeeklyReviewAction(_previous:DeliveryActionState,form:FormData):Promise<DeliveryActionState> {
  return submit(async()=>{ await requireDeliveryFinalizeAccess(); await mutateDelivery(async({ctx,source,state})=>finalizeReview(state,source,ctx,text(form,"reviewId"),revision(form,"revision"),new Date().toISOString())); },"The weekly review is final. Its snapshot is preserved.");
}
export async function draftWeeklyReviewAction(_previous:DeliveryActionState,form:FormData):Promise<DeliveryActionState> {
  return submit(async()=>{
    await requireDeliveryWriteAccess(); const read=await readDelivery();
    const review=read.state.reviews.find(r=>r.id===text(form,"reviewId") && r.workspaceId===read.ctx.workspaceId);
    if (!review || review.status!=="DRAFT") throw new Error("Open the current shared draft before requesting wording.");
    const baseline=read.state.reviews.find(r=>r.id===review.baselineReviewId);
    // External generation never holds the local file transaction lock.
    const ai=await draftWeeklyWording(review,baseline?.input ?? null,read.ctx);
    await mutateDelivery(async({ctx,source,state})=>applyAiDraft(state,source,ctx,review.id,revision(form,"revision"),ai,new Date().toISOString()));
  },"Wording prepared. Check the source label and review your PM sections before saving.");
}
