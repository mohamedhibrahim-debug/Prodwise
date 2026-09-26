import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalAuthStore, contextForMember, authorizeBusiness, authorizeManagement, authorizeFinalize, signToken, unsignedToken, safeReturnPath, hash } from './core.ts';
const pwd='Fictional-test-password-42';
async function fixture() {
  const dir=mkdtempSync(join(tmpdir(),'prodwise-auth-'));
  const store=new LocalAuthStore(join(dir,'auth.json'),'workspace-a');
  const admin=store.bootstrap('admin@prodwise.test','Test Admin',pwd);
  const ctx=contextForMember(admin,'workspace-a');
  return {store,ctx,cleanup:()=>rmSync(dir,{recursive:true,force:true})};
}
test('opaque signed session rejects tampering, wrong secret and external return URL',()=>{
  const secret='s'.repeat(40), token='private-opaque-token';
  assert.equal(unsignedToken(signToken(token,secret),secret),token);
  assert.equal(unsignedToken(signToken(token,secret)+'x',secret),null);
  assert.equal(unsignedToken(signToken(token,secret),'t'.repeat(40)),null);
  for(const path of ['https://evil.test','//evil.test','/\\evil.test','/login','/invite/token']) assert.equal(safeReturnPath(path),'/');
  assert.equal(safeReturnPath('/initiatives/a?view=brief'),'/initiatives/a?view=brief');
});
test('role restriction precedes independent environment restriction, including review lead',()=>{
  const base={workspaceId:'w',memberId:'m',actor:{id:'u',label:'User'},role:'Viewer' as const,isProductLead:false};
  assert.throws(()=>authorizeBusiness(base,false),{code:'VIEW_ONLY'});
  assert.throws(()=>authorizeManagement(base,false),{code:'ADMIN_REQUIRED'});
  assert.throws(()=>authorizeFinalize({...base,isProductLead:true},true),{code:'VIEW_ONLY'});
  assert.throws(()=>authorizeBusiness({...base,role:'Member'},false),{code:'WRITE_DISABLED'});
  assert.throws(()=>authorizeFinalize({...base,role:'Member'},true),{code:'REVIEW_FINALIZE_DENIED'});
  assert.equal(authorizeFinalize({...base,role:'Member',isProductLead:true},true).actor.id,'u');
  assert.throws(()=>contextForMember({id:'m',workspaceId:'other',userId:'u',displayName:'x',email:'x',role:'Admin',active:true,isProductLead:false},'w'),{code:'ACCESS_DENIED'});
});
test('local durable invitation acceptance is role/email bound and exactly once under contention',async()=>{
  const {store,ctx,cleanup}=await fixture();try{
    const token=await store.invite(ctx,'VIEWER@prodwise.test','Viewer');
    const saved=readFileSync(store.path,'utf8');assert.ok(!saved.includes(token));assert.ok(saved.includes(hash(token)));
    const outcomes=await Promise.allSettled([store.accept(token,'Viewer One',pwd),store.accept(token,'Viewer Two',pwd)]);
    assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
    const viewer=store.read().members.find(x=>x.email==='viewer@prodwise.test')!;
    assert.equal(viewer.role,'Viewer');assert.equal(viewer.isProductLead,false);
    assert.throws(()=>store.invitation(token),{code:'INVITE_INVALID'});
    const login=await store.login(viewer.email,pwd); assert.equal(store.session(login).actor.id,viewer.userId);
    await store.change(ctx,viewer.id,'Viewer',false,false);
    assert.throws(()=>store.session(login),{code:'UNAUTHENTICATED'});
    await assert.rejects(()=>store.login(viewer.email,pwd),{code:'DEACTIVATED'});
  }finally{cleanup();}
});
test('resend and revoke invalidate bearer links; expired and wrong-workspace invitations fail',async()=>{
  const {store,ctx,cleanup}=await fixture();try{
    const old=await store.invite(ctx,'member@prodwise.test','Member');const id=store.read().invitations[0]!.id;
    const next=await store.rotate(ctx,id,false);assert.throws(()=>store.invitation(old),{code:'INVITE_INVALID'});
    assert.equal(store.invitation(next!).role,'Member');await store.rotate(ctx,id,true);
    await assert.rejects(()=>store.accept(next!,'Member',pwd),{code:'INVITE_INVALID'});
    const expired=await store.invite(ctx,'expired@prodwise.test','Member');
    await store.mutate(state=>{state.invitations.find(x=>x.tokenHash===hash(expired))!.expiresAt='2000-01-01T00:00:00Z';});
    assert.throws(()=>store.invitation(expired),{code:'INVITE_INVALID'});
    assert.throws(()=>new LocalAuthStore(store.path,'other-workspace').session('anything'),{code:'ACCESS_DENIED'});
  }finally{cleanup();}
});
test('persisted local membership lock keeps one Admin under simultaneous self-demotions',async()=>{
  const {store,ctx,cleanup}=await fixture();try{
    const token=await store.invite(ctx,'admin2@prodwise.test','Admin');await store.accept(token,'Admin Two',pwd);
    const ctx2=contextForMember(store.read().members[1],'workspace-a');
    const outcomes=await Promise.allSettled([store.change(ctx,ctx.memberId,'Member',true,false),store.change(ctx2,ctx2.memberId,'Member',true,false)]);
    assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
    assert.equal(store.read().members.filter(x=>x.role==='Admin'&&x.active).length,1);
    const last=store.read().members.find(x=>x.role==='Admin')!;
    await assert.rejects(()=>store.change(contextForMember(last,'workspace-a'),last.id,'Admin',false,false),{code:'LAST_ADMIN'});
  }finally{cleanup();}
});
test('logout revokes persisted session and fresh role change replaces stale session claims',async()=>{
  const {store,ctx,cleanup}=await fixture();try{
    const token=await store.invite(ctx,'member@prodwise.test','Member');await store.accept(token,'Member',pwd);
    const session=await store.login('member@prodwise.test',pwd), member=store.read().members[1]!;
    await store.change(ctx,member.id,'Viewer',true,false);assert.equal(store.session(session).role,'Viewer');
    await store.logout(session);assert.throws(()=>store.session(session),{code:'UNAUTHENTICATED'});
  }finally{cleanup();}
});
test('own password change requires current password and revokes every existing app session',async()=>{
  const {store,ctx,cleanup}=await fixture();try{
    const session=await store.login('admin@prodwise.test',pwd);
    await assert.rejects(()=>store.changePassword(ctx,'wrong',pwd+'new'),{code:'INVALID_CREDENTIALS'});
    assert.equal(store.session(session).actor.id,ctx.actor.id);
    await store.changePassword(ctx,pwd,pwd+'new');
    assert.throws(()=>store.session(session),{code:'UNAUTHENTICATED'});
    await assert.rejects(()=>store.login('admin@prodwise.test',pwd),{code:'INVALID_CREDENTIALS'});
    assert.equal(store.session(await store.login('admin@prodwise.test',pwd+'new')).actor.id,ctx.actor.id);
  }finally{cleanup();}
});
