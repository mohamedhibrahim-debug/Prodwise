"use server";
import { revalidatePath } from "next/cache";
import { mutateDelivery, readDeliveryFresh } from "./repository";
import { requireDeliveryFinalizeAccess, requireDeliveryWriteAccess } from "./access-adapter";
import { applyAiDraft, applyFactUpdatesAndRefresh, createReview, editSection, finalizeReview, recordFact, refreshReview } from "./model";
import { draftWeeklyWording } from "./ai";
import type { FactKind } from "./types";
import { assertFormWorkspace } from "@/lib/auth/scope";
import { getRepository } from "@/lib/data";
import { updateInitiativeStage } from "@/lib/workspace/stage";
import { DOMAINS, STAGES, type Domain, type Stage } from "@/lib/domain/types";
import type { RecordFactInput } from "./model";
import {createConfirmedDecision} from "./confirm-decision";
export interface DeliveryActionState { error: string | null; message: string | null; results?:{field:string;status:"APPLIED"|"FAILED"|"NOT_APPLIED";message:string}[]; }
async function scope(form:FormData) { const ctx=await requireDeliveryWriteAccess();assertFormWorkspace(form,ctx);return ctx; }
function text(form:FormData,key:string):string { return String(form.get(key) ?? "").trim(); }
function revision(form:FormData,key:string):number { const value=Number(text(form,key)); if (!Number.isSafeInteger(value) || value<0) throw new Error("Reload the form before saving."); return value; }
function refresh() { revalidatePath("/");revalidatePath("/analysis","layout");revalidatePath("/roadmap"); revalidatePath("/weekly-review"); revalidatePath("/initiatives","layout"); }
async function submit(work:()=>Promise<void>,message:string):Promise<DeliveryActionState> {
  try { await work(); refresh(); return {error:null,message}; }
  catch(error) { return {error:error instanceof Error ? error.message : "The change could not be saved. Reload and try again.",message:null}; }
}
export async function saveDeliveryFactAction(_previous:DeliveryActionState,form:FormData):Promise<DeliveryActionState> {
  try { await scope(form); } catch(error) {return {error:error instanceof Error?error.message:"Reload before saving.",message:null};}
  return submit(async()=>{ await mutateDelivery(async({ctx,source,state})=>{assertFormWorkspace(form,ctx);return recordFact(state,source,ctx,{initiativeId:text(form,"initiativeId"),kind:text(form,"kind") as FactKind,expectedRevision:revision(form,"revision"),value:{date:text(form,"date")||null,text:text(form,"text")||null,memberId:text(form,"memberId")||null,extent:text(form,"extent") === "PARTIAL" ? "PARTIAL" : text(form,"extent") === "FULL" ? "FULL" : null},retract:form.get("retract") === "yes"||(text(form,"kind")==="OWNER"&&!text(form,"memberId")),basis:text(form,"basis") === "EVIDENCE" ? "EVIDENCE" : "DIRECT_KNOWLEDGE",note:text(form,"note"),evidenceId:text(form,"evidenceId")||null,locator:text(form,"locator")||null},new Date().toISOString());}); },"Delivery fact confirmed and recorded.");
}
export async function createWeeklyReviewAction(_previous:DeliveryActionState,form:FormData):Promise<DeliveryActionState> {
  try { await scope(form); } catch(error) {return {error:error instanceof Error?error.message:"Reload before saving.",message:null};}
  return submit(async()=>{ await mutateDelivery(async({ctx,source,state})=>{assertFormWorkspace(form,ctx);return state.reviews.some(r=>r.workspaceId===ctx.workspaceId && r.week===text(form,"week")) ? state : createReview(state,source,ctx,text(form,"week"),new Date().toISOString());}); },"The shared review for this week is ready to open.");
}
export async function saveWeeklySectionAction(_previous:DeliveryActionState,form:FormData):Promise<DeliveryActionState> {
  try { await scope(form); } catch(error) {return {error:error instanceof Error?error.message:"Reload before saving.",message:null};}
  return submit(async()=>{ await mutateDelivery(async({ctx,source,state})=>{assertFormWorkspace(form,ctx);return editSection(state,source,ctx,text(form,"reviewId"),revision(form,"reviewRevision"),text(form,"initiativeId"),revision(form,"sectionRevision"),{headline:text(form,"headline"),updates:text(form,"updates"),attention:text(form,"attention"),decisionNeeded:text(form,"decisionNeeded"),nextMilestone:text(form,"nextMilestone"),nextStep:text(form,"nextStep")},new Date().toISOString());}); },"Your PM section is saved and marked reviewed.");
}
export async function refreshWeeklyReviewAction(_previous:DeliveryActionState,form:FormData):Promise<DeliveryActionState> {
  try { await scope(form); } catch(error) {return {error:error instanceof Error?error.message:"Reload before saving.",message:null};}
  return submit(async()=>{ await mutateDelivery(async({ctx,source,state})=>{assertFormWorkspace(form,ctx);return refreshReview(state,source,ctx,text(form,"reviewId"),revision(form,"revision"),new Date().toISOString());}); },"Delivery inputs refreshed. Changed PM notes were preserved and need review.");
}
export async function finalizeWeeklyReviewAction(_previous:DeliveryActionState,form:FormData):Promise<DeliveryActionState> {
  try { await scope(form); } catch(error) {return {error:error instanceof Error?error.message:"Reload before saving.",message:null};}
  return submit(async()=>{ await requireDeliveryFinalizeAccess(); await mutateDelivery(async({ctx,source,state})=>{assertFormWorkspace(form,ctx);return finalizeReview(state,source,ctx,text(form,"reviewId"),revision(form,"revision"),new Date().toISOString());}); },"The weekly review is final. Its snapshot is preserved.");
}
export async function draftWeeklyReviewAction(_previous:DeliveryActionState,form:FormData):Promise<DeliveryActionState> {
  return submit(async()=>{
    await scope(form); const read=await readDeliveryFresh();assertFormWorkspace(form,read.ctx);
    const review=read.state.reviews.find(r=>r.id===text(form,"reviewId") && r.workspaceId===read.ctx.workspaceId);
    if (!review || review.status!=="DRAFT") throw new Error("Open the current shared draft before requesting wording.");
    const baseline=read.state.reviews.find(r=>r.id===review.baselineReviewId && r.workspaceId===read.ctx.workspaceId && r.status==="FINAL" && r.week<review.week);
    // External generation never holds the local file transaction lock.
    const ai=await draftWeeklyWording(review,baseline?.input ?? null,read.ctx);
    await mutateDelivery(async({ctx,source,state})=>{assertFormWorkspace(form,ctx);return applyAiDraft(state,source,ctx,review.id,revision(form,"revision"),ai,new Date().toISOString());});
  },"Wording prepared. Check the source label and review your PM sections before saving.");
}

