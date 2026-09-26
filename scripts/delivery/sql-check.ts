import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { applyAiDraft, createReview, editSection, finalizeReview, recordFact, refreshReview, type RecordFactInput } from "../../src/lib/delivery/model.ts";
import { randomUUID } from "node:crypto";
import type { DeliveryState, PortfolioSource, WorkspaceAccess } from "../../src/lib/delivery/types.ts";
const tool=join(process.env.LOCALAPPDATA!,"ProdwiseTools","PostgreSQL","16","bin","psql.exe");
const workspace="10000000-0000-4000-8000-000000000001"; const member="30000000-0000-4000-8000-000000000001";
const ctx:WorkspaceAccess={workspaceId:workspace,memberId:member,actor:{id:"20000000-0000-4000-8000-000000000001",label:"Delivery test Admin"},role:"Admin",isProductLead:false};
const now=new Date().toISOString();
function sql(query:string,expectFailure=false):string {const result=spawnSync(tool,["-X","-h","127.0.0.1","-p","55433","-U","postgres","-d","track_c_test","-v","ON_ERROR_STOP=1","-t","-A","-q"],{input:query,encoding:"utf8"}); if(expectFailure){assert.notEqual(result.status,0);return result.stderr;} if(result.status!==0)throw new Error(result.stderr || String(result.error));return result.stdout.trim();}
function literal(value:unknown):string{return `'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;}
function camel(value:unknown):unknown {if(Array.isArray(value))return value.map(camel);if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([key,val])=>[key.replace(/_([a-z])/g,(_,c:string)=>c.toUpperCase()),camel(val)]));return value;}
function read(){const raw=JSON.parse(sql(`set role service_role; select public.delivery_read_workspace('${workspace}','${member}');`)) as {source:unknown;state:DeliveryState};return {...raw,source:camel(raw.source) as PortfolioSource,rawSource:raw.source};}
function commit(before:ReturnType<typeof read>,next:DeliveryState,memberId=member){return sql(`set role service_role; select public.delivery_commit_workspace('${workspace}','${memberId}',${literal(before.rawSource)},${literal(before.state)},${literal(next)});`);}
function refused(before:ReturnType<typeof read>,next:DeliveryState,pattern:RegExp,memberId=member){assert.match(sql(`set role service_role; select public.delivery_commit_workspace('${workspace}','${memberId}',${literal(before.rawSource)},${literal(before.state)},${literal(next)});`,true),pattern);}
assert.equal(sql("select current_database();"),"track_c_test");
sql("truncate table public.weekly_reviews,public.delivery_facts; delete from public.activity_log where event_type='DELIVERY_FACT_RECORDED';");
let current=read(); assert.equal(current.source.snapshots.length,4); for(const snap of current.source.snapshots)for(const claim of snap.claims)assert.ok(claim.createdAt&&claim.updatedAt);
const initiativeId=current.source.snapshots[0]!.initiative.id;
const ownerInput:RecordFactInput={initiativeId,kind:"OWNER",expectedRevision:0,value:{date:null,text:null,extent:null,memberId:"30000000-0000-4000-8000-000000000002"},retract:false,basis:"DIRECT_KNOWLEDGE",note:"Assign test PM",evidenceId:null,locator:null};
let next=recordFact(current.state,current.source,ctx,ownerInput,now);
let forged=structuredClone(next);forged.facts[0]!.confirmedByLabel="Invented actor";refused(current,forged,/FACT_ACTOR/);
forged=structuredClone(next);forged.events[0]!.actor.label="Invented actor";refused(current,forged,/EVENT_ACTOR/);
commit(current,next); const stale=current;current=read();assert.equal(current.state.facts.length,1);
assert.match(sql(`set role service_role; select public.delivery_commit_workspace('${workspace}','${member}',${literal(stale.rawSource)},${literal(stale.state)},${literal(next)});`,true),/STALE/);
assert.match(sql(`set role service_role; select public.delivery_commit_workspace('${workspace}','30000000-0000-4000-8000-000000000003',${literal(current.rawSource)},${literal(current.state)},${literal(current.state)});`,true),/VIEW_ONLY|WRITE_ACCESS/);
for(const [kind,value] of [["SCOPE",{date:null,text:"Pilot scope",extent:null,memberId:null}],["TARGET_LIVE",{date:"2026-10-07",text:null,extent:null,memberId:null}]] as const){next=recordFact(current.state,current.source,ctx,{...ownerInput,kind,value,note:"Confirmed for local DB test"},now);commit(current,next);current=read();}
assert.equal(current.state.events.length,3);assert.equal(Number(sql("select count(*) from public.activity_log where event_type='DELIVERY_FACT_RECORDED';")),3);
// Atomic write rolls back if audit is omitted; row/version remains unchanged.
const bad=structuredClone(current.state);bad.facts.find(f=>f.kind==="TARGET_LIVE")!.revision++;assert.match(sql(`set role service_role; select public.delivery_commit_workspace('${workspace}','${member}',${literal(current.rawSource)},${literal(current.state)},${literal(bad)});`,true),/AUDIT_REQUIRED/);assert.equal(read().state.facts.find(f=>f.kind==="TARGET_LIVE")!.revision,1);
const localWeek=(await import("../../src/lib/delivery/model.ts")).isoWeek(now);next=createReview(current.state,current.source,ctx,localWeek,now);
forged=structuredClone(next);forged.reviews[0]!.id=randomUUID();forged.reviews[0]!.status="FINAL";forged.reviews[0]!.week="9999-W99";forged.reviews[0]!.sections=[];forged.reviews[0]!.finalizedByMemberId="30000000-0000-4000-8000-000000000003";forged.reviews[0]!.finalizedAt=now;refused(current,forged,/REVIEW_WEEK/);
forged.reviews[0]!.week=localWeek;refused(current,forged,/DRAFT_CREATOR/);
forged=structuredClone(next);forged.reviews[0]!.createdByMemberId="30000000-0000-4000-8000-000000000003";refused(current,forged,/DRAFT_CREATOR/);
commit(current,next);current=read();const reviewId=current.state.reviews[0]!.id;
forged=structuredClone(current.state);let forgedReview=forged.reviews[0]!;forgedReview.revision++;forgedReview.status="FINAL";forgedReview.finalizedByMemberId=member;forgedReview.finalizedByLabel=ctx.actor.label;forgedReview.finalizedAt=now;refused(current,forged,/SECTION_REVIEW_REQUIRED/);
forged=structuredClone(current.state);forgedReview=forged.reviews[0]!;forgedReview.revision++;const unowned=forgedReview.sections.find(s=>s.initiativeId!==initiativeId)!;unowned.revision++;unowned.editedByMemberId="30000000-0000-4000-8000-000000000002";unowned.editedAt=now;unowned.sourceDigest="forged";refused(current,forged,/SECTION_OWNER/,"30000000-0000-4000-8000-000000000002");
forged=structuredClone(current.state);forged.events[0]!.actor.label="Changed history";refused(current,forged,/EVENT_IMMUTABLE/);
forged=structuredClone(current.state);forged.events=[];refused(current,forged,/NO_HARD_DELETE/);
// Valid AI drafting and refresh still work; neither fabricates a reviewed marker.
next=applyAiDraft(current.state,current.source,ctx,reviewId,current.state.reviews[0]!.revision,{mode:"TEMPLATE",model:null,promptVersion:"sql-test",generatedAt:now,inputDigest:current.state.reviews[0]!.input.digest,reason:"Explicit test template",original:[{initiativeId,lines:[{referenceId:"test-reference",text:"Explicit template test"}]}]},now);commit(current,next);current=read();
next=recordFact(current.state,current.source,ctx,{...ownerInput,kind:"TARGET_LIVE",expectedRevision:1,value:{date:"2026-10-14",text:null,extent:null,memberId:null},note:"New confirmed local target"},now);commit(current,next);current=read();
next=refreshReview(current.state,current.source,ctx,reviewId,current.state.reviews[0]!.revision,now);commit(current,next);current=read();
for(const section of current.state.reviews[0]!.sections){const review=current.state.reviews[0]!;next=editSection(current.state,current.source,ctx,review.id,review.revision,section.initiativeId,section.revision,{headline:"Reviewed test section",updates:"",attention:"",decisionNeeded:"",nextMilestone:"",nextStep:""},now);commit(current,next);current=read();}
next=finalizeReview(current.state,current.source,ctx,reviewId,current.state.reviews[0]!.revision,now);
forged=structuredClone(next);forged.reviews[0]!.finalizedByMemberId="30000000-0000-4000-8000-000000000003";refused(current,forged,/FINAL_ACTOR/);
forged=structuredClone(next);forged.reviews[0]!.finalizedByLabel="Invented finalizer";refused(current,forged,/FINAL_ACTOR/);
forged=structuredClone(next);forged.reviews[0]!.baselineReviewId=randomUUID();refused(current,forged,/STALE_BASELINE/);
forged=structuredClone(next);forged.reviews[0]!.sections=[];refused(current,forged,/SECTION_INVENTORY/);
// Simulate a previous-week Final arriving after the current draft was prepared.
// The synthetic row exists only inside a rollback transaction in this test DB.
const earlierFinal=structuredClone(next.reviews[0]!);earlierFinal.id=randomUUID();earlierFinal.week=(await import("../../src/lib/delivery/model.ts")).isoWeek(new Date(Date.parse(now)-7*86400000).toISOString());
const racedBefore=structuredClone(current.state);racedBefore.reviews.push(earlierFinal);racedBefore.reviews.sort((a,b)=>a.id.localeCompare(b.id));
const racedNext=structuredClone(next);racedNext.reviews.push(earlierFinal);racedNext.reviews.sort((a,b)=>a.id.localeCompare(b.id));
assert.match(sql(`begin; insert into public.weekly_reviews(id,workspace_id,iso_week,status,revision,data) values('${earlierFinal.id}','${workspace}','${earlierFinal.week}','FINAL',${earlierFinal.revision},${literal(earlierFinal)}); set role service_role; select public.delivery_commit_workspace('${workspace}','${member}',${literal(current.rawSource)},${literal(racedBefore)},${literal(racedNext)}); rollback;`,true),/STALE_BASELINE/);
const claimId=current.source.snapshots.flatMap(s=>s.claims)[0]!.id;
assert.match(sql(`begin; update public.claims set value='Changed support for stale-final check' where id='${claimId}'; set role service_role; select public.delivery_commit_workspace('${workspace}','${member}',public.delivery_source('${workspace}'),${literal(current.state)},${literal(next)}); rollback;`,true),/STALE_REVIEW_INPUT/);
commit(current,next);assert.equal(read().state.reviews[0]!.status,"FINAL");
assert.match(sql(`update public.weekly_reviews set revision=revision+1,data=jsonb_set(data,'{revision}',to_jsonb(revision+1)) where id='${reviewId}';`,true),/FINAL_IMMUTABLE/);
assert.equal(sql("select has_function_privilege('authenticated','public.delivery_commit_workspace(uuid,uuid,jsonb,jsonb,jsonb)','EXECUTE');"),"f");assert.equal(sql("select has_table_privilege('authenticated','public.weekly_reviews','SELECT');"),"f");
console.log("Local PostgreSQL delivery checks passed: coherent source, typed fact writes, atomic actor-bound audit, stale CAS, Viewer denial, validated AI/refresh/edit transitions, structural ownership, reviewed Final snapshot/baseline/actor checks, immutability and service-only privileges. Privileged forged payloads were refused. Auth provider users are explicit local FK stand-ins; no hosted calls.");
