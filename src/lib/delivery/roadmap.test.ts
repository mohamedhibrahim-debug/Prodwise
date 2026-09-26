import assert from "node:assert/strict";
import test from "node:test";
import { deliveryTiming, displayDate, targetHistory, targetMovements, timelinePosition } from "./roadmap.ts";
import type { DeliveryFact, DeliveryEvent } from "./types.ts";
function fact(kind:DeliveryFact["kind"],date:string|null,revision=1):DeliveryFact { return {id:kind,workspaceId:"w1",initiativeId:"i1",kind,revision,value:{date,text:null,memberId:null,extent:kind==="ACTUAL_LIVE"?"FULL":null},state:"SET",basis:"DIRECT_KNOWLEDGE",note:"Confirmed in planning",evidenceId:null,locator:null,supportDigest:null,confirmedByMemberId:"pm",confirmedByLabel:"PM",updatedAt:"2026-09-26T10:00:00Z"}; }
function event(before:DeliveryFact|null,after:DeliveryFact):DeliveryEvent { return {id:`e-${after.revision}`,workspaceId:after.workspaceId,initiativeId:after.initiativeId,occurredAt:after.updatedAt,actor:{id:"user",label:"PM"},before,after}; }
test("Missing dates stay unknown rather than zero, late or failed",()=>{const timing=deliveryTiming([],"i1","2026-09-26");assert.equal(timing.kind,"UNSCHEDULED");assert.equal(timing.overdueDays,null);assert.equal(displayDate(null),"Unknown");assert.match(timing.detail,/not inferred/);});
test("Past target without Actual Live requests an update and never declares launch failure",()=>{const timing=deliveryTiming([fact("TARGET_LIVE","2026-09-20")],"i1","2026-09-26");assert.equal(timing.kind,"NEEDS_UPDATE");assert.equal(timing.overdueDays,6);assert.match(timing.detail,/Actual Live is not recorded/);assert.doesNotMatch(timing.detail,/failed|not launched|not live/);});
test("Known Actual Live remains distinct from target and suppresses missing-confirmation attention",()=>{const facts=[fact("TARGET_LIVE","2026-09-20"),fact("ACTUAL_LIVE","2026-09-22")];const timing=deliveryTiming(facts,"i1","2026-09-26");assert.equal(timing.kind,"RECORDED");assert.equal(timing.overdueDays,null);assert.equal(facts[0]!.value.date,"2026-09-20");assert.equal(facts[1]!.value.date,"2026-09-22");});
test("Cutoff uses strict date comparison: due today is planned, not past target",()=>{const target=fact("TARGET_LIVE","2026-09-26");assert.equal(deliveryTiming([target],"i1","2026-09-26").label,"Target today");assert.equal(deliveryTiming([target],"i1","2026-09-25").kind,"PLANNED");assert.equal(deliveryTiming([target],"i1","2026-09-27").kind,"NEEDS_UPDATE");});
test("Target history retains withdrawals without counting an unknown target as a date slip",()=>{const first=fact("TARGET_LIVE","2026-10-01"),second=fact("TARGET_LIVE","2026-10-08",2),third=fact("TARGET_LIVE","2026-10-08",3),withdrawn={...fact("TARGET_LIVE",null,4),state:"RETRACTED" as const};const events=[event(first,second),event(null,first),event(second,third),event(third,withdrawn)];assert.equal(targetHistory(events,"w1","i1").length,4);assert.deepEqual(targetMovements(events,"w1","i1").map(e=>e.after.revision),[2]);assert.equal(first.value.date,"2026-10-01");});

test("Partial actual preserves an update request for remaining scope and never asserts failed launch",()=>{
 const actual={...fact("ACTUAL_LIVE","2026-09-22"),value:{...fact("ACTUAL_LIVE","2026-09-22").value,extent:"PARTIAL" as const,text:"First pilot cohort"}};
 const late=deliveryTiming([fact("TARGET_LIVE","2026-09-20"),actual],"i1","2026-09-26");
 assert.equal(late.kind,"NEEDS_UPDATE");assert.match(late.detail,/remaining scope/);assert.doesNotMatch(late.detail,/failed|not launched|Actual Live is not recorded/);
 assert.equal(deliveryTiming([fact("TARGET_LIVE","2026-10-01"),actual],"i1","2026-09-26").kind,"PARTIAL");
});
test("Actual after a selected cutoff is explicitly identified instead of presented as live at cutoff",()=>{
 assert.equal(deliveryTiming([fact("ACTUAL_LIVE","2026-09-24")],"i1","2026-09-20").kind,"AFTER_CUTOFF");
});
test("Target movement counts exclude previous scopes while full revision history remains available",()=>{
 const first=fact("TARGET_LIVE","2026-10-01"),second=fact("TARGET_LIVE","2026-10-08",2);
 const old=event(first,second),scope=event({...fact("SCOPE",null),value:{...first.value,date:null,text:"Pilot"}},{...fact("SCOPE",null,2),updatedAt:"2026-09-27T10:00:00Z",value:{...first.value,date:null,text:"Phase 2"}});
 assert.equal(targetHistory([old,scope],"w1","i1").length,1);assert.equal(targetMovements([old,scope],"w1","i1").length,0);
});
test("Target movement history does not mix workspaces or initiatives",()=>{const first=fact("TARGET_LIVE","2026-10-01"),next=fact("TARGET_LIVE","2026-10-08",2);const valid=event(first,next);assert.deepEqual(targetHistory([valid,{...valid,workspaceId:"other"},{...valid,initiativeId:"other"}],"w1","i1"),[valid]);});
test("Timeline positions are bounded and a single recorded date never produces NaN",()=>{assert.equal(timelinePosition("2026-09-26","2026-09-26","2026-09-26"),0);assert.equal(timelinePosition("2026-09-01","2026-09-20","2026-09-30"),0);assert.equal(timelinePosition("2026-10-01","2026-09-20","2026-09-30"),100);assert.equal(timelinePosition("2026-09-25","2026-09-20","2026-09-30"),50);});
