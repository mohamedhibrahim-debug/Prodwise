import test from "node:test";
import assert from "node:assert/strict";
import {planDemoEnrichment,renderDemoEnrichmentSql} from "../../../scripts/demo/enrich-demo.mjs";
import {canonicalDemoData,DEMO_CANONICAL_VERSION,DEMO_CUTOFF} from "./canonical.ts";
import {editSection} from "../delivery/model.ts";
const identity={workspaceId:"d0000000-0000-4000-8000-000000000001",organizationId:"d0000000-0000-4000-8000-000000000002",reviewerMemberId:"d0000000-0000-4000-8000-000000000003",reviewerUserId:"d0000000-0000-4000-8000-000000000004"};
function input(){const d=canonicalDemoData(identity);return{identity,registration:{workspaceId:identity.workspaceId,organizationId:identity.organizationId,canonicalVersion:DEMO_CANONICAL_VERSION,scenarioAt:DEMO_CUTOFF},productStore:d.productStore,deliveryState:d.deliveryState};}
test("enrichment plans only append four records, preserve edited Draft and retain exact historical Final",()=>{
 const i=input(),source=canonicalDemoData(identity).source,draft=i.deliveryState.reviews[1]!,section=draft.sections[0]!;
 i.deliveryState=editSection(i.deliveryState,source,{workspaceId:identity.workspaceId,organizationId:identity.organizationId,memberId:identity.reviewerMemberId,actor:{id:identity.reviewerUserId,label:"Reviewer"},platformRole:null,role:"ORG_OWNER",isProductLead:false},draft.id,draft.revision,section.initiativeId,section.revision,{headline:"Human notes",updates:"Preserve this commentary",attention:section.attention,decisionNeeded:section.decisionNeeded,nextMilestone:section.nextMilestone,nextStep:section.nextStep},DEMO_CUTOFF);
 const p=planDemoEnrichment(i);assert.equal(p.additions.initiatives.length,4);assert.equal(p.nextDraft.sections.length,8);assert.equal(p.nextDraft.sections[0]!.updates,"Preserve this commentary");assert.equal(JSON.stringify(p.originalFinal),JSON.stringify(i.deliveryState.reviews[0]));assert.equal(p.metrics.length,2);
});
test("operator refuses foreign/unregistered scope, business/history drift and a finalized W39",()=>{
 let i=input();i.registration.organizationId="foreign";assert.throws(()=>planDemoEnrichment(i),/registered/);
 i=input();i.productStore.claims[0]!.value="Changed by reviewer";assert.throws(()=>planDemoEnrichment(i),/business records changed/);
 i=input();i.deliveryState.facts[0]!.note="Changed";assert.throws(()=>planDemoEnrichment(i),/facts\/history changed/);
 i=input();i.deliveryState.reviews[0]!.finalizedByLabel="Changed";assert.throws(()=>planDemoEnrichment(i),/W38 Final differs/);
 i=input();i.deliveryState.reviews[1]!.status="FINAL";assert.throws(()=>planDemoEnrichment(i),/open Draft/);
});
test("reviewable SQL has scoped locks, exact preserved-row guards, Draft CAS and no deletion or Final update",()=>{
 const p=planDemoEnrichment(input()),sql=renderDemoEnrichmentSql(p,"d0000000-0000-4000-8000-000000000009");
 assert.ok(!/\b(delete|truncate|drop|disable\s+trigger)\b/i.test(sql));assert.ok(!sql.includes("lock table"));assert.match(sql,/DEMO_CLAIMS_DRIFT/);assert.match(sql,/HISTORICAL_FINAL_CHANGED/);assert.match(sql,/DRAFT_CHANGED/);assert.match(sql,/set revision=\d+,data=.*status='DRAFT'/);assert.match(sql,/DEMO_ADDITIVE_ENRICHMENT/);assert.match(sql,/metric_observations/);assert.ok(!sql.includes("update public.delivery_facts"));
});
