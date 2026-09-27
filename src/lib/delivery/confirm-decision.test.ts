import test from "node:test";
import assert from "node:assert/strict";
import {createConfirmedDecision} from "./confirm-decision.ts";
import type {MemoryClaim,NewClaimInput} from "../domain/types.ts";
const input:NewClaimInput={initiativeId:"i",type:"DECISION",subject:"Fee",attribute:"Rate",value:"1.50%",domain:"FINANCE",phase:"Pilot"};
const confirmation={basis:"EVIDENCE" as const,note:"Confirmed in Finance review",evidenceId:"e",locator:"Clause 4",actor:{id:"u",label:"PM"}};
function fixture(){let row:MemoryClaim={id:"new",...input,phase:"Pilot",status:"UNVERIFIED",confidence:null,supersededByClaimId:null,createdBy:"u",createdAt:"old",updatedAt:"created",origin:"HUMAN_ENTRY",verifiedAt:null,verifiedActorId:null,verifiedActorLabel:null,verificationBasis:null,verificationNote:null,evidence:[],anchors:[]};const called:string[]=[];return {called,get row(){return row;},change(value:Partial<MemoryClaim>){row={...row,...value};},repo:{async createClaim(){called.push("create");return {...row};},async setClaimEvidence(){called.push("link");row={...row,updatedAt:"after-link"};},async setEvidenceAnchor(){called.push("anchor");row={...row,updatedAt:"after-anchor"};},async getClaim(){called.push("read");return {...row};},async verifyClaim(_id:string,c:{expectedUpdatedAt:string}){called.push("verify");assert.equal(c.expectedUpdatedAt,row.updatedAt);row={...row,status:"ACTIVE",verifiedAt:"confirmed",verifiedActorId:"u"};return row;}}};}
test("evidence Decision confirms with current updatedAt after provenance writes, using one Knowledge record",async()=>{
 const f=fixture();let created=false;const record=await createConfirmedDecision(f.repo,input,confirmation,()=>{created=true;});assert.equal(created,true);assert.equal(record.status,"ACTIVE");assert.deepEqual(f.called,["create","link","anchor","read","verify","read"]);
});
test("failed confirmation reports the persisted UNVERIFIED record and never silently retries creation",async()=>{
 const f=fixture();f.repo.verifyClaim=async()=>{throw new Error("Concurrent write refused");};let persisted=false;await assert.rejects(createConfirmedDecision(f.repo,input,confirmation,()=>{persisted=true;}),/created but confirmation failed.*new.*instead of creating it again/);assert.equal(persisted,true);assert.equal(f.row.status,"UNVERIFIED");assert.equal(f.called.filter(c=>c==="create").length,1);
});
test("typed Decision changes between provenance and confirmation refuse verification",async()=>{
 const f=fixture();f.repo.setEvidenceAnchor=async()=>{f.change({value:"2.00%"});};await assert.rejects(createConfirmedDecision(f.repo,input,confirmation),/changed before confirmation/);assert.ok(!f.called.includes("verify"));assert.equal(f.row.status,"UNVERIFIED");
});
test("returned confirmation without persisted trust never reports the Decision as applied",async()=>{
 const f=fixture();f.repo.verifyClaim=async()=>({...f.row,status:"ACTIVE",verifiedAt:"confirmed",verifiedActorId:"u"});await assert.rejects(createConfirmedDecision(f.repo,input,confirmation),/not verified in persisted Knowledge/);assert.equal(f.row.status,"UNVERIFIED");
});
