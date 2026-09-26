import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { guardedRepository } from "./guarded-repository.ts";
import type { WorkspaceAccess } from "../auth/core.ts";
import { LocalDeliveryStore } from "../delivery/local-store.ts";
import { localDeliveryPath } from "../delivery/local-path.ts";

test("real local repository keeps Demo creations, evidence and actor audit outside AMAN", async()=>{
  const root=await mkdtemp(join(tmpdir(),"prodwise-tenant-")),before=process.cwd();
  const aman="a0000000-0000-4000-8000-000000000001",demo="d0000000-0000-4000-8000-000000000001";
  const originalWorkspace=process.env.PRODWISE_WORKSPACE_ID,originalWrites=process.env.DEMO_WRITE_ENABLED;
  process.env.PRODWISE_WORKSPACE_ID=aman;process.env.DEMO_WRITE_ENABLED="true";process.chdir(root);
  try {
    const {localRepository}=await import("./local-repository.ts");
    const actor=(workspaceId:string):WorkspaceAccess=>({workspaceId,organizationId:workspaceId,memberId:workspaceId,actor:{id:workspaceId,label:workspaceId===demo?"Demo Reviewer":"AMAN owner"},role:"ORG_OWNER",platformRole:null,isProductLead:false});
    const repo=(workspaceId:string)=>guardedRepository(async()=>actor(workspaceId),()=>localRepository,()=>true,()=>true);
    const amanRepo=repo(aman),demoRepo=repo(demo),original=await amanRepo.listInitiatives();
    assert.ok(original.length>0);assert.equal((await demoRepo.listInitiatives()).length,0);
    const created=await demoRepo.createInitiative({name:original[0]!.name,businessLine:"MF"});
    assert.equal(created.slug,original[0]!.slug,"Slugs are unique within the verified workspace");
    assert.equal((await demoRepo.getInitiativeBySlug(created.slug))?.id,created.id);
    assert.equal((await amanRepo.getInitiativeBySlug(created.slug))?.id,original[0]!.id);
    await assert.rejects(demoRepo.createEvidence({initiativeId:original[0]!.id,title:"Foreign source",sourceType:"DOCUMENT",boundary:"CURRENT_SCOPE"}),{code:"ACCESS_DENIED"});
    assert.equal(await demoRepo.getInitiativeSnapshot(original[0]!.id),null);
    const persisted=JSON.parse(await readFile(join(root,".data","prodwise.json"),"utf8"));
    assert.deepEqual(persisted.initiatives.filter((row:{workspaceId:string})=>row.workspaceId===aman).sort((a:{id:string},b:{id:string})=>a.id.localeCompare(b.id)),[...original].sort((a,b)=>a.id.localeCompare(b.id)));
    assert.equal(persisted.initiatives.find((row:{id:string})=>row.id===created.id).workspaceId,demo);
    assert.ok(persisted.activity.filter((row:{initiativeId:string})=>row.initiativeId===created.id).every((row:{workspaceId:string;actorLabel:string})=>row.workspaceId===demo&&row.actorLabel==="Demo Reviewer"));
  } finally {
    process.chdir(before);if(originalWorkspace===undefined)delete process.env.PRODWISE_WORKSPACE_ID;else process.env.PRODWISE_WORKSPACE_ID=originalWorkspace;
    if(originalWrites===undefined)delete process.env.DEMO_WRITE_ENABLED;else process.env.DEMO_WRITE_ENABLED=originalWrites;
    await rm(root,{recursive:true,force:true});
  }
});

test("local delivery files preserve the AMAN baseline and isolate Demo facts and Finals",async()=>{
  const root=await mkdtemp(join(tmpdir(),"prodwise-delivery-scope-"));
  const aman="a0000000-0000-4000-8000-000000000001",demo="d0000000-0000-4000-8000-000000000001";
  try {
    const a=new LocalDeliveryStore(localDeliveryPath(root,aman,aman)),d=new LocalDeliveryStore(localDeliveryPath(root,demo,aman));
    assert.equal(a.path,join(root,".data","prodwise-delivery-weekly.json"));assert.notEqual(a.path,d.path);
    await a.transaction(async state=>({...state,retainedMarker:"AMAN baseline"}));
    const before=await readFile(a.path,"utf8");assert.equal((await d.read()).reviews.length,0);
    await d.transaction(async state=>({...state,demoMarker:"Demo only"}));
    assert.equal(await readFile(a.path,"utf8"),before);assert.ok(!(await readFile(d.path,"utf8")).includes("AMAN baseline"));
    assert.throws(()=>localDeliveryPath(root,"../../prodwise",aman),/verified workspace/);
  }finally{await rm(root,{recursive:true,force:true});}
});

