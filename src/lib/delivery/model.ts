import {projectQueue} from "../review/dispositions.ts";
import {validateApplicability} from "../review/applicability.ts";
import { hasOrganizationAdminAuthority, isPlatformOwner, canBusinessWrite } from "../auth/roles.ts";
import { createHash, randomUUID } from "node:crypto";
import { runReview } from "../review/engine.ts";
import { applyFindingStates } from "../review/merge.ts";
import type { MemoryClaim } from "../domain/types.ts";
import { CLAIM_STATUS_LABEL } from "../domain/labels.ts";
import { confirmationNote, dateValid, factValueProblem, needsScopeFirst, SCOPE_PREREQUISITE } from "./fact-rules.ts";
import { FACT_KINDS, type AiDraft, type Change, type DeliveryFact, type DeliveryState, type FactKind, type FactValue, type PortfolioInput, type PortfolioSource, type Reference, type ReviewSection, type SectionEdit, type WeeklyReview, type WorkspaceAccess } from "./types.ts";

export class DeliveryError extends Error { readonly code:string; constructor(code: string, message: string) { super(message); this.code=code; } }
export function fail(code: string, message: string): never { throw new DeliveryError(code, message); }
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export function digest(value: unknown): string { return createHash("sha256").update(canonical(value)).digest("hex"); }
const metadata = new Set(["createdAt", "updatedAt", "capturedAt", "occurredAt", "lastVerifiedAt", "detectedOn"]);
export function meaningful(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(meaningful);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([k,v]) => !metadata.has(k)&&k!=='contexts'&&!(v==null&&['contextId','effectiveDate','contextName','context_id','effective_date','evidenceSubmissionId','evidenceAnchorId','evidence_submission_id','evidence_anchor_id'].includes(k))).map(([k,v]) => [k,meaningful(v)]));
  return value;
}
export function assertMember(ctx: WorkspaceAccess, source: PortfolioSource): void {
  // Platform authority is verified freshly at the server boundary.
  if (isPlatformOwner(ctx)) return;
  const member = source.members.find(m => m.id === ctx.memberId && m.workspaceId === ctx.workspaceId && m.active);
  if (!member || member.role !== ctx.role || member.isProductLead !== ctx.isProductLead) fail("ACCESS_CHANGED", "Your workspace access changed. Sign in again.");
}
export function assertWriter(ctx: WorkspaceAccess): void { if (!canBusinessWrite(ctx)) fail("READ_ONLY", "Viewers can read this workspace, but cannot save changes."); }
export function assertFinalizer(ctx: WorkspaceAccess): void {
  assertWriter(ctx);
  if (!hasOrganizationAdminAuthority(ctx) && !ctx.isProductLead) fail("FINALIZE_ACCESS", "An Owner, Admin or Product Lead must finalize the shared review.");
}
export { dateValid };
export function cairoDay(asOf: string): string { return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(asOf)); }
export function dayDifference(from: string, to: string): number { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`))/86400000); }
export function isoWeek(asOf: string): string {
  const day = new Date(`${cairoDay(asOf)}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const year = day.getUTCFullYear(); const start = new Date(Date.UTC(year,0,1));
  return `${year}-W${String(Math.ceil(((day.getTime()-start.getTime())/86400000+1)/7)).padStart(2,"0")}`;
}
export function weekValid(week: string): boolean {
  if (!/^\d{4}-W\d{2}$/.test(week)) return false;
  const year = Number(week.slice(0,4)); const weekNum = Number(week.slice(6));
  const dec28 = new Date(Date.UTC(year,11,28,12)); return weekNum > 0 && weekNum <= Number(isoWeek(dec28.toISOString()).slice(6));
}
export function factFor(facts: DeliveryFact[], initiativeId: string, kind: FactKind): DeliveryFact | undefined { return facts.find(f => f.initiativeId === initiativeId && f.kind === kind && f.state === "SET"); }
export function ownerFor(facts: DeliveryFact[], initiativeId: string): string | null { return factFor(facts,initiativeId,"OWNER")?.value.memberId ?? null; }
export function supportDigest(source: PortfolioSource, initiativeId: string, evidenceId: string | null, locator: string | null): string | null {
  if (!evidenceId) return null;
  const snap = source.snapshots.find(s => s.initiative.id === initiativeId);
  const evidence = snap?.evidence.find(e => e.id === evidenceId);
  const anchors = (snap?.claims ?? []).flatMap(c => (c as MemoryClaim).anchors ?? []).filter(a => a.evidenceId === evidenceId);
  const relevantEvidence = evidence ? {id:evidence.id,title:evidence.title,boundary:evidence.boundary,contentSummary:evidence.contentSummary,sourceReference:evidence.sourceReference,sourceUrl:evidence.sourceUrl} : {id:evidenceId,unavailable:true};
  return digest({ evidence: relevantEvidence, locator, anchors });
}
export function supportChanged(fact: DeliveryFact, source: PortfolioSource): boolean {
  return fact.basis === "EVIDENCE" && fact.supportDigest !== supportDigest(source,fact.initiativeId,fact.evidenceId,fact.locator);
}
export interface RecordFactInput { contextId?:string|null;effectiveDate?:string|null; initiativeId: string; kind: FactKind; expectedRevision: number; value: FactValue; retract: boolean; basis: "EVIDENCE" | "DIRECT_KNOWLEDGE"; note: string; evidenceId: string | null; locator: string | null; }
export function recordFact(state: DeliveryState, source: PortfolioSource, ctx: WorkspaceAccess, input: RecordFactInput, now: string): DeliveryState {
  assertMember(ctx,source); assertWriter(ctx);
  const snap = source.snapshots.find(s => s.initiative.id === input.initiativeId);
  if (!snap) fail("INITIATIVE_ACCESS", "This initiative is not in your workspace.");
  if (snap.initiative.archivedAt) fail("INITIATIVE_ARCHIVED", "Archived — restore to edit. Nothing was changed.");
  if (!FACT_KINDS.includes(input.kind)) fail("FACT_KIND", "Choose a delivery field.");
  const old = state.facts.find(f => f.workspaceId === ctx.workspaceId && f.initiativeId === input.initiativeId && f.kind === input.kind);
  if ((old?.revision ?? 0) !== input.expectedRevision) fail("STALE_FACT", "This fact changed while you were editing. Reload before saving.");
  if (input.kind === "OWNER") {
    if (!hasOrganizationAdminAuthority(ctx) && !ctx.isProductLead) fail("OWNER_ACCESS", "An Owner, Admin or Product Lead assigns initiative owners.");
    if (!input.retract && !source.members.some(m => m.id === input.value.memberId && m.workspaceId === ctx.workspaceId && m.active && m.role !== "VIEWER")) fail("OWNER_MEMBER", "Choose an active workspace Owner, Admin or Member.");
  } else if (!hasOrganizationAdminAuthority(ctx) && ownerFor(state.facts,input.initiativeId) !== ctx.memberId) fail("SECTION_ACCESS", "Only the assigned PM, Owner or Admin can update this initiative's delivery facts.");
  if (input.note.length > 2000) fail("CONFIRMATION_NOTE", "Keep the confirmation or change reason under 2,000 characters.");
  if (input.basis !== "EVIDENCE" && input.basis !== "DIRECT_KNOWLEDGE") fail("BASIS", "Choose how you confirmed this fact.");
  if (input.basis === "EVIDENCE") {
    const evidence = snap.evidence.find(e => e.id === input.evidenceId);
    if (!evidence || evidence.boundary !== "CURRENT_SCOPE") fail("EVIDENCE_BOUNDARY", "Choose current-scope evidence belonging to this initiative.");
  }
  if (input.locator && input.locator.length > 500) fail("LOCATOR", "Keep the source location under 500 characters.");
  if (!input.retract) {
    const v = input.value;
    const problem = factValueProblem(input.kind, v, cairoDay(now)); if (problem) fail(problem.code, problem.message);
    if (needsScopeFirst(input.kind, Boolean(factFor(state.facts,input.initiativeId,"SCOPE")))) fail("SCOPE_REQUIRED", SCOPE_PREREQUISITE);
    if (input.kind === "SCOPE" && old?.value.text !== v.text && state.facts.some(f => f.initiativeId === input.initiativeId && f.state === "SET" && !["SCOPE","OWNER"].includes(f.kind))) fail("SCOPE_HAS_FACTS", "Retract dates and delivery facts from the earlier scope before changing the scope label.");
  } else if (input.kind === "SCOPE" && state.facts.some(f => f.initiativeId === input.initiativeId && f.state === "SET" && !["SCOPE","OWNER"].includes(f.kind))) fail("SCOPE_HAS_FACTS", "Retract the scoped delivery facts before withdrawing their scope.");
  const applies=validateApplicability({contextId:input.contextId===undefined?old?.contextId:input.contextId,effectiveDate:input.effectiveDate===undefined?old?.effectiveDate:input.effectiveDate},source.contexts??[],ctx.workspaceId,input.initiativeId,old);
  const fact: DeliveryFact = {...applies, id:old?.id ?? randomUUID(), workspaceId:ctx.workspaceId, initiativeId:input.initiativeId, kind:input.kind, revision:(old?.revision ?? 0)+1,
    value:input.retract ? { date:null,text:null,memberId:null,extent:null } : input.value, state:input.retract ? "RETRACTED" : "SET",
    basis:input.basis, note:confirmationNote(input.note), evidenceId:input.basis === "EVIDENCE" ? input.evidenceId : null, locator:input.basis === "EVIDENCE" ? input.locator : null,
    supportDigest:input.basis === "EVIDENCE" ? supportDigest(source,input.initiativeId,input.evidenceId,input.locator) : null,
    confirmedByMemberId:ctx.memberId, confirmedByUserId:ctx.actor.id, confirmedByLabel:ctx.actor.label, updatedAt:now };
  return { ...state, facts:[...state.facts.filter(f => f.id !== fact.id),fact], events:[...state.events,{ id:randomUUID(), workspaceId:ctx.workspaceId, initiativeId:input.initiativeId, occurredAt:now, actor:ctx.actor, before:old ?? null, after:fact }] };
}
/** "24 Sept 2026" for a calendar date; "Unknown" when none is recorded. */
export function displayDate(date: string | null | undefined): string {
  return date ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)) : "Unknown";
}
const FACT_NAME:Record<string,string>={TARGET_LIVE:"Target Live",ACTUAL_LIVE:"Actual Live",NEXT_MILESTONE:"Next milestone",NEXT_STEP:"Next step",BLOCKER:"Blocker",OWNER:"Owner",SCOPE:"Scope",DEV_STARTED:"Development start",SOLUTION_DEFINED:"Solution defined"};
export function freezeInput(source: PortfolioSource, state: DeliveryState, workspaceId: string, asOf: string): PortfolioInput {
  const facts = structuredClone(state.facts.filter(f => f.workspaceId === workspaceId).sort((a,b) => a.id.localeCompare(b.id)));
  const events = structuredClone(state.events.filter(e => e.workspaceId === workspaceId).sort((a,b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id)));
  const ordered = structuredClone({ ...(source.findingDispositions?.length?{findingDispositions:source.findingDispositions.filter(d=>d.workspaceId===workspaceId).sort((a,b)=>a.id.localeCompare(b.id)),queueFinalizations:[...(source.queueFinalizations??[])].filter(f=>f.workspaceId===workspaceId).sort((a,b)=>a.id.localeCompare(b.id))}:{}), ...(source.commitments?{commitments:[...source.commitments].filter(a=>a.workspaceId===workspaceId).sort((a,b)=>a.id.localeCompare(b.id))}:{}), snapshots:[...source.snapshots].map(s=>({...s,claims:s.claims.map(c=>c.contextId?{...c,contextName:source.contexts?.find(x=>x.id===c.contextId)?.label??null}:c)})).sort((a,b) => a.initiative.id.localeCompare(b.initiative.id)), members:[...source.members].sort((a,b) => a.id.localeCompare(b.id)) });
  const queueProjection=ordered.findingDispositions?.length?ordered.snapshots.map(s=>({initiativeId:s.initiative.id,counts:projectQueue(applyFindingStates(runReview(s.initiative.id,s.claims),s.findingStates),ordered.findingDispositions!.filter(d=>d.initiativeId===s.initiative.id),ordered.queueFinalizations??[],asOf,s.findingStates).counts})):null;
  return { ...ordered, workspaceId,facts,events,asOf,digest:digest({ source:meaningful(ordered), facts,...(queueProjection?{queueProjection}:{}) }) };
}
export function sectionDigest(input: PortfolioInput, initiativeId: string): string {
  return digest({ ...(input.findingDispositions?.length?{findingDispositions:input.findingDispositions.filter(d=>d.initiativeId===initiativeId),queueLanes:queueForInput(input,initiativeId).counts}:{}), ...(input.commitments?{commitments:input.commitments.filter(a=>a.initiativeId===initiativeId)}:{}), source: meaningful(input.snapshots.find(s => s.initiative.id === initiativeId)), facts:input.facts.filter(f => f.initiativeId === initiativeId), members:input.members.map(m=>({ id:m.id,active:m.active,role:m.role })) });
}
export function latestBaseline(state: DeliveryState, workspaceId: string, week: string): WeeklyReview | null {
  return state.reviews.filter(r=>r.workspaceId === workspaceId && r.status === "FINAL" && r.week < week).sort((a,b)=>b.week.localeCompare(a.week))[0] ?? null;
}
function knowledgeValue(claim:MemoryClaim) {
  return {subject:claim.subject,attribute:claim.attribute,value:claim.value,status:claim.status,type:claim.type,domain:claim.domain,phase:claim.phase,
    verifiedAt:claim.verifiedAt,verifiedActorId:claim.verifiedActorId,verifiedActorLabel:claim.verifiedActorLabel,verificationBasis:claim.verificationBasis,verificationNote:claim.verificationNote};
}
function knowledgeSupport(claim:MemoryClaim) {
  return {evidence:claim.evidence.map(e=>({id:e.id,title:e.title,boundary:e.boundary,content:e.contentSummary,reference:e.sourceReference,url:e.sourceUrl})).sort((a,b)=>a.id.localeCompare(b.id)),anchors:[...(claim.anchors ?? [])].sort((a,b)=>canonical(a).localeCompare(canonical(b)))};
}
function sourceLabel(claim:MemoryClaim):string { return claim.evidence.length ? ` Sources: ${claim.evidence.map(e=>e.title).join("; ")}.` : " No evidence linked."; }
export function changesSince(input: PortfolioInput, baseline: PortfolioInput | null): Change[] {
  if (!baseline) return [];
  const result: Change[]=[];
  for (const snap of input.snapshots) {
    const id=snap.initiative.id;
    if (!baseline.snapshots.some(s=>s.initiative.id===id)) { const late=input.events.filter(e=>e.initiativeId===id&&e.occurredAt>baseline.asOf&&e.occurredAt<=input.asOf&&["DEV_STARTED","SOLUTION_DEFINED","ACTUAL_LIVE"].includes(e.after.kind)&&e.after.value.date&&e.after.value.date<=cairoDay(baseline.asOf));result.push({ id:`scope:${id}`,initiativeId:id,kind:"SCOPE",label:"New to this review scope."+(late.length?" Earlier effective dates were recorded after the previous Final; this is late-recorded provenance, not proof the delivery occurred this week.":""),eventIds:late.map(e=>e.id),days:null,lateRecorded:Boolean(late.length) }); continue; }
    const prior=baseline.snapshots.find(s=>s.initiative.id===id)!;
    const scopeChanged=canonical(factFor(baseline.facts,id,"SCOPE")?.value ?? null)!==canonical(factFor(input.facts,id,"SCOPE")?.value ?? null);
    const add=(kind:"KNOWLEDGE"|"DECISION"|"STAGE"|"SUPPORT",ref:string,label:string)=>result.push({id:`change:${id}:${ref}`,initiativeId:id,kind,label,eventIds:[],days:null,lateRecorded:false});
    if((prior.initiative.archivedAt??null)!==(snap.initiative.archivedAt??null))result.push({id:`archive:${id}:${snap.initiative.archivedAt??'restored'}`,initiativeId:id,kind:'SCOPE',label:snap.initiative.archivedAt?'Initiative archived; earlier evidence, decisions and delivery history are preserved.':'Initiative restored to the active portfolio.',eventIds:[],days:null,lateRecorded:false});
    if (prior.initiative.stage!==snap.initiative.stage) add("STAGE","stage",`Recorded initiative stage: ${prior.initiative.stage} → ${snap.initiative.stage}. This does not infer release readiness.`);
    for (const claim of snap.claims) {
      const previous=prior.claims.find(c=>c.id===claim.id);
      if (!previous) add("KNOWLEDGE",`knowledge:${claim.id}`,`Knowledge record added: ${claim.subject} · ${claim.attribute} = ${claim.value} (${claim.status}).${sourceLabel(claim)}`);
      else {
        if (canonical(knowledgeValue(previous))!==canonical(knowledgeValue(claim))) {
          const valueChange=previous.value!==claim.value || previous.status!==claim.status ? `${previous.value} (${previous.status}) → ${claim.value} (${claim.status})` : `value ${claim.value} (${claim.status}); recorded confirmation or context changed`;
          const confirmation=claim.verifiedAt ? ` Confirmation: ${claim.verifiedActorLabel ?? "actor not recorded"} · ${claim.verificationBasis ?? "basis not recorded"} · ${claim.verifiedAt}.` : " Verification history not recorded.";
          add("KNOWLEDGE",`knowledge:${claim.id}`,`Knowledge record ${claim.subject} · ${claim.attribute}: ${valueChange}.${confirmation}${sourceLabel(claim)}`);
        }
        if (canonical(knowledgeSupport(previous))!==canonical(knowledgeSupport(claim))) add("SUPPORT",`knowledge-support:${claim.id}`,`Supporting evidence changed for Knowledge record ${claim.subject} · ${claim.attribute}. Recorded value remains ${claim.value} (${claim.status}); no automatic invalidation.${sourceLabel(claim)}`);
      }
    }
    for (const claim of prior.claims) if (!snap.claims.some(c=>c.id===claim.id)) add("KNOWLEDGE",`knowledge-unavailable:${claim.id}`,"A previously recorded Knowledge entry is no longer present in this initiative snapshot; its absence does not establish a product decision.");
    for (const decision of snap.findingStates) {
      const previous=prior.findingStates.find(d=>d.fingerprint===decision.fingerprint);
      if (!previous || canonical(meaningful(previous))!==canonical(meaningful(decision))) add("DECISION",`decision:${decision.fingerprint}`,`Recorded decision state ${decision.subject ?? "for the linked mismatch"}: ${previous?.status ?? "not recorded"} → ${decision.status}; outcome ${previous?.outcome ?? "not recorded"} → ${decision.outcome ?? "not recorded"}${decision.decidedValue ? `; recorded value ${decision.decidedValue}` : ""}${decision.resolution ? `; note ${decision.resolution}` : ""}. Reference ${decision.fingerprint}.`);
    }
    for (const decision of prior.findingStates) if (!snap.findingStates.some(d=>d.fingerprint===decision.fingerprint)) add("DECISION",`decision-unavailable:${decision.fingerprint}`,`Previously recorded decision state ${decision.fingerprint} is not present in the current snapshot. Its outcome is not inferred.`);
    for (const kind of FACT_KINDS) {
      const before=factFor(baseline.facts,id,kind); const after=factFor(input.facts,id,kind);
      const events=input.events.filter(e=>e.initiativeId===id && e.after.kind===kind && e.occurredAt>baseline.asOf && e.occurredAt<=input.asOf);
      const valueChanged=canonical(before?.value ?? null)!==canonical(after?.value ?? null);
      const intermediate=events.some(e=>canonical(e.before?.value ?? null)!==canonical(e.after.value));
      if (!valueChanged && !intermediate) continue;
      if (scopeChanged && kind!=="SCOPE" && kind!=="OWNER") {
        result.push({id:`change:${id}:${kind}`,initiativeId:id,kind,label:`${kind.replaceAll("_"," ").toLowerCase()}: ${after?.value.unknown ? "explicitly unknown" : after?.value.date ?? after?.value.text ?? "not recorded"} for the changed scope. Earlier scope values remain in history; this is not a like-for-like target movement.`,eventIds:events.map(e=>e.id),days:null,lateRecorded:false});
        continue;
      }
      const days=before?.value.date && after?.value.date ? dayDifference(before.value.date,after.value.date) : null;
      const path=events.map(e=>e.after.state === "RETRACTED" ? "Withdrawn" : e.after.value.date ?? e.after.value.text ?? e.after.value.memberId ?? "Unknown");
      const late=Boolean(after?.value.date && after.value.date <= cairoDay(baseline.asOf) && events.length);
      const field=FACT_NAME[kind]??kind.replaceAll("_"," ").toLowerCase();
      const show=(v:{unknown?:boolean;date?:string|null;text?:string|null}|undefined,fallback:string)=>v?.unknown ? "explicitly unknown" : v?.date ? displayDate(v.date) : v?.text ? v.text.replace(/[.\s]+$/,"") : fallback;
      const label=!valueChanged ? `${field}: changed and returned to the previous value (${path.map(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)?displayDate(v):v).join(" → ")}).` : !after ? `${field}: withdrawn; current value unknown.` : !before ? `${field} recorded: ${show(after.value,"owner assignment")}.` : `${field}: ${show(before.value,"previous assignment")} → ${show(after.value,"new assignment")}${days !== null ? ` (${Math.abs(days)} days ${days>=0?"later":"earlier"})` : ""}${path.length>1?`; movement history ${path.join(" → ")}`:""}.`;
      result.push({ id:`change:${id}:${kind}`,initiativeId:id,kind,label:label+(late?" Recorded after the previous review for an earlier effective date.":""),eventIds:events.map(e=>e.id),days,lateRecorded:late });
    }
  }
  for (const snap of baseline.snapshots) if (!input.snapshots.some(s=>s.initiative.id===snap.initiative.id)) result.push({ id:`left:${snap.initiative.id}`,initiativeId:snap.initiative.id,kind:"SCOPE",label:`${snap.initiative.name}: left the review scope.`,eventIds:[],days:null,lateRecorded:false });
  for(const action of input.commitments??[]){const before=baseline.commitments?.find(a=>a.id===action.id);if(!before||canonical(before)!==canonical(action))result.push({id:`commitment:${action.id}:${action.revision}`,initiativeId:action.initiativeId,kind:'COMMITMENT',label:`Commitment “${action.title}”: ${before?before.status.toLowerCase().replaceAll('_',' ')+' → ':''}${action.status.toLowerCase().replaceAll('_',' ')}${action.dueDate?`; due ${displayDate(action.dueDate)}`:'; due date not recorded'}.`,eventIds:[],days:null,lateRecorded:false});}
  return result;
}
/** Keep an archive transition in one reviewed week, then omit it from active
 * sections. The full frozen input remains available for audit and comparison. */
