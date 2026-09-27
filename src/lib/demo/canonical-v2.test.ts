import test from "node:test";
import assert from "node:assert/strict";
import {canonicalDemoData,canonicalDemoDataV2,DEMO_ENRICHED_VERSION,DEMO_CUTOFF} from "./canonical.ts";
import {canonical,changesSince,editSection,factFor,refreshReview} from "../delivery/model.ts";
import {runReview} from "../review/engine.ts";
const identity={workspaceId:"d0000000-0000-4000-8000-000000000001",organizationId:"d0000000-0000-4000-8000-000000000002",reviewerMemberId:"d0000000-0000-4000-8000-000000000003",reviewerUserId:"d0000000-0000-4000-8000-000000000004"};
test("additive Demo preserves byte-identical W38 Final, original product rows and every fact/event prefix",()=>{
  const v1=canonicalDemoData(identity),v2=canonicalDemoDataV2(identity);
  assert.equal(v2.version,DEMO_ENRICHED_VERSION);assert.equal(v2.source.snapshots.length,8);
  assert.equal(JSON.stringify(v2.deliveryState.reviews.find(r=>r.status==="FINAL")),JSON.stringify(v1.deliveryState.reviews.find(r=>r.status==="FINAL")));
  for(const [key,rows] of Object.entries(v1.productStore))assert.equal(canonical(v2.productStore[key as keyof typeof v2.productStore].slice(0,rows.length)),canonical(rows));
  assert.equal(canonical(v2.deliveryState.facts.slice(0,v1.deliveryState.facts.length)),canonical(v1.deliveryState.facts));
  assert.equal(canonical(v2.deliveryState.events.slice(0,v1.deliveryState.events.length)),canonical(v1.deliveryState.events));
  assert.equal(canonical(v2),canonical(canonicalDemoDataV2(identity)));
});
test("eight records retain honest targets, actuals, two differences, two blockers and unassigned discovery",()=>{
  const d=canonicalDemoDataV2(identity),{facts,reviews}=d.deliveryState;
  assert.equal(new Set(d.source.snapshots.map(s=>s.initiative.businessLine)).size,5);
  assert.equal(new Set(d.source.snapshots.map(s=>s.initiative.stage)).size,7);
  assert.equal(d.source.snapshots.flatMap(s=>runReview(s.initiative.id,s.claims)).filter(f=>f.type==="CONFLICT").length,2);
  assert.equal(facts.filter(f=>f.kind==="BLOCKER"&&f.state==="SET").length,2);
  assert.equal(d.source.snapshots.filter(s=>!factFor(facts,s.initiative.id,"TARGET_LIVE")).length,2);
  const discovery=d.source.snapshots.find(s=>s.initiative.slug==="agent-cash-in-network")!;
  assert.equal(factFor(facts,discovery.initiative.id,"OWNER"),undefined);assert.ok(discovery.claims.every(c=>c.status==="UNVERIFIED"&&c.verifiedAt===null));
  const live=d.source.snapshots.find(s=>s.initiative.slug==="tap-to-pay-merchant-onboarding")!;
  assert.equal(factFor(facts,live.initiative.id,"ACTUAL_LIVE")?.value.extent,"FULL");
  const draft=reviews.find(r=>r.status==="DRAFT")!,final=reviews.find(r=>r.status==="FINAL")!;
  assert.equal(draft.sections.length,8);assert.equal(final.sections.length,4);
  assert.equal(changesSince(draft.input,final.input).filter(c=>c.id.startsWith("scope:")).length,4);
  assert.equal(changesSince(draft.input,final.input).find(c=>c.kind==="TARGET_LIVE")?.days,7);
  assert.ok(facts.filter(f=>!final.input.snapshots.some(s=>s.initiative.id===f.initiativeId)).every(f=>f.updatedAt==="2026-09-22T10:00:00.000Z"&&f.note.includes("late-recorded")));
});
test("Demo metric observations are scoped records with null-preserving denominators and target context",()=>{
  const d=canonicalDemoDataV2(identity);assert.equal(d.metrics.length,2);
  for(const m of d.metrics){assert.equal(m.workspaceId,identity.workspaceId);assert.equal(m.origin,"SYNTHETIC_DEMO");assert.ok(d.source.snapshots.some(s=>s.initiative.id===m.initiativeId));assert.equal(m.observations.length,2);assert.ok(m.observations.every(o=>o.origin==="SYNTHETIC_DEMO"&&o.sourceEvidenceId===m.sourceEvidenceId));}
  assert.equal(d.metrics[0]!.targetValue,3);assert.equal(d.metrics[0]!.targetApprovedAt,"2026-08-28T10:00:00.000Z");
  assert.equal(d.metrics[1]!.targetValue,null);assert.equal(d.metrics[1]!.observations[1]!.value,null);assert.match(d.metrics[1]!.observations[1]!.note,/27 September/);
});
test("an additive refresh preserves real W39 commentary and marks only materially changed sections",()=>{
  const v1=canonicalDemoData(identity),v2=canonicalDemoDataV2(identity),draft=v1.deliveryState.reviews.find(r=>r.status==="DRAFT")!;
  const ctx={workspaceId:identity.workspaceId,organizationId:identity.organizationId,memberId:identity.reviewerMemberId,actor:{id:identity.reviewerUserId,label:"Demo Reviewer"},role:"ORG_OWNER" as const,platformRole:null,isProductLead:false};
  const s=draft.sections[0]!;let state=editSection(v1.deliveryState,v1.source,ctx,draft.id,draft.revision,s.initiativeId,s.revision,{headline:"Actual reviewer notes",updates:"Keep my wording",attention:s.attention,decisionNeeded:s.decisionNeeded,nextMilestone:s.nextMilestone,nextStep:s.nextStep},DEMO_CUTOFF);
  state={...state,facts:v2.deliveryState.facts,events:v2.deliveryState.events};const edited=state.reviews.find(r=>r.id===draft.id)!;
  state=refreshReview(state,v2.source,ctx,edited.id,edited.revision,DEMO_CUTOFF);
  const fresh=state.reviews.find(r=>r.id===draft.id)!;assert.equal(fresh.sections[0]!.updates,"Keep my wording");assert.equal(fresh.sections[0]!.needsRecheck,false);assert.equal(fresh.sections.length,8);
});