export async function applyRecordUpdatesAction(_previous:DeliveryActionState,form:FormData):Promise<DeliveryActionState> {
  const selected=["STAGE","DECISION","TARGET_LIVE","ACTUAL_LIVE","NEXT_MILESTONE","BLOCKER","NEXT_STEP"].filter(field=>form.get(`update:${field}`)==="yes");
  const results:NonNullable<DeliveryActionState["results"]>=selected.map(field=>({field,status:"NOT_APPLIED",message:"Not applied."}));
  let activeField=selected[0]??"updates",productChanged=false,deliveryApplied=false;
  const mark=(field:string,status:"APPLIED"|"FAILED",message:string)=>{const item=results.find(r=>r.field===field);if(item)Object.assign(item,{status,message});};
  try {
    const ctx=await scope(form);
    if(form.get("confirmedRecordUpdates")!=="yes"||!selected.length)throw new Error("Review and explicitly confirm the selected initiative updates.");
    const read=await readDeliveryFresh();assertFormWorkspace(form,read.ctx);
    const reviewId=text(form,"reviewId"),initiativeId=text(form,"initiativeId"),expectedReviewRevision=revision(form,"reviewRevision");
    const review=read.state.reviews.find(r=>r.id===reviewId&&r.workspaceId===ctx.workspaceId);
    const snapshot=read.source.snapshots.find(s=>s.initiative.id===initiativeId);
    if(!snapshot||!review||review.status!=="DRAFT"||review.revision!==expectedReviewRevision||!review.sections.some(s=>s.initiativeId===initiativeId))throw new Error("The shared Draft changed. Reload before applying initiative updates.");
    const basis=text(form,"recordBasis");if(basis!=="DIRECT_KNOWLEDGE"&&basis!=="EVIDENCE")throw new Error("Choose a confirmation basis.");
    const note=text(form,"recordReason");if(!note||note.length>2000)throw new Error("Record a confirmation reason of up to 2,000 characters.");
    const evidenceId=text(form,"recordEvidenceId")||null,locator=text(form,"recordLocator")||null;if(locator&&locator.length>500)throw new Error("Keep the source locator under 500 characters.");if(text(form,"decisionPhase").length>300)throw new Error("Keep decision phase under 300 characters.");
    if(basis==="EVIDENCE"&&!snapshot.evidence.some(e=>e.id===evidenceId&&e.boundary==="CURRENT_SCOPE"))throw new Error("Choose current-scope evidence in this initiative.");
    const facts:RecordFactInput[]=selected.filter(field=>!["STAGE","DECISION"].includes(field)).map(field=>({initiativeId,kind:field as FactKind,expectedRevision:revision(form,`${field}:revision`),value:{date:text(form,`${field}:date`)||null,text:text(form,`${field}:text`)||null,memberId:null,extent:text(form,`${field}:extent`)==="FULL"?"FULL":text(form,`${field}:extent`)==="PARTIAL"?"PARTIAL":null},retract:field==="BLOCKER"&&form.get("BLOCKER:retract")==="yes",basis,note,evidenceId,locator}));
    // Validate the entire proposed fact group before the first non-atomic product write.
    let checked=read.state;for(const fact of facts)checked=recordFact(checked,read.source,ctx,fact,new Date().toISOString());
    const stage=text(form,"recordStage") as Stage;
    if(selected.includes("STAGE")&&!STAGES.includes(stage))throw new Error("Choose a recorded lifecycle stage.");
    const decision={subject:text(form,"decisionSubject"),attribute:text(form,"decisionAttribute"),value:text(form,"decisionValue"),domain:text(form,"decisionDomain") as Domain};
    if(selected.includes("DECISION")&&(!decision.subject||!decision.attribute||!decision.value||decision.subject.length>300||decision.attribute.length>300||decision.value.length>4000||!DOMAINS.includes(decision.domain)))throw new Error("Complete the decision subject, attribute, value and domain.");
    if(selected.includes("STAGE")) {
      activeField="STAGE";await updateInitiativeStage({initiativeId,stage,expectedUpdatedAt:text(form,"initiativeUpdatedAt"),reason:note,scopeWorkspaceId:ctx.workspaceId});productChanged=true;mark("STAGE","APPLIED","Initiative stage updated and audited.");
    }
    if(selected.includes("DECISION")) {
      activeField="DECISION";await scope(form);const repo=getRepository();
      try {await createConfirmedDecision(repo,{initiativeId,type:"DECISION",...decision,phase:text(form,"decisionPhase")||null},{basis,note,evidenceId,locator,actor:ctx.actor},()=>{productChanged=true;});}
      catch(error){mark("DECISION","FAILED",error instanceof Error?error.message:"Decision confirmation incomplete; check Knowledge before retrying.");throw error;}
      mark("DECISION","APPLIED","Decision created and confirmed in Knowledge.");
    }
    activeField=facts[0]?.kind??"refresh";
    await mutateDelivery(async({ctx:fresh,source,state})=>{assertFormWorkspace(form,fresh);return applyFactUpdatesAndRefresh(state,source,fresh,reviewId,expectedReviewRevision,facts,new Date().toISOString());});
    deliveryApplied=true;for(const fact of facts)mark(fact.kind,"APPLIED","Initiative fact confirmed; history preserved.");
    refresh();return{error:null,message:"All selected initiative updates applied. The Draft refreshed; affected sections need re-check. Your meeting commentary was preserved.",results};
  } catch(error) {
    const message=error instanceof Error?error.message:"The initiative update was refused. Reload before retrying.";
    if(!results.some(r=>r.field===activeField&&r.status==="FAILED"))mark(activeField,"FAILED",message);
    if(productChanged&&!deliveryApplied) {
      try {await mutateDelivery(async({ctx,source,state})=>{assertFormWorkspace(form,ctx);const review=state.reviews.find(r=>r.id===text(form,"reviewId")&&r.workspaceId===ctx.workspaceId);if(!review||review.status!=="DRAFT")throw new Error("The review is no longer a Draft.");return refreshReview(state,source,ctx,review.id,review.revision,new Date().toISOString());});refresh();return{error:message,message:"Some initiative changes persisted. The Draft refreshed and commentary was preserved. Review each result before continuing.",results};}
      catch{return{error:message,message:"Some initiative changes persisted, but the Draft could not refresh. Reload, then refresh inputs before continuing.",results};}
    }
    refresh();return{error:message,message:"No delivery fact group was applied. Check each field result; earlier product writes, if any, are reported separately.",results};
  }
}
