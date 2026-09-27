import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {LocalAuthStore,hash} from "./core.ts";
import {localContextForToken} from "./login-scope.ts";
const password="Fictional-context-switch-password-42";
async function fixture(){
 const dir=mkdtempSync(join(tmpdir(),"prodwise-switch-")),store=new LocalAuthStore(join(dir,"auth.json"),"workspace-a");
 const owner=store.bootstrap("owner@alpha.test","Fixture platform owner",password,{id:"org-a",name:"Alpha",emailPolicy:{domains:["alpha.test"],exactEmails:[]}});
 await store.bootstrapPlatformOwner(owner.userId);
 const token=await store.login(owner.email,password),ctx=store.session(token);
 const other=await store.platformCreateOrganization(ctx,"Beta",{domains:["beta.test"],exactEmails:[]});
 const invitation=await store.platformProvisionMembership(ctx,other.organizationId,"owner@beta.test","ORG_OWNER",false,"Fictional second organization");
 const beta=new LocalAuthStore(store.path,other.workspaceId);await beta.accept(invitation.invitationToken!,"Beta owner",password);
 return {store,token,ctx,beta,other,clean:()=>rmSync(dir,{recursive:true,force:true})};
}
test("platform context switch preserves independent authority, rotates only this session and records audit",async()=>{
 const f=await fixture();try {
  const parallel=await f.store.login("owner@alpha.test",password);
  assert.equal(f.store.authorizedContexts(f.ctx).length,2);
  const result=await f.store.switchSession(f.token,f.beta.workspaceId,f.store.workspaceId);
  const ctx=localContextForToken(f.store,result.token);
  assert.equal(ctx.workspaceId,f.beta.workspaceId);assert.equal(ctx.platformRole,"PLATFORM_OWNER");assert.equal(ctx.memberId,null);
  assert.throws(()=>localContextForToken(f.store,f.token),{code:"UNAUTHENTICATED"});
  assert.equal(f.store.session(parallel).workspaceId,f.store.workspaceId);
  const event=f.store.read(true).events.at(-1)!;
  assert.equal(event.action,"ORGANIZATION_CONTEXT_SWITCHED");assert.equal(event.actorId,f.ctx.actor.id);assert.equal(event.organizationId,f.other.organizationId);
  assert.equal(f.store.read(true).memberships.filter(m=>m.userId===f.ctx.actor.id).length,1);
 }finally{f.clean();}
});
test("switch cannot use foreign membership, stale bound context, policy revocation or archived organization",async()=>{
 const f=await fixture();try {
  const betaToken=await f.beta.login("owner@beta.test",password),betaCtx=f.beta.session(betaToken);
  assert.equal(f.beta.authorizedContexts(betaCtx).length,1);
  await assert.rejects(()=>f.beta.switchSession(betaToken,f.store.workspaceId,f.beta.workspaceId),{code:"ACCESS_DENIED"});
  await assert.rejects(()=>f.store.switchSession(f.token,f.beta.workspaceId,"old"),{code:"SCOPE_CHANGED"});
  assert.equal(f.store.read(true).sessions.filter(s=>s.tokenHash===hash(f.token)).length,1);
  await f.store.platformConfigurePolicy(f.ctx,f.other.organizationId,{domains:["different.test"],exactEmails:[]});
  await assert.rejects(()=>f.beta.switchSession(betaToken,f.beta.workspaceId,f.beta.workspaceId),{code:"EMAIL_NOT_ALLOWED"});
  await f.store.mutate(state=>{state.organizations.find(o=>o.id===f.other.organizationId)!.status="ARCHIVED";state.workspaces.find(w=>w.id===f.beta.workspaceId)!.status="ARCHIVED";});
  assert.equal(f.store.authorizedContexts(f.ctx).length,1);
  await assert.rejects(()=>f.store.switchSession(f.token,f.beta.workspaceId,f.store.workspaceId),{code:"ACCESS_DENIED"});
 }finally{f.clean();}
});
