import test from "node:test";
import assert from "node:assert/strict";
import {canonicalDemoDataV2} from "../demo/canonical.ts";
import {displayedCommentary,weeklyChangeSentence} from "./weekly-copy.ts";
const identity={workspaceId:"d0000000-0000-4000-8000-000000000001",organizationId:"d0000000-0000-4000-8000-000000000002",reviewerMemberId:"d0000000-0000-4000-8000-000000000003",reviewerUserId:"d0000000-0000-4000-8000-000000000004"};
test("known template fragments use readable stage and typed dates without mutating Draft or immutable Final",()=>{
 const data=canonicalDemoDataV2(identity),draft=data.deliveryState.reviews.find(r=>r.status==="DRAFT")!,final=data.deliveryState.reviews.find(r=>r.status==="FINAL")!;
 const before=JSON.stringify(data.deliveryState),id=draft.input.snapshots.find(s=>s.initiative.slug==="merchant-flex-finance")!.initiative.id,section=draft.sections.find(s=>s.initiativeId===id)!;
 const text=displayedCommentary(section,draft.input,final.input);
 assert.match(text.headline,/^Delivery ·/);assert.match(text.updates,/1 Oct 2026 → 8 Oct 2026/);assert.match(text.nextMilestone,/29 Sept? 2026/);
 assert.doesNotMatch(text.updates,/2026-10-0[18]/);assert.doesNotMatch(text.nextMilestone,/2026-09-29/);
 final.sections.forEach(s=>displayedCommentary(s,final.input,null));assert.equal(JSON.stringify(data.deliveryState),before);
});
test("arbitrary human notes, dates, Knowledge values and mixed narrative remain unchanged",()=>{
 const d=canonicalDemoDataV2(identity),r=d.deliveryState.reviews.find(r=>r.status==="DRAFT")!,baseline=d.deliveryState.reviews.find(r=>r.status==="FINAL")!.input;
 const section={...r.sections[0]!,headline:"DELIVERY team approved wording 2026-10-01",updates:"We discussed 2026-10-01; keep this exact sentence.",nextMilestone:"Human date 2026-09-29 in a quote"};
 const result=displayedCommentary(section,r.input,baseline);assert.equal(result.headline,section.headline);assert.equal(result.updates,section.updates);assert.equal(result.nextMilestone,section.nextMilestone);
 const knowledge={id:"claim:fictional",initiativeId:section.initiativeId,kind:"KNOWLEDGE" as const,label:"Knowledge value: 'Contract states 2026-10-01'",eventIds:[],days:null,lateRecorded:false};assert.equal(weeklyChangeSentence(knowledge,r.input,baseline),knowledge.label);
});
