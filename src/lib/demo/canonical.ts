import { createHash } from "node:crypto";
import { SEED_INITIATIVES } from "../data/fixtures/initiatives.ts";
import { SEED_SOURCES, SEED_EVIDENCE } from "../data/fixtures/evidence.ts";
import { SEED_CLAIMS, SEED_CLAIM_EVIDENCE } from "../data/fixtures/claims.ts";
import type { ActivityEntry, ClaimRecord, ClaimTrust, EvidenceRecord, Initiative, InitiativeSnapshot, InitiativeSource, MemoryClaim, FindingState } from "../domain/types.ts";
import type { DeliveryState, PortfolioSource, WorkspaceAccess, FactKind, FactValue } from "../delivery/types.ts";
import { createReview, editSection, finalizeReview, recordFact, factFor, refreshReview } from "../delivery/model.ts";
import { demoProjectMetrics } from "./metric-fixtures.ts";
import { FIXTURE_ORIGIN_LABEL } from "./presentation.ts";

export const DEMO_ORGANIZATION_NAME="Prodwise Demo";
export const DEMO_CANONICAL_VERSION="prodwise-graduation-2026-09-v1";
export const DEMO_ENRICHED_VERSION="prodwise-graduation-2026-09-v2";
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

/** Additive second scenario. V1 remains the historical factory; no existing fact or Final is rewritten. */
export function canonicalDemoDataV2(identity:DemoIdentity) {
  const demo=canonicalDemoData(identity),{workspaceId,reviewerMemberId,reviewerUserId}=identity;
  const id=(key:string)=>demoId(workspaceId,`v2:${key}`),at="2026-09-22T10:00:00.000Z";
  const scoped=<T extends object>(value:T):DemoScoped<T>=>({...value,workspaceId});
  const specs=[
    {slug:"tap-to-pay-merchant-onboarding",name:"Tap-to-Pay Merchant Onboarding",businessLine:"ACCEPTANCE",stage:"LIVE_VALIDATION",scope:"Full rollout · Tap-to-Pay merchant onboarding",start:"2026-06-01",target:"2026-09-10",actual:"2026-09-10",milestone:"30-day live review",milestoneDate:"2026-10-10",next:"Review the recorded onboarding observations with Operations."},
    {slug:"merchant-pricing-update",name:"Merchant Pricing Update",businessLine:"FS",stage:"VALIDATION",scope:"Phase 1 · merchant service fee update",start:"2026-08-03",target:"2026-10-12",actual:null,milestone:"UAT sign-off",milestoneDate:"2026-10-01",next:"Confirm the fee value with Finance before UAT sign-off."},
    {slug:"agent-cash-in-network",name:"Agent Cash-In Network",businessLine:"DIGITAL_TRANSFORMATION",stage:"DISCOVERY",scope:"Discovery · agent cash-in pilot proposal",start:null,target:null,actual:null,milestone:null,milestoneDate:null,next:"Assign a responsible PM and confirm the pilot proposal."},
    {slug:"installment-early-settlement",name:"Installment Early Settlement",businessLine:"MF",stage:"DELIVERY",scope:"Phase 1 · installment early settlement",start:"2026-09-01",target:"2026-10-20",actual:null,milestone:"QA sign-off",milestoneDate:"2026-10-06",next:"Review the settlement calculations with QA."},
  ] as const;
  for(const spec of specs) {
    const initiative=scoped({id:id(spec.slug),slug:spec.slug,name:spec.name,businessLine:spec.businessLine,stage:spec.stage,description:"Synthetic demo scenario. Fictional records prepared for the graduation walkthrough; no live business results are represented.",knownReferences:null,overallState:"UNKNOWN" as const,stateSummary:null,isDemo:true,createdAt:at,updatedAt:at});
    demo.productStore.initiatives.push(initiative);
    const source=scoped({id:id(`${spec.slug}:source`),initiativeId:initiative.id,name:`Synthetic · ${spec.name} scenario notes`,sourceType:"DOCUMENT" as const,connectionState:"MANUAL" as const,lastSyncedAt:null,createdAt:at,updatedAt:at});
    demo.productStore.sources.push(source);
    const evidence=scoped({id:id(`${spec.slug}:evidence`),initiativeId:initiative.id,sourceId:source.id,title:`Synthetic ${spec.name} current-scope record`,sourceType:"DOCUMENT" as const,sourceReference:`DEMO-${spec.slug}`,sourceUrl:null,contentSummary:"Synthetic evidence for the graduation walkthrough. Scenario facts are fixture preparation; human verification history is not recorded.",boundary:"CURRENT_SCOPE" as const,occurredAt:at,capturedAt:at,lastVerifiedAt:null,createdBy:reviewerUserId,createdAt:at,updatedAt:at});
    demo.productStore.evidence.push(evidence);
    const entries=spec.slug==="tap-to-pay-merchant-onboarding"?[
      {subject:"Onboarding scope",attribute:"Eligible device",value:"NFC-capable supported Android devices"},
      {subject:"Merchant activation",attribute:"Required check",value:"Identity review before activation"},
      {subject:"Transaction receipt",attribute:"Delivery method",value:"Digital receipt within the onboarding scope"},
    ]:spec.slug==="merchant-pricing-update"?[
      {subject:"Merchant service fee",attribute:"Rate",value:"1.50%"},{subject:"Merchant service fee",attribute:"Rate",value:"1.75%"},
    ]:spec.slug==="agent-cash-in-network"?[
      {subject:"Agent cash-in pilot",attribute:"Pilot region",value:"Proposed single-region pilot; confirmation pending"},{subject:"Agent cash-in pilot",attribute:"Daily limit",value:"Proposed daily limit; value not confirmed"},
    ]:[
      {subject:"Early settlement",attribute:"Quote validity",value:"Settlement quote valid for the recorded business day"},{subject:"Early settlement",attribute:"Required confirmation",value:"Customer confirmation before posting settlement"},
    ];
    const claims:MemoryClaim[]=entries.map((entry,index)=>{
      const claim=scoped({id:id(`${spec.slug}:claim:${index}`),initiativeId:initiative.id,type:"REQUIREMENT" as const,status:spec.slug==="agent-cash-in-network"?"UNVERIFIED" as const:"ACTIVE" as const,...entry,domain:spec.slug==="merchant-pricing-update"?"FINANCE" as const:"PRODUCT" as const,phase:spec.scope,confidence:"MEDIUM" as const,supersededByClaimId:null,createdBy:reviewerUserId,createdAt:at,updatedAt:at,origin:"LEGACY" as const,verifiedAt:null,verifiedActorId:null,verifiedActorLabel:null,verificationBasis:null,verificationNote:null});
      // Pricing has two separately recorded current-scope notes; neither is a chosen resolution.
      let linked=evidence;
      if(spec.slug==="merchant-pricing-update"&&index===1){linked={...evidence,id:id(`${spec.slug}:evidence:alternate`),title:"Synthetic Finance fee review note",sourceReference:"DEMO-PRICING-ALTERNATE"};demo.productStore.evidence.push(linked);}
      demo.productStore.claims.push(claim);
      const link=scoped({claimId:claim.id,evidenceId:linked.id,createdAt:at,locator:`Scenario section ${index+1}`,excerpt:entry.value});demo.productStore.claimEvidence.push(link);
      return {...claim,evidence:[linked],anchors:[{evidenceId:linked.id,locator:link.locator,excerpt:link.excerpt}]};
    });
    demo.source.snapshots.push({initiative,evidence:demo.productStore.evidence.filter(e=>e.initiativeId===initiative.id),claims,findingStates:[]});
    demo.productStore.activity.push(scoped({id:id(`${spec.slug}:created`),initiativeId:initiative.id,eventType:"INITIATIVE_CREATED",summary:"Synthetic initiative added to the registered Demo after the W38 cutoff",occurredAt:at,entityType:"INITIATIVE",entityId:initiative.id,payload:{synthetic:true,canonicalVersion:DEMO_ENRICHED_VERSION},actorLabel:FIXTURE_ORIGIN_LABEL}));
  }
  const ctx:WorkspaceAccess={workspaceId,organizationId:identity.organizationId,memberId:reviewerMemberId,actor:{id:reviewerUserId,label:FIXTURE_ORIGIN_LABEL},platformRole:null,role:"ORG_OWNER",isProductLead:false};
  function record(slug:string,kind:FactKind,value:Partial<FactValue>,note:string) {
    const initiativeId=id(slug);
    demo.deliveryState=recordFact(demo.deliveryState,demo.source,ctx,{initiativeId,kind,expectedRevision:0,value:{date:null,text:null,memberId:null,extent:null,...value},retract:false,basis:"DIRECT_KNOWLEDGE",note:`Synthetic demo fixture: ${note} Recorded on 22 September; earlier effective dates are late-recorded provenance.`,evidenceId:null,locator:null},at);
    const event=demo.deliveryState.events.at(-1)!;event.id=id(`${slug}:event:${kind}`);event.after.id=id(`${slug}:fact:${kind}`);event.after.preparedAsFixture=true;
  }
  for(const spec of specs) {
    record(spec.slug,"SCOPE",{text:spec.scope},"Named fictional delivery scope prepared.");
    if(spec.slug!=="agent-cash-in-network")record(spec.slug,"OWNER",{memberId:reviewerMemberId},"Reviewer section responsibility prepared for the walkthrough.");
    if(spec.start)record(spec.slug,"DEV_STARTED",{date:spec.start},"Earlier actual development start supplied by the synthetic scenario.");
    if(spec.target)record(spec.slug,"TARGET_LIVE",{date:spec.target},"Scenario target; not an inferred date.");
    if(spec.actual)record(spec.slug,"ACTUAL_LIVE",{date:spec.actual,extent:"FULL",text:spec.scope},"Recorded full named scope, distinct from its planned target.");
    if(spec.milestone)record(spec.slug,"NEXT_MILESTONE",{text:spec.milestone,date:spec.milestoneDate},"Next checkpoint planned; outcome unknown.");
    record(spec.slug,"NEXT_STEP",{text:spec.next},"Recorded next action; no computed health assessment.");
  }
  const draft=demo.deliveryState.reviews.find(r=>r.week===DEMO_REVIEW_WEEK)!;
  demo.deliveryState=refreshReview(demo.deliveryState,demo.source,ctx,draft.id,draft.revision,demo.cutoff);
  const metrics=demoProjectMetrics(workspaceId,id("tap-to-pay-merchant-onboarding"),id("tap-to-pay-merchant-onboarding:evidence"),id);
  return {...demo,version:DEMO_ENRICHED_VERSION,metrics};
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
