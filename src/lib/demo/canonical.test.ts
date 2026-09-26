import test from "node:test";
import assert from "node:assert/strict";
import { canonicalDemoData,assertDemoResetTarget,DEMO_ORGANIZATION_NAME,DEMO_CUTOFF } from "./canonical.ts";
import { canonical,changesSince,factFor,recordFact } from "../delivery/model.ts";
import { safeUserLabel,FIXTURE_ORIGIN_LABEL } from "./presentation.ts";
import type { WorkspaceAccess } from "../delivery/types.ts";
import { runReview } from "../review/engine.ts";
import { portfolioAnalysis } from "../../app/analysis/model.ts";
const identity={workspaceId:"d0000000-0000-4000-8000-000000000001",organizationId:"d0000000-0000-4000-8000-000000000002",reviewerMemberId:"d0000000-0000-4000-8000-000000000003",reviewerUserId:"d0000000-0000-4000-8000-000000000004"};

test("canonical demo is repeatable, fully scoped and never grants platform authority",()=>{
  const first=canonicalDemoData(identity),second=canonicalDemoData(identity);
  assert.equal(canonical(first),canonical(second));
  assert.equal(first.reviewer.platformRole,null);assert.equal(first.reviewer.role,"ORG_OWNER");
  for(const collection of Object.values(first.productStore)) for(const row of collection) assert.equal(row.workspaceId,identity.workspaceId);
  assert.ok(first.productStore.initiatives.every(i=>i.isDemo && i.overallState==="UNKNOWN" && i.stateSummary===null));
  assert.ok(first.productStore.evidence.every(e=>e.sourceUrl===null && e.contentSummary?.startsWith("Synthetic evidence")));
  const other=canonicalDemoData({...identity,workspaceId:"d0000000-0000-4000-8000-000000000009"});
  assert.ok(first.productStore.initiatives.every(i=>!other.productStore.initiatives.some(o=>o.id===i.id)));
});

test("golden demo retains the 27 versus 30 mismatch and explicit supersession history",()=>{
  const demo=canonicalDemoData(identity);const snap=demo.source.snapshots.find(s=>s.initiative.slug==="merchant-flex-finance")!;
  const findings=runReview(snap.initiative.id,snap.claims);
  assert.equal(findings.filter(f=>f.type==="CONFLICT").length,1);
  assert.equal(findings.filter(f=>f.type==="SUPERSEDED").length,1);
  const values=findings.find(f=>f.type==="CONFLICT")!.claims.map(c=>c.value).join(" ");
  assert.match(values,/27/);assert.match(values,/30/);
  for(const link of demo.productStore.claimEvidence) {assert.ok(demo.productStore.claims.some(c=>c.id===link.claimId));assert.ok(demo.productStore.evidence.some(e=>e.id===link.evidenceId));}
});

test("fixture attribution is explicit and a real reviewer edit does not inherit it",()=>{
  const demo=canonicalDemoData(identity);
  assert.ok(demo.deliveryState.facts.every(f=>f.preparedAsFixture && safeUserLabel(f)===FIXTURE_ORIGIN_LABEL));
  assert.ok(demo.deliveryState.events.every(e=>e.actor.label===FIXTURE_ORIGIN_LABEL && e.after.preparedAsFixture));
  const baseline=demo.deliveryState.reviews.find(r=>r.status==="FINAL")!;
  assert.equal(baseline.preparedAsFixture,true);assert.equal(baseline.finalizedByLabel,FIXTURE_ORIGIN_LABEL);
  assert.equal(demo.deliveryState.reviews.find(r=>r.status==="DRAFT")!.preparedAsFixture,undefined);
  const frozen=canonical(baseline),fact=demo.deliveryState.facts.find(f=>f.kind==="TARGET_LIVE")!;
  const ctx:WorkspaceAccess={workspaceId:identity.workspaceId,organizationId:identity.organizationId,memberId:identity.reviewerMemberId,actor:{id:identity.reviewerUserId,label:"Demo Reviewer"},role:"ORG_OWNER",platformRole:null,isProductLead:false};
  const edited=recordFact(demo.deliveryState,demo.source,ctx,{initiativeId:fact.initiativeId,kind:fact.kind,expectedRevision:fact.revision,value:{...fact.value,date:"2026-10-09"},retract:false,basis:"DIRECT_KNOWLEDGE",note:"Reviewer changed the synthetic pilot target during the walkthrough.",evidenceId:null,locator:null},DEMO_CUTOFF);
  const actual=edited.facts.find(f=>f.id===fact.id)!;
  assert.equal(actual.preparedAsFixture,undefined);assert.equal(safeUserLabel(actual),"Demo Reviewer");
  assert.equal(edited.events.at(-1)!.before!.preparedAsFixture,true);
  assert.equal(canonical(edited.reviews.find(r=>r.id===baseline.id)),frozen);
  assert.equal(safeUserLabel({preparedAsFixture:true,confirmedByLabel:"Demo Reviewer"}),FIXTURE_ORIGIN_LABEL);
  assert.equal(safeUserLabel({confirmedByLabel:null}),"Confirmation not recorded");
});

