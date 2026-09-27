import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {LocalAuthStore} from "./core.ts";
const password="Fictional-signup-password-42";
async function fixture(){
 const dir=mkdtempSync(join(tmpdir(),"prodwise-signup-")),store=new LocalAuthStore(join(dir,"auth.json"),"ws-aman");
 const owner=store.bootstrap("owner@aman.eg","Fixture owner",password,{id:"org-aman",name:"AMAN",emailPolicy:{domains:["aman.eg","rayacorp.com"],exactEmails:["exception@outside.test"]}});
 await store.bootstrapPlatformOwner(owner.userId);const ctx=store.session(await store.login(owner.email,password));
 const beta=await store.platformCreateOrganization(ctx,"Beta",{domains:["beta.test"],exactEmails:[]});
 return {store,ctx,beta,clean:()=>rmSync(dir,{recursive:true,force:true})};
}
test("self sign-up is off until a Platform Owner enables it; then only policy-allowed addresses are eligible",async()=>{const f=await fixture();try{
 assert.equal((await f.store.checkSelfSignup("new.pm@aman.eg")).eligible,false);
 await f.store.platformSetSelfSignup(f.ctx,"org-aman",true,"Approved corporate domains");
 assert.equal((await f.store.checkSelfSignup("new.pm@aman.eg")).eligible,true);assert.equal((await f.store.checkSelfSignup("a@rayacorp.com")).eligible,true);
 const gmail=await f.store.checkSelfSignup("someone@gmail.com");assert.equal(gmail.eligible,false);assert.equal(gmail.token,null);
 assert.equal((await f.store.checkSelfSignup("x@beta.test")).eligible,false,"Beta has not opted in");
}finally{f.clean();}});
test("verification is single-use; completion creates a MEMBER only; tampered organization, duplicate and existing identities are refused",async()=>{const f=await fixture();try{
 await f.store.platformSetSelfSignup(f.ctx,"org-aman",true,"Approved");const {token}=await f.store.checkSelfSignup("New.PM@aman.eg ");
 const email=await f.store.verifySignupToken(token!);assert.equal(email,"new.pm@aman.eg");await assert.rejects(f.store.verifySignupToken(token!),/expired or was already used/);
 const opts=f.store.selfSignupOptions(email);assert.deepEqual(opts.organizations.map(o=>o.name),["AMAN"]);assert.equal(opts.existingIdentity,false);
 await assert.rejects(f.store.completeSelfSignup(email,f.beta.organizationId,"New PM",password),/does not accept/);
 await f.store.completeSelfSignup(email,"org-aman","New PM",password);
 const state=JSON.parse(JSON.stringify(f.store.read(true)));const id=state.identities.find((i:{email:string})=>i.email===email);const m=state.memberships.find((x:{userId:string})=>x.userId===id.id);
 assert.deepEqual([m.role,m.joinedVia,m.isProductLead,id.platformRole],["MEMBER","SELF_SIGNUP",false,null]);
 await assert.rejects(f.store.completeSelfSignup(email,"org-aman","Again",password),/already have a Prodwise account/);
 // The owner (existing identity) is never re-created or downgraded by sign-up.
 assert.equal(f.store.selfSignupOptions("owner@aman.eg").existingIdentity,true);await assert.rejects(f.store.completeSelfSignup("owner@aman.eg","org-aman","Hijack",password),/already have/);
 assert.equal(f.store.read(true).members.find(x=>x.email==="owner@aman.eg")!.role,"ORG_OWNER");
}finally{f.clean();}});
test("sign-up checks are rate limited per address",async()=>{const f=await fixture();try{await f.store.platformSetSelfSignup(f.ctx,"org-aman",true,"Approved");for(let n=0;n<5;n++)await f.store.checkSelfSignup("busy@aman.eg");await assert.rejects(f.store.checkSelfSignup("busy@aman.eg"),/Too many attempts/);}finally{f.clean();}});