export function weeklySnapshots(input:PortfolioInput,baseline:PortfolioInput|null){
 return input.snapshots.filter(s=>!s.initiative.archivedAt||baseline?.snapshots.find(b=>b.initiative.id===s.initiative.id)?.initiative.archivedAt!==s.initiative.archivedAt);
}
export function referencesFor(input: PortfolioInput, baseline: PortfolioInput | null): Reference[] {
  const refs:Reference[] = changesSince(input,baseline).map(c=>({ id:c.id,initiativeId:c.initiativeId,texts:[c.label,`Recorded change: ${c.label}`] }));
  for (const snap of weeklySnapshots(input,baseline)) {
    const id=snap.initiative.id;
    for (const action of input.commitments?.filter(a=>a.initiativeId===id)??[]) {
      const text=`Recorded commitment: ${action.title}; status ${action.status.toLowerCase().replaceAll("_"," ")}; due ${action.dueDate??"date not recorded"}; assignee ${input.members.find(m=>m.id===action.assigneeMemberId)?.displayName??"not assigned"}${action.blockedNote?`; blocked: ${action.blockedNote}`:""}.`;
      refs.push({id:`action:${action.id}:${action.revision}`,initiativeId:id,texts:[text,`Current record: ${text}`]});
    }
    for (const claim of snap.claims) {
      const text=`Recorded Knowledge ${claim.subject} · ${claim.attribute}: ${claim.value} (${CLAIM_STATUS_LABEL[claim.status] ?? claim.status}).${claim.verifiedAt ? ` Confirmed by ${claim.verifiedActorLabel ?? "actor not recorded"}.` : claim.origin === "LEGACY" ? " Verification history not recorded." : " Not yet confirmed."}${sourceLabel(claim)}`;
      refs.push({id:`knowledge:${claim.id}`,initiativeId:id,texts:[text,`Current record: ${text}`]});
    }
    for (const fact of input.facts.filter(f=>f.initiativeId===id && f.state === "SET" && f.kind !== "OWNER")) {
      const field=fact.kind.replaceAll("_"," ").toLowerCase(); const value=fact.value.unknown?"Explicitly unknown":[fact.value.date,fact.value.text,fact.value.dateUnknown?"Date explicitly unknown":null].filter(Boolean).join(" — ");
      const text=`${field}: ${value}${fact.kind === "ACTUAL_LIVE" ? ` (${fact.value.extent?.toLowerCase()} rollout within the recorded scope)` : ""}.`;
      refs.push({ id:`fact:${fact.id}:${fact.revision}`,initiativeId:id,texts:[text,`Confirmed ${text}`] });
      if (supportChanged(fact,input)) refs.push({ id:`support:${fact.id}`,initiativeId:id,texts:["Supporting evidence changed; the recorded value needs review.","Review changed supporting evidence before relying on this recorded value."] });
    }
    const findings=queueForInput(input,id).lanes.open.map(i=>i.finding);
    for (const finding of findings) { const text=`Recorded mismatch: ${finding.subject}, ${finding.claims[0]?.attribute ?? "values"} — ${finding.claims.map(c=>c.value).join(" / ")}. Business impact is not assessed.`; refs.push({ id:`finding:${finding.fingerprint}`,initiativeId:id,texts:[text,`Review the ${text}`] }); }
  }
  return refs;
}
function newSection(input:PortfolioInput,id:string,baseline:PortfolioInput|null):ReviewSection {
  const changes=changesSince(input,baseline).filter(c=>c.initiativeId===id);
  const milestone=factFor(input.facts,id,"NEXT_MILESTONE");
  const snapshot=input.snapshots.find(s=>s.initiative.id===id)!;
  const openDecisions=queueForInput(input,id).lanes.open.map(i=>i.finding);
  const scope=factFor(input.facts,id,"SCOPE")?.value.text;
  return { initiativeId:id,ownerMemberId:ownerFor(input.facts,id),revision:1,headline:`${snapshot.initiative.stage.replaceAll("_"," ")} · ${scope ?? "Scope not confirmed"}`,updates:changes.map(c=>c.label).join("\n") || (baseline ? "No recorded changes since the previous final review." : "First review: current-state inventory. No previous final baseline."),attention:factFor(input.facts,id,"BLOCKER")?.value.text ?? "No blocker recorded; absence does not confirm there are none.",decisionNeeded:openDecisions.length ? openDecisions.map(f=>`Review differing recorded values for ${f.subject}: ${f.claims.map(c=>c.value).join(" / ")}.`).join("\n") : "No decision request recorded.",nextMilestone:milestone ? milestone.value.unknown?"Explicitly unknown":`${milestone.value.text} — ${milestone.value.date ?? (milestone.value.dateUnknown?"Date explicitly unknown":"Date not recorded")}` : "Not recorded",nextStep:factFor(input.facts,id,"NEXT_STEP")?.value.text ?? "Not recorded",sourceDigest:sectionDigest(input,id),needsRecheck:false,editedByMemberId:null,editedAt:null,aiOriginal:null };
}
export function createReview(state:DeliveryState,source:PortfolioSource,ctx:WorkspaceAccess,week:string,now:string):DeliveryState {
  assertMember(ctx,source); assertWriter(ctx);
  if (!weekValid(week)) fail("WEEK","Choose a valid ISO week.");
  if (week > isoWeek(now)) fail("FUTURE_WEEK","Choose the current week or a previous week.");
  if (state.reviews.some(r=>r.workspaceId===ctx.workspaceId && r.week===week)) fail("SHARED_REVIEW_EXISTS","The shared review for this week already exists. Open it to continue.");
  if (state.reviews.some(r=>r.workspaceId===ctx.workspaceId && r.status === "FINAL" && r.week>=week)) fail("OUT_OF_ORDER_WEEK","A later week is finalized. Open existing historical reviews or prepare the current week.");
  const input=freezeInput(source,state,ctx.workspaceId,now); const baseline=latestBaseline(state,ctx.workspaceId,week);
  const review:WeeklyReview={ id:randomUUID(),workspaceId:ctx.workspaceId,week,status:"DRAFT",revision:1,baselineReviewId:baseline?.id ?? null,input,sections:weeklySnapshots(input,baseline?.input??null).map(s=>newSection(input,s.initiative.id,baseline?.input ?? null)),aiDrafts:[],createdAt:now,createdByMemberId:ctx.memberId,createdByUserId:ctx.actor.id,finalizedAt:null,finalizedByMemberId:null,finalizedByLabel:null };
  return { ...state,reviews:[...state.reviews,review] };
}
function draft(state:DeliveryState,ctx:WorkspaceAccess,id:string,revision:number | null):WeeklyReview {
  const review=state.reviews.find(r=>r.id===id && r.workspaceId===ctx.workspaceId);
  if (!review) fail("REVIEW_ACCESS","This review is not in your workspace.");
  if (review.status === "FINAL") fail("FINAL_IMMUTABLE","This finalized review is immutable. Record corrections in a later week's review.");
  if (revision !== null && review.revision!==revision) fail("STALE_REVIEW","The shared review changed. Reload before continuing.");
  return review;
}
function replaceReview(state:DeliveryState,review:WeeklyReview):DeliveryState { return { ...state,reviews:state.reviews.map(r=>r.id===review.id ? review : r) }; }
export function editSection(state:DeliveryState,source:PortfolioSource,ctx:WorkspaceAccess,reviewId:string,expectedRevision:number,initiativeId:string,sectionRevision:number,edit:SectionEdit,now:string):DeliveryState {
  assertMember(ctx,source); assertWriter(ctx); const review=draft(state,ctx,reviewId,null);
  void expectedRevision; // Independent PM sections use their own optimistic revision.
  const section=review.sections.find(s=>s.initiativeId===initiativeId);
  if (!section || !source.snapshots.some(s=>s.initiative.id===initiativeId)) fail("SECTION_ACCESS","This initiative is no longer in the workspace. Refresh the review.");
  const currentOwner=ownerFor(state.facts,initiativeId);
  if (!hasOrganizationAdminAuthority(ctx) && !ctx.isProductLead && (currentOwner!==ctx.memberId || section.ownerMemberId!==ctx.memberId)) fail("SECTION_ACCESS","Only the assigned PM or a review coordinator can edit this section.");
  if (section.revision!==sectionRevision) fail("STALE_SECTION","This PM section changed. Reload before saving.");
  if (Object.values(edit).some(v=>typeof v!=="string" || v.length>4000)) fail("SECTION_TEXT","Keep each section under 4,000 characters.");
  const current=freezeInput(source,state,ctx.workspaceId,now);
  if (section.sourceDigest!==sectionDigest(current,initiativeId)) fail("STALE_SECTION_INPUT","Delivery facts changed. Refresh the shared review before editing this section.");
  const next={ ...section,...edit,revision:section.revision+1,needsRecheck:false,editedByMemberId:ctx.memberId,editedByUserId:ctx.actor.id,editedByLabel:ctx.actor.label,editedAt:now };
  return replaceReview(state,{ ...review,revision:review.revision+1,sections:review.sections.map(s=>s.initiativeId===initiativeId?next:s) });
}
export function refreshReview(state:DeliveryState,source:PortfolioSource,ctx:WorkspaceAccess,id:string,revision:number,now:string):DeliveryState {
  assertMember(ctx,source); assertWriter(ctx); const review=draft(state,ctx,id,revision);
  const input=freezeInput(source,state,ctx.workspaceId,now); const baseline=latestBaseline(state,ctx.workspaceId,review.week);
  const sections=weeklySnapshots(input,baseline?.input??null).map(s=>{ const old=review.sections.find(section=>section.initiativeId===s.initiative.id); if (!old) return newSection(input,s.initiative.id,baseline?.input ?? null);
    return { ...old,ownerMemberId:ownerFor(input.facts,s.initiative.id),sourceDigest:sectionDigest(input,s.initiative.id),revision:old.revision+1,needsRecheck:old.needsRecheck || old.sourceDigest!==sectionDigest(input,s.initiative.id) || review.baselineReviewId!==baseline?.id && Boolean(baseline) }; });
  return replaceReview(state,{ ...review,input,baselineReviewId:baseline?.id ?? null,revision:review.revision+1,sections });
}
/** Used by the visible checklist and final mutation: no independent approval state. */
export function finalizationChecks(state:DeliveryState,source:PortfolioSource,ctx:WorkspaceAccess,review:WeeklyReview,now:string,writesEnabled:boolean) {
  const current=freezeInput(source,state,ctx.workspaceId,now);
  const baseline=latestBaseline(state,ctx.workspaceId,review.week);
  const available=new Set(source.snapshots.map(s=>s.initiative.id));
  return [
    {id:"draft",label:"The review is a Draft",met:review.status==="DRAFT"},
    {id:"authority",label:"You are an Org Owner, Admin, Platform Owner or Product Lead",missing:"Finalizing needs an Org Owner, Admin, Platform Owner or Product Lead",met:canBusinessWrite(ctx)&&(hasOrganizationAdminAuthority(ctx)||ctx.isProductLead)},
    {id:"environment",label:"Changes are enabled in this environment",missing:"Changes are disabled in this environment",met:writesEnabled},
    {id:"chronology",label:"No later week is finalized",missing:"A later week is already finalized",met:!state.reviews.some(r=>r.workspaceId===ctx.workspaceId&&r.status==="FINAL"&&r.week>review.week)},
    {id:"inputs",label:"The review reflects the latest initiative records",missing:"Initiative records changed since this draft — update it to the latest records first",met:current.digest===review.input.digest},
    {id:"baseline",label:"The previous Final baseline is unchanged",missing:"The previous Final changed since this draft was prepared",met:(baseline?.id??null)===review.baselineReviewId},
    {id:"sections",label:"Every section is saved and reviewed; none needs re-check",missing:(()=>{const open=review.sections.filter(s=>s.needsRecheck||!(s.editedByMemberId||s.editedByUserId)).length;return `${open} of ${review.sections.length} ${review.sections.length===1?"section still needs":"sections still need"} review`;})(),met:review.sections.every(s=>!s.needsRecheck&&Boolean(s.editedByMemberId||s.editedByUserId))},
    {id:"available",label:"Every section in this review can be read with your access",met:review.sections.every(s=>available.has(s.initiativeId))&&review.sections.length===weeklySnapshots(review.input,baseline?.input??null).length},
  ];
}
/** Facts and the refreshed draft are one delivery transaction. Commentary is preserved. */
export function applyFactUpdatesAndRefresh(state:DeliveryState,source:PortfolioSource,ctx:WorkspaceAccess,reviewId:string,expectedReviewRevision:number,updates:RecordFactInput[],now:string):DeliveryState {
  draft(state,ctx,reviewId,expectedReviewRevision);
  let next=state;
  for(const update of updates) next=recordFact(next,source,ctx,update,now);
  return refreshReview(next,source,ctx,reviewId,expectedReviewRevision,now);
}
export function nextReviewWeek(week:string):{week:string;startsOn:string} {
  if(!weekValid(week)) fail("WEEK","Choose a valid ISO week.");
  const year=Number(week.slice(0,4)),number=Number(week.slice(6));
  const jan4=new Date(Date.UTC(year,0,4,12));
  jan4.setUTCDate(jan4.getUTCDate()-(jan4.getUTCDay()||7)+1+number*7);
  return {week:isoWeek(jan4.toISOString()),startsOn:jan4.toISOString().slice(0,10)};
}
export function finalizeReview(state:DeliveryState,source:PortfolioSource,ctx:WorkspaceAccess,id:string,revision:number,now:string):DeliveryState {
  assertMember(ctx,source); assertFinalizer(ctx); const review=draft(state,ctx,id,revision);
  if (state.reviews.some(r=>r.workspaceId===ctx.workspaceId && r.status === "FINAL" && r.week>review.week)) fail("OUT_OF_ORDER_FINAL","A later week is already finalized. Keep this historical draft for reference; record corrections in the current week's review.");
  const current=freezeInput(source,state,ctx.workspaceId,now); const baseline=latestBaseline(state,ctx.workspaceId,review.week);
  if (current.digest!==review.input.digest || (baseline?.id ?? null)!==review.baselineReviewId) fail("STALE_FINALIZE","Inputs or the previous finalized review changed. Refresh, review the affected PM sections, then finalize.");
  if (review.sections.some(s=>s.needsRecheck || (!s.editedByMemberId && !s.editedByUserId))) fail("SECTION_REVIEW_REQUIRED","Every PM section must be reviewed and saved before finalization.");
  if(!finalizationChecks(state,source,ctx,review,now,true).find(c=>c.id==="available")!.met) fail("SECTION_UNAVAILABLE","Some frozen sections are unavailable. Refresh the review before finalizing.");
  return replaceReview(state,{ ...review,status:"FINAL",revision:review.revision+1,finalizedAt:now,finalizedByMemberId:ctx.memberId,finalizedByUserId:ctx.actor.id,finalizedByLabel:ctx.actor.label });
}
export function applyAiDraft(state:DeliveryState,source:PortfolioSource,ctx:WorkspaceAccess,id:string,revision:number,ai:AiDraft,now:string):DeliveryState {
  assertMember(ctx,source); assertWriter(ctx); const review=draft(state,ctx,id,revision);
  const current=freezeInput(source,state,ctx.workspaceId,now);
  if (current.digest!==review.input.digest || ai.inputDigest!==review.input.digest) fail("STALE_AI","Inputs changed while the draft wording was prepared. Refresh before drafting again.");
  const sections=review.sections.map(section=>{ const block=ai.original.find(b=>b.initiativeId===section.initiativeId); if (!block) return section;
    if (!hasOrganizationAdminAuthority(ctx) && !ctx.isProductLead && ownerFor(state.facts,section.initiativeId)!==ctx.memberId) fail("SECTION_ACCESS","You can only draft wording for your assigned initiative sections.");
    return { ...section,updates:(section.editedByMemberId || section.editedByUserId) && section.updates ? section.updates : block.lines.map(l=>l.text).join("\n"),aiOriginal:block.lines,revision:section.revision+1,needsRecheck:true }; });
  return replaceReview(state,{ ...review,revision:review.revision+1,sections,aiDrafts:[...review.aiDrafts,ai] });
}

export function queueForInput(input:PortfolioInput,initiativeId:string){const snap=input.snapshots.find(s=>s.initiative.id===initiativeId);return projectQueue(snap?applyFindingStates(runReview(initiativeId,snap.claims),snap.findingStates):[],(input.findingDispositions??[]).filter(d=>d.initiativeId===initiativeId),input.queueFinalizations??[],input.asOf,snap?.findingStates??[]);}
export function weeklyDispositionCounts(input:PortfolioInput,baseline:PortfolioInput|null,initiativeId?:string){const rows=(input.findingDispositions??[]).filter(d=>(!initiativeId||d.initiativeId===initiativeId)&&Date.parse(d.at)>(baseline?Date.parse(baseline.asOf):-Infinity)&&Date.parse(d.at)<=Date.parse(input.asOf));return {deferred:rows.filter(r=>r.kind==="DEFERRED").length,dismissed:rows.filter(r=>r.kind==="DISMISSED").length};}