test("canonical scenario and attention remain fixed when the reset runs on a later real date",t=>{
  const before=canonicalDemoData(identity);
  t.mock.method(Date,"now",()=>Date.parse("2027-05-14T10:00:00Z"));
  const later=canonicalDemoData(identity);
  assert.equal(canonical(before),canonical(later));
  assert.equal(later.cutoff,DEMO_CUTOFF);
  assert.deepEqual(portfolioAnalysis(before.source,before.deliveryState,identity.workspaceId,before.cutoff),portfolioAnalysis(later.source,later.deliveryState,identity.workspaceId,later.cutoff));
});

test("canonical weekly baseline freezes Oct 1 and current draft records Oct 8 +7 days",()=>{
  const {deliveryState,source}=canonicalDemoData(identity);
  const baseline=deliveryState.reviews.find(r=>r.week==="2026-W38")!,current=deliveryState.reviews.find(r=>r.week==="2026-W39")!;
  assert.equal(baseline.status,"FINAL");assert.equal(current.status,"DRAFT");assert.equal(current.baselineReviewId,baseline.id);
  const id=source.snapshots[0]!.initiative.id;
  assert.equal(factFor(baseline.input.facts,id,"TARGET_LIVE")?.value.date,"2026-10-01");
  assert.equal(factFor(current.input.facts,id,"TARGET_LIVE")?.value.date,"2026-10-08");
  const change=changesSince(current.input,baseline.input).find(c=>c.initiativeId===id && c.kind==="TARGET_LIVE")!;
  assert.equal(change.days,7);assert.equal(change.eventIds.length,1);
  assert.equal(current.aiDrafts.length,0);assert.ok(current.sections.every(s=>!s.editedAt));
  const unknownCount=source.snapshots.reduce((sum,s)=>sum+["DEV_STARTED","TARGET_LIVE","ACTUAL_LIVE"].filter(kind=>!factFor(current.input.facts,s.initiative.id,kind as "DEV_STARTED"|"TARGET_LIVE"|"ACTUAL_LIVE")).length,0);
  assert.equal(unknownCount,7);
});

test("demo reset refuses real organizations, mixed records and a platform reviewer",()=>{
  const approved={organizationId:identity.organizationId,workspaceId:identity.workspaceId};
  const target={...approved,organizationName:DEMO_ORGANIZATION_NAME,reviewerPlatformRole:null,initiatives:[{isDemo:true,workspaceId:identity.workspaceId}]};
  assert.doesNotThrow(()=>assertDemoResetTarget(target,approved));
  assert.throws(()=>assertDemoResetTarget({...target,organizationName:"AMAN"},approved));
  assert.throws(()=>assertDemoResetTarget({...target,reviewerPlatformRole:"PLATFORM_OWNER"},approved));
  assert.throws(()=>assertDemoResetTarget({...target,initiatives:[{isDemo:false,workspaceId:identity.workspaceId}]},approved));
  assert.throws(()=>assertDemoResetTarget({...target,initiatives:[{isDemo:true,workspaceId:"foreign"}]},approved));
  assert.doesNotThrow(()=>assertDemoResetTarget({...target,initiatives:[{isDemo:false,workspaceId:identity.workspaceId}]},approved,{allowReviewerCreatedItems:true}));
  assert.throws(()=>assertDemoResetTarget({...target,initiatives:[{isDemo:false,workspaceId:"foreign"}]},approved,{allowReviewerCreatedItems:true}));
});

test("portfolio analysis counts records without turning unknown dates into zero or missed launches",()=>{
  const demo=canonicalDemoData(identity);const summary=portfolioAnalysis(demo.source,demo.deliveryState,identity.workspaceId,DEMO_CUTOFF);
  assert.equal(summary.total,4);assert.equal(summary.upcoming,2);assert.equal(summary.unknownTargets,1);assert.equal(summary.pastTarget,1);
  assert.equal(summary.targetMovements,1);assert.equal(summary.withDecisions,1);assert.equal(summary.withBlockers,2);
  assert.equal(summary.stages.reduce((sum,s)=>sum+s.count,0),4);
  assert.equal(summary.rows[2]!.targetDate,null);assert.equal(summary.rows[2]!.targetNeedsConfirmation,false);
  assert.equal(summary.rows[1]!.actualDate,null);assert.equal(summary.rows[1]!.targetNeedsConfirmation,true);
});

test("analysis excludes foreign workspace events and preserves overlapping attention categories",()=>{
  const demo=canonicalDemoData(identity);const state=structuredClone(demo.deliveryState);
  const movement=state.events.find(e=>e.before?.kind==="TARGET_LIVE")!;
  state.events.push({...movement,id:"foreign-event",workspaceId:"foreign"});
  state.events.push({...movement,id:"future-event",occurredAt:"2026-09-27T10:00:00.000Z"});
  state.events.push({...movement,id:"old-event",occurredAt:"2026-08-01T10:00:00.000Z"});
  assert.equal(portfolioAnalysis(demo.source,state,identity.workspaceId,DEMO_CUTOFF).targetMovements,1);
  const empty=portfolioAnalysis({snapshots:[],members:[]},state,identity.workspaceId,DEMO_CUTOFF);
  assert.equal(empty.total,0);assert.equal(empty.targetMovements,0);assert.equal(empty.upcoming,0);
});
