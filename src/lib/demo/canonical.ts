import { createHash } from "node:crypto";
import { SEED_INITIATIVES } from "../data/fixtures/initiatives.ts";
import { SEED_SOURCES, SEED_EVIDENCE } from "../data/fixtures/evidence.ts";
import { SEED_CLAIMS, SEED_CLAIM_EVIDENCE } from "../data/fixtures/claims.ts";
import type { ActivityEntry, ClaimRecord, ClaimTrust, EvidenceRecord, Initiative, InitiativeSnapshot, InitiativeSource, MemoryClaim, FindingState } from "../domain/types.ts";
import type { DeliveryState, PortfolioSource, WorkspaceAccess, FactKind, FactValue } from "../delivery/types.ts";
import { createReview, editSection, finalizeReview, recordFact, factFor } from "../delivery/model.ts";
import { FIXTURE_ORIGIN_LABEL } from "./presentation.ts";

export const DEMO_ORGANIZATION_NAME="Prodwise Demo";
export const DEMO_CANONICAL_VERSION="prodwise-graduation-2026-09-v1";
export const DEMO_CUTOFF="2026-09-26T10:00:00.000Z";
export const DEMO_BASELINE_WEEK="2026-W38";
export const DEMO_REVIEW_WEEK="2026-W39";
export type DemoScoped<T>=T & {workspaceId:string};
export interface DemoProductStore {
  initiatives:DemoScoped<Initiative>[];
  activity:DemoScoped<ActivityEntry>[];
  evidence:DemoScoped<EvidenceRecord>[];
  sources:DemoScoped<InitiativeSource>[];
  claims:DemoScoped<ClaimRecord & ClaimTrust>[];
  claimEvidence:DemoScoped<{claimId:string;evidenceId:string;createdAt:string;locator:string|null;excerpt:string|null}>[];
  findingStates:DemoScoped<FindingState>[];
}
export interface DemoIdentity {workspaceId:string;organizationId:string;reviewerMemberId:string;reviewerUserId:string;asOf?:string;}
export function demoId(workspaceId:string,key:string):string {
  const hex=createHash("sha256").update(`prodwise-demo-only:${workspaceId}:${key}`).digest("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
/** Curated synthetic data only. This function has no persistence or provider access. */
export function canonicalDemoData(identity:DemoIdentity) {
  for (const value of [identity.workspaceId,identity.organizationId,identity.reviewerMemberId,identity.reviewerUserId]) if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error("Demo identity requires explicit UUIDs.");
  const asOf=identity.asOf ?? DEMO_CUTOFF;
  if (Number.isNaN(Date.parse(asOf)) || asOf<DEMO_CUTOFF) throw new Error("The canonical demo cutoff cannot precede its recorded scenario.");
  const {workspaceId,organizationId,reviewerMemberId,reviewerUserId}=identity;
  const id=(value:string)=>demoId(workspaceId,value);
  const scoped=<T extends object>(value:T):DemoScoped<T>=>({...value,workspaceId});
  const productStore:DemoProductStore={
    initiatives:SEED_INITIATIVES.map(value=>scoped({...value,id:id(value.id),description:`Synthetic demo scenario. ${value.description}`,overallState:"UNKNOWN",stateSummary:null,isDemo:true})),
    activity:[],
    sources:SEED_SOURCES.map(value=>scoped({...value,id:id(value.id),initiativeId:id(value.initiativeId),name:`Synthetic · ${value.name}`})),
    evidence:SEED_EVIDENCE.map(value=>scoped({...value,id:id(value.id),initiativeId:id(value.initiativeId),sourceId:value.sourceId?id(value.sourceId):null,sourceUrl:null,createdBy:reviewerUserId,contentSummary:`Synthetic evidence for the graduation walkthrough. ${value.contentSummary ?? ""}`})),
    claims:SEED_CLAIMS.map(value=>scoped({...value,id:id(value.id),initiativeId:id(value.initiativeId),supersededByClaimId:value.supersededByClaimId?id(value.supersededByClaimId):null,createdBy:reviewerUserId,origin:"LEGACY",verifiedAt:null,verifiedActorId:null,verifiedActorLabel:null,verificationBasis:null,verificationNote:null})),
    claimEvidence:SEED_CLAIM_EVIDENCE.map(value=>scoped({claimId:id(value.claimId),evidenceId:id(value.evidenceId),createdAt:"2026-09-06T00:00:00.000Z",locator:null,excerpt:null})),
    findingStates:[],
  };
  const snapshots:InitiativeSnapshot[]=productStore.initiatives.map(initiative=>({
    initiative,evidence:productStore.evidence.filter(e=>e.initiativeId===initiative.id),findingStates:[],
    claims:productStore.claims.filter(c=>c.initiativeId===initiative.id).map(c=>{
      const links=productStore.claimEvidence.filter(link=>link.claimId===c.id);
      const evidence=productStore.evidence.filter(e=>links.some(link=>link.evidenceId===e.id)).sort((a,b)=>Date.parse(b.capturedAt)-Date.parse(a.capturedAt));
      return {...c,evidence,anchors:links.map(link=>({evidenceId:link.evidenceId,locator:link.locator,excerpt:link.excerpt}))} satisfies MemoryClaim;
    }),
  }));
  const source:PortfolioSource={snapshots,members:[{id:reviewerMemberId,workspaceId,displayName:"Demo Reviewer",role:"ORG_OWNER",active:true,isProductLead:false}]};
  // IDs preserve storage foreign keys. This separate origin label explicitly records
  // fixture preparation and must not imply the real reviewer took these actions.
  const ctx:WorkspaceAccess={workspaceId,organizationId,memberId:reviewerMemberId,actor:{id:reviewerUserId,label:FIXTURE_ORIGIN_LABEL},platformRole:null,role:"ORG_OWNER",isProductLead:false};
  let state:DeliveryState={schema:1,facts:[],events:[],reviews:[]};
  function record(index:number,kind:FactKind,fields:Partial<FactValue>,at:string,note:string) {
    const initiativeId=snapshots[index]!.initiative.id;
    const old=state.facts.find(f=>f.initiativeId===initiativeId && f.kind===kind);
    state=recordFact(state,source,ctx,{initiativeId,kind,expectedRevision:old?.revision ?? 0,value:{date:null,text:null,memberId:null,extent:null,...fields},retract:false,basis:"DIRECT_KNOWLEDGE",note:`Synthetic demo fixture: ${note}`,evidenceId:null,locator:null},at);
    const event=state.events[state.events.length-1]!;
    event.id=id(`event:${index}:${kind}:${event.after.revision}`);
    event.after.id=id(`fact:${index}:${kind}`);
    event.after.preparedAsFixture=true;
  }
  const seedAt="2026-09-18T10:00:00.000Z";
  const scopes=["Phase 1 · Islamic merchant finance pilot","Pilot · same-day payout for eligible merchants","Phase 1 · merchant identity re-verification","Phase 1 · daily collections reporting pack"];
  snapshots.forEach((snapshot,index)=>{
    record(index,"SCOPE",{text:scopes[index]},seedAt,"Named scope confirmed for this scenario.");
    record(index,"OWNER",{memberId:reviewerMemberId},seedAt,"Reviewer owns the synthetic initiative section.");
    productStore.activity.push(scoped({id:id(`activity:scope:${index}`),initiativeId:snapshot.initiative.id,eventType:"INITIATIVE_CREATED",summary:"Synthetic initiative prepared for the reviewer walkthrough",occurredAt:seedAt,entityType:"INITIATIVE",entityId:snapshot.initiative.id,payload:{synthetic:true,canonicalVersion:DEMO_CANONICAL_VERSION},actorLabel:"Demo fixture preparation"}));
  });
  record(0,"DEV_STARTED",{date:"2026-09-14"},seedAt,"Development start recorded for the pilot.");
  record(0,"TARGET_LIVE",{date:"2026-10-01"},seedAt,"Original committed pilot target.");
  record(0,"BLOCKER",{text:"Daily repayment calculation needs a Finance decision: monthly installment divided by 27 or 30."},seedAt,"Explicit blocker note supplied with the synthetic scenario.");
  record(0,"NEXT_STEP",{text:"Confirm the daily repayment rule with the Finance owner before changing the affected implementation."},seedAt,"Recorded next step; no automated severity assessment.");
  record(1,"TARGET_LIVE",{date:"2026-09-24"},seedAt,"Pilot target recorded; Actual Live remains unknown.");
  record(1,"BLOCKER",{text:"Partner cut-off confirmation has not been recorded for the pilot."},seedAt,"Explicit follow-up note; absence does not establish a missed launch.");
  record(1,"NEXT_STEP",{text:"Request the pilot cut-off confirmation from the partner owner."},seedAt,"Recorded partner follow-up.");
  record(2,"NEXT_MILESTONE",{text:"Agree the pilot population"},seedAt,"Milestone date has not been confirmed.");
  record(2,"NEXT_STEP",{text:"Confirm the pilot population and record an agreed delivery target."},seedAt,"Schedule remains unknown.");
  record(3,"DEV_STARTED",{date:"2026-09-15"},seedAt,"Start recorded for the reporting scope.");
  record(3,"TARGET_LIVE",{date:"2026-10-15"},seedAt,"Current target recorded for the reporting scope.");
  record(3,"NEXT_STEP",{text:"Review the reporting definitions with the operations owner."},seedAt,"No transaction or commercial outcomes are recorded.");

  const baselineAt="2026-09-20T10:00:00.000Z";
  state=createReview(state,source,ctx,DEMO_BASELINE_WEEK,baselineAt);
  let baseline=state.reviews[state.reviews.length-1]!;baseline.id=id("review:2026-W38");
  for (const section of baseline.sections) {
    state=editSection(state,source,ctx,baseline.id,baseline.revision,section.initiativeId,section.revision,{
      headline:"Synthetic scenario · recorded scope and delivery plan",
      updates:"First finalized review in this demonstration. No previous finalized baseline.",
      attention:factFor(state.facts,section.initiativeId,"BLOCKER")?.value.text ?? "No blocker note recorded.",
      decisionNeeded:section.initiativeId===snapshots[0]!.initiative.id ? "Finance must confirm the recorded repayment divisor." : "No decision request recorded.",
      nextMilestone:section.nextMilestone || "Next milestone not recorded.",
      nextStep:section.nextStep || "Next step not recorded.",
    },baselineAt);
    baseline=state.reviews.find(r=>r.id===baseline.id)!;
  }
  state=finalizeReview(state,source,ctx,baseline.id,baseline.revision,baselineAt);
  state.reviews.find(review=>review.id===baseline.id)!.preparedAsFixture=true;
  const changeAt="2026-09-24T10:00:00.000Z";
  record(0,"TARGET_LIVE",{date:"2026-10-08"},changeAt,"Human-confirmed pilot target moved from 1 to 8 October while the calculation is reviewed.");
  record(0,"NEXT_MILESTONE",{text:"Finance calculation review",date:"2026-09-29"},changeAt,"The review meeting is planned; its outcome is unknown.");
  record(1,"NEXT_MILESTONE",{text:"Partner cut-off confirmation",date:"2026-09-28"},changeAt,"Confirmation planned; no outcome inferred.");
  record(3,"NEXT_MILESTONE",{text:"Reporting definition review",date:"2026-10-02"},changeAt,"Working session planned; no performance result inferred.");
  state=createReview(state,source,ctx,DEMO_REVIEW_WEEK,asOf);
  state.reviews[state.reviews.length-1]!.id=id("review:2026-W39");
  return {version:DEMO_CANONICAL_VERSION,organization:{id:organizationId,name:DEMO_ORGANIZATION_NAME},workspaceId,productStore,deliveryState:state,source,reviewer:{userId:reviewerUserId,memberId:reviewerMemberId,role:"ORG_OWNER" as const,platformRole:null},cutoff:asOf};
}

/** Fail closed before an operator replaces any demo records. Persistence is owned by the caller. */
export function assertDemoResetTarget(target:{organizationId:string;organizationName:string;workspaceId:string;reviewerPlatformRole:string|null;initiatives:{isDemo:boolean;workspaceId:string}[]},approved:{organizationId:string;workspaceId:string},options:{allowReviewerCreatedItems?:boolean}={}) {
  if(target.organizationId!==approved.organizationId || target.workspaceId!==approved.workspaceId || target.organizationName!==DEMO_ORGANIZATION_NAME) throw new Error("Reset is restricted to the explicitly registered Prodwise Demo organization and workspace.");
  if(target.reviewerPlatformRole!==null) throw new Error("The reviewer must never hold platform authority.");
  if(target.initiatives.some(i=>i.workspaceId!==target.workspaceId || (!i.isDemo && !options.allowReviewerCreatedItems))) throw new Error("Reset refused: the target contains non-demo or foreign workspace records.");
}
