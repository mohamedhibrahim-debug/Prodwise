import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, rmdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { LocalAuthStore, contextForMember, passwordMatches } from '../../src/lib/auth/core.ts';
import { LocalDeliveryStore } from '../../src/lib/delivery/local-store.ts';
import { canonicalDemoData, assertDemoResetTarget, DEMO_ORGANIZATION_NAME, DEMO_CANONICAL_VERSION, DEMO_CUTOFF } from '../../src/lib/demo/canonical.ts';
import { canonical } from '../../src/lib/delivery/model.ts';
import { canonicalDemoDataV3, DEMO_V3_VERSION } from '../../src/lib/demo/scenario-v3.ts';

const require=createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd(),true,{info(){},error(){}});
const mode=process.argv.slice(2);
if(mode.length!==1 || !['--provision-demo','--reset-demo','--verify-demo'].includes(mode[0])) throw new Error('Choose exactly --provision-demo, --reset-demo or --verify-demo.');
if(process.env.AUTH_MODE!=='local' || process.env.NODE_ENV==='production' || process.env.VERCEL || process.env.VERCEL_ENV) throw new Error('This operator is restricted to the local integration checkout.');
const configuredWorkspaceId=process.env.PRODWISE_WORKSPACE_ID;
if(!configuredWorkspaceId) throw new Error('The local workspace configuration is missing.');
const privateRoot=resolve('.data'),authPath=join(privateRoot,'auth.json'),productPath=join(privateRoot,'prodwise.json'),legacyDeliveryPath=join(privateRoot,'prodwise-delivery-weekly.json'),accessPath=join(privateRoot,'demo-access.json'),envPath=resolve('.env.local');
const email='reviewer@prodwise.demo';
const policy={domains:[],exactEmails:[email]};
const legacyPolicy={domains:['prodwise.demo'],exactEmails:[email]};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fileHash=path=>existsSync(path)?hash(readFileSync(path)):null;
const git=args=>{const result=spawnSync('git',args,{encoding:'utf8',windowsHide:true});if(result.status!==0)throw new Error('Private-file Git safety check failed.');return result.stdout.trim();};
for(const path of ['.env.local','.data/demo-access.json']) if(git(['ls-files','--',path]) || !git(['check-ignore',path])) throw new Error('Private configuration and credentials must be ignored and untracked.');
const environmentBefore=fileHash(envPath),legacyBefore=fileHash(legacyDeliveryPath);
const store=new LocalAuthStore(authPath,configuredWorkspaceId);
const initial=store.read();
const owner=initial.members.find(member=>member.active && member.platformRole==='PLATFORM_OWNER');
if(!owner) throw new Error('A persisted active Platform Owner is required.');
const actor=contextForMember(owner,configuredWorkspaceId);
const originalIdentityHashes=new Map(initial.identities.map(identity=>[identity.id,identity.passwordHash]));
function product(){return JSON.parse(readFileSync(productPath,'utf8'));}
// Empty collections are omitted: a reset may add a collection the store never had, which changes no foreign row.
function foreignRows(data,workspaceId){return Object.fromEntries(Object.entries(data).map(([key,rows])=>[key,rows.filter(row=>row.workspaceId!==workspaceId)]).filter(([,rows])=>rows.length));}
function privateWrite(path,value){const temp=path+'.'+randomUUID()+'.tmp';try{writeFileSync(temp,JSON.stringify(value,null,2),{flag:'wx',mode:0o600});renameSync(temp,path);}finally{if(existsSync(temp))rmSync(temp);}}
function guard(access,allowLegacyPolicy=false){
 const state=store.read(),organization=state.organizations.find(org=>org.id===access.organizationId),workspace=state.workspaces.find(w=>w.id===access.workspaceId),identity=state.identities.find(user=>user.id===access.reviewerUserId),membership=state.memberships.find(member=>member.id===access.reviewerMemberId);
 if(access.version!==DEMO_CANONICAL_VERSION || access.email!==email || access.role!=='ORG_OWNER' || access.platformRole!==null || access.workspaceId===configuredWorkspaceId || !organization || !workspace || workspace.organizationId!==organization.id || !identity || identity.email!==email || !identity.active || !membership || membership.userId!==identity.id || membership.organizationId!==organization.id || membership.role!=='ORG_OWNER' || !membership.active || identity.platformRole!==null || membership.policyOverride || !passwordMatches(access.password,identity.passwordHash ?? '')) throw new Error('Registered Demo identity, credentials or organization binding differs. Refusing to modify it.');
 const demoMembers=state.memberships.filter(member=>member.organizationId===organization.id);
 for(const member of demoMembers){
   const memberIdentity=state.identities.find(user=>user.id===member.userId);
   if(!memberIdentity || memberIdentity.platformRole!==null || state.memberships.some(other=>other.userId===member.userId && other.organizationId!==organization.id)) throw new Error('A Demo member has platform authority or a foreign organization membership.');
 }
 if(access.asOf && access.asOf!==DEMO_CUTOFF) throw new Error('The registered Demo scenario date differs from its pinned canonical cutoff.');
 if(canonical(organization.emailPolicy)!==canonical(policy) && !(allowLegacyPolicy && canonical(organization.emailPolicy)===canonical(legacyPolicy))) throw new Error('Demo access policy differs from the registered reviewer policy.');
 const rows=product();
 if(Object.values(rows).some(collection=>!Array.isArray(collection) || collection.some(row=>!row.workspaceId))) throw new Error('Every existing product row must already have an explicit workspace ID.');
 // This exact private registration + owner binding authorizes removing reviewer-created
 // experiments too. Their isDemo flag is not a tenant boundary; workspaceId is.
 assertDemoResetTarget({organizationId:organization.id,organizationName:organization.name,workspaceId:workspace.id,reviewerPlatformRole:identity.platformRole,initiatives:rows.initiatives.filter(i=>i.workspaceId===workspace.id)},access,{allowReviewerCreatedItems:true});
 return {state,rows,organization,workspace,identity,membership};
}
function preserveExisting(){
 for(const identity of store.read().identities) if(originalIdentityHashes.has(identity.id)) assert.equal(identity.passwordHash,originalIdentityHashes.get(identity.id),'An existing credential changed.');
 assert.equal(fileHash(envPath),environmentBefore,'Environment configuration changed.');
 assert.equal(fileHash(legacyDeliveryPath),legacyBefore,'Existing workspace delivery bytes changed.');
}
/** Fictional Demo personas: members who own and act on work. No password, so they can never sign in. */
function writePersonas(access,personas){
 const raw=JSON.parse(readFileSync(authPath,'utf8'));
 for(const p of personas){
  if(raw.identities.some(x=>x.email===p.email&&x.id!==p.userId))throw new Error('A persona address is already used by another identity.');
  if(!raw.identities.some(x=>x.id===p.userId))raw.identities.push({id:p.userId,email:p.email,displayName:p.displayName,active:true,platformRole:null});
  raw.memberships=raw.memberships.filter(m=>m.id!==p.memberId);
  raw.memberships.push({id:p.memberId,organizationId:access.organizationId,userId:p.userId,role:p.role,isProductLead:p.isProductLead,active:true,policyOverride:true,policyOverrideReason:'Synthetic Demo persona; cannot sign in.',joinedVia:'PLATFORM'});
 }
 privateWrite(authPath,raw);
}
/** Read-only project metrics for the Demo workspace (src/lib/analysis/metrics.ts reads this file locally). */
const metricsPathFor=workspaceId=>join(privateRoot,`metrics-${workspaceId}.json`);
function createBackup(label,access){
 const dir=join(privateRoot,'demo-backups',new Date().toISOString().replaceAll(':','-')+'-'+randomUUID());
 mkdirSync(dir,{recursive:true});
 for(const [name,path] of [['auth.json',authPath],['prodwise.json',productPath],['demo-access.json',accessPath],['legacy-delivery.json',legacyDeliveryPath],['demo-delivery.json',access?join(privateRoot,'delivery',access.workspaceId+'.json'):null],['demo-metrics.json',access?metricsPathFor(access.workspaceId):null]]) if(path&&existsSync(path))writeFileSync(join(dir,name),readFileSync(path),{flag:'wx',mode:0o600});
 privateWrite(join(dir,'manifest.json'),{label,at:new Date().toISOString(),actorId:actor.actor.id,organizationId:access?.organizationId ?? null,workspaceId:access?.workspaceId ?? null,fixtureVersion:DEMO_CANONICAL_VERSION});
 return dir;
}
async function restore(access,label){
 const target=guard(access),foreignBefore=canonical(foreignRows(target.rows,access.workspaceId));
 const demo=canonicalDemoDataV3(access),deliveryPath=join(privateRoot,'delivery',access.workspaceId+'.json');
 const previous=existsSync(deliveryPath)?JSON.parse(readFileSync(deliveryPath,'utf8')):null;
 if(previous && ['facts','events','reviews'].some(key=>previous[key].some(row=>row.workspaceId!==access.workspaceId))) throw new Error('Demo delivery file contains foreign workspace records.');
 const backup=createBackup(label,access),productBefore=fileHash(productPath);
 // Every collection is replaced for this workspace only: v3 includes the P1 collections too.
 const keys=[...new Set([...Object.keys(target.rows),...Object.keys(demo.productStore)])];
 const next=Object.fromEntries(keys.map(key=>[key,[...(target.rows[key]??[]).filter(row=>row.workspaceId!==access.workspaceId),...(demo.productStore[key]??[])]]));
 writePersonas(access,demo.personas);
 assert.equal(canonical(foreignRows(next,access.workspaceId)),foreignBefore);
 const deliveryStore=new LocalDeliveryStore(deliveryPath);
 let replacedProduct=false;
 try{await deliveryStore.transaction(async()=>{
   guard(access);
   if(fileHash(productPath)!==productBefore) throw new Error('Product records changed while preparing reset. Retry while the local preview is idle.');
   privateWrite(productPath,next);replacedProduct=true;
   return demo.deliveryState;
 });}catch(error){
   if(replacedProduct && canonical(product())===canonical(next)) privateWrite(productPath,target.rows);
   throw error;
 }
 assert.equal(canonical(foreignRows(product(),access.workspaceId)),foreignBefore,'Other workspace product rows changed.');
 preserveExisting();
 // Synthetic metrics are replaced wholesale for this workspace only; every row is scoped to it.
 if(demo.metrics.some(m=>m.workspaceId!==access.workspaceId||m.origin!=='SYNTHETIC_DEMO'))throw new Error('Demo metrics must be synthetic and scoped to the Demo workspace.');
 privateWrite(metricsPathFor(access.workspaceId),demo.metrics);
 assert.equal(canonical(JSON.parse(readFileSync(metricsPathFor(access.workspaceId),'utf8'))),canonical(demo.metrics),'Demo metrics did not restore canonically.');
 const actualDelivery=JSON.parse(readFileSync(deliveryPath,'utf8'));
 assert.equal(canonical(actualDelivery),canonical(demo.deliveryState),'Demo delivery did not restore canonically.');
 const actualRows=Object.fromEntries(Object.keys(demo.productStore).map(key=>[key,(product()[key]??[]).filter(row=>row.workspaceId===access.workspaceId)]));
 assert.equal(canonical(actualRows),canonical(demo.productStore),'Demo product records did not restore canonically.');
 const auditPath=join(privateRoot,'demo-reset-audit.json'),audit=existsSync(auditPath)?JSON.parse(readFileSync(auditPath,'utf8')):[];
 audit.push({action:label,actorId:actor.actor.id,organizationId:access.organizationId,workspaceId:access.workspaceId,fixtureVersion:DEMO_V3_VERSION,at:new Date().toISOString(),backup,foreignProductUnchanged:true,legacyDeliveryUnchanged:true,environmentUnchanged:true});
 privateWrite(auditPath,audit);
 return demo;
}
mkdirSync(privateRoot,{recursive:true});
const lock=join(privateRoot,'demo-operator.lock');
mkdirSync(lock); // Exclusive operator execution. Preview writes must be quiescent for a reset.
try{
 let access=existsSync(accessPath)?JSON.parse(readFileSync(accessPath,'utf8')):null;
 if(!access){
   if(mode[0]!=='--provision-demo') throw new Error('No private registered Demo target exists. Run the explicit provisioning mode first.');
   if(initial.organizations.some(org=>org.name===DEMO_ORGANIZATION_NAME) || initial.identities.some(identity=>identity.email===email)) throw new Error('An unregistered Demo organization or reviewer already exists. Refusing to adopt or change it.');
   createBackup('BEFORE_DEMO_PROVISION',null);
   const created=await store.platformCreateOrganization(actor,DEMO_ORGANIZATION_NAME,policy);
   const password=randomBytes(30).toString('base64url');
   // Persist pending recovery information before accepting the one-time invite.
   privateWrite(join(privateRoot,'demo-provision-pending.json'),{...created,email,password,createdAt:new Date().toISOString()});
   const grant=await store.platformProvisionMembership(actor,created.organizationId,email,'ORG_OWNER',false,'User-authorized synthetic graduation reviewer organization; no real organization access.');
   if(!grant.invitationToken) throw new Error('New Demo reviewer unexpectedly already exists.');
   const demoAuth=new LocalAuthStore(authPath,created.workspaceId);
   await demoAuth.accept(grant.invitationToken,'Demo Reviewer',password);
   const state=demoAuth.read(),member=state.members.find(m=>m.email===email);
   if(!member) throw new Error('Reviewer acceptance did not create the expected scoped membership.');
   access={version:DEMO_CANONICAL_VERSION,...created,reviewerUserId:member.userId,reviewerMemberId:member.id,email,password,role:'ORG_OWNER',platformRole:null,asOf:DEMO_CUTOFF};
   privateWrite(accessPath,access);
   // Pending file has the same new credentials only; leave the final registered file authoritative.
   rmSync(join(privateRoot,'demo-provision-pending.json'));
   await restore(access,'DEMO_INITIAL_SEED');
 }else{
   const target=guard(access,mode[0]!=='--verify-demo');
   if(mode[0]!=='--verify-demo' && (canonical(target.organization.emailPolicy)!==canonical(policy) || !access.asOf)){
     createBackup('BEFORE_REGISTERED_DEMO_POLICY_TIGHTENING',access);
     if(canonical(target.organization.emailPolicy)!==canonical(policy)) await store.platformConfigurePolicy(actor,access.organizationId,policy);
     access={...access,asOf:DEMO_CUTOFF};privateWrite(accessPath,access);
   }
   if(mode[0]==='--reset-demo') await restore(access,'DEMO_CANONICAL_RESET');
 }
 guard(access);preserveExisting();
 console.log(JSON.stringify({status:'PASS',operation:mode[0],organization:DEMO_ORGANIZATION_NAME,organizationId:access.organizationId,workspaceId:access.workspaceId,reviewerEmail:email,reviewerRole:'ORG_OWNER',platformRole:null,existingCredentialsUnchanged:true,environmentUnchanged:true,otherWorkspaceDeliveryUnchanged:true,credentialsStoredPrivately:true}));
}finally{rmdirSync(lock);}
