import test from 'node:test';
import assert from 'node:assert/strict';
import { demoEntryContext, verifyDemoProvider, DEMO_TOKEN_PREFIX } from './demo-session.ts';
import { hash, opaqueToken, signToken, unsignedToken } from './core.ts';
const id=(n:string)=>`00000000-0000-4000-8000-${n.padStart(12,'0')}`;
const entry={workspaceId:id('1'),organizationId:id('2'),memberId:id('3'),userId:id('4'),authUserId:id('5'),email:'synthetic@example.test',displayName:'Demo Reviewer',platformRole:null,role:'ORG_OWNER',isProductLead:false};
test('demo context preserves only the verified pinned organization with no platform grant',()=>{
 const {context}=demoEntryContext({...entry,requestedWorkspaceId:id('999')});
 assert.equal(context.workspaceId,entry.workspaceId);assert.equal(context.organizationId,entry.organizationId);
 assert.equal(context.platformRole,null);assert.equal(context.role,'ORG_OWNER');
 for(const patch of [{platformRole:'PLATFORM_OWNER'},{role:'ADMIN'},{memberId:null},{workspaceId:'foreign'},{userId:null},{authUserId:null}])
  assert.throws(()=>demoEntryContext({...entry,...patch}));
});
test('guest rejects anonymous, banned, deleted or substituted provider identities',()=>{
 const {entry:e}=demoEntryContext(entry);const provider={id:e.authUserId,email:e.email,is_anonymous:false};
 verifyDemoProvider(e,provider);
 for(const patch of [{id:id('99')},{email:'owner@real.test'},{is_anonymous:true},{is_anonymous:undefined},{deleted_at:'2026-01-01'},{banned_until:'2099-01-01'}])
  assert.throws(()=>verifyDemoProvider(e,{...provider,...patch}));
 verifyDemoProvider(e,{...provider,banned_until:'2000-01-01'});
});
test('demo cookie type is inside the signature and opaque token is hashed for storage',()=>{
 const secret='fictional-test-secret'.repeat(3),token=DEMO_TOKEN_PREFIX+opaqueToken(),cookie=signToken(token,secret);
 assert.equal(unsignedToken(cookie,secret),token);assert.notEqual(hash(token),token);
 assert.equal(unsignedToken(cookie.replace('demo:',''),secret),null);
 assert.equal(unsignedToken('demo:'+signToken(opaqueToken(),secret),secret),null);
 assert.notEqual(hash(token),hash(token.slice(DEMO_TOKEN_PREFIX.length)));
});
