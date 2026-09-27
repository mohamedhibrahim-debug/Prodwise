import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

test("local evidence verification survives nested projection reads and preserves its audit",async()=>{
 const root=await mkdtemp(join(tmpdir(),"prodwise-verification-")),previous=process.cwd(),oldWrites=process.env.DEMO_WRITE_ENABLED;
 process.chdir(root);process.env.DEMO_WRITE_ENABLED="true";
 try{
  const {localRepository:repo}=await import("./local-repository.ts");
  const initiative=(await repo.listInitiatives())[0]!;
  const evidence=await repo.createEvidence({initiativeId:initiative.id,title:"Verification test source",sourceType:"DOCUMENT",boundary:"CURRENT_SCOPE"});
  const claim=await repo.createClaim({initiativeId:initiative.id,type:"DECISION",subject:"Review outcome",attribute:"Selection",value:"Recorded choice",domain:"PRODUCT",phase:null});
  await repo.setClaimEvidence(claim.id,[evidence.id]);
  const fresh=await repo.getClaim(claim.id);assert.ok(fresh);
  const verified=await repo.verifyClaim(claim.id,{basis:"EVIDENCE",note:"Confirmed against the recorded source",actor:{id:"local-test",label:"Local verifier"},expectedUpdatedAt:fresh.updatedAt});
  assert.equal(verified.status,"ACTIVE");
  const reloaded=await repo.getClaim(claim.id);assert.equal(reloaded?.status,"ACTIVE");assert.equal(reloaded?.verifiedActorId,"local-test");
  const disk=JSON.parse(await readFile(join(root,".data","prodwise.json"),"utf8"));
  assert.equal(disk.claims.find((c:{id:string})=>c.id===claim.id).status,"ACTIVE");
  assert.equal(disk.activity.filter((a:{entityId:string;eventType:string})=>a.entityId===claim.id&&a.eventType==="CLAIM_VERIFIED").length,1);
 }finally{process.chdir(previous);if(oldWrites===undefined)delete process.env.DEMO_WRITE_ENABLED;else process.env.DEMO_WRITE_ENABLED=oldWrites;await rm(root,{recursive:true,force:true});}
});
