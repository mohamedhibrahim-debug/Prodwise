import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { passwordHash, LocalAuthStore, contextForMember } from '../../src/lib/auth/core.ts';
const require=createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd(),true,{info(){},error(){}});
if(process.env.AUTH_MODE!=='local'||process.env.NODE_ENV==='production'||process.env.VERCEL_ENV||process.env.VERCEL)throw new Error('This operator tool only provisions the isolated local integration workspace.');
if(!process.argv.includes('--approved-local-bootstrap'))throw new Error('Explicit local bootstrap acknowledgement is required.');
const envPath=resolve('.env.local'),authPath=resolve('.data/auth.json'),accessPath=resolve('.data/local-access.json');
const git=(args)=>{const result=spawnSync('git',args,{encoding:'utf8'});if(result.status!==0)throw new Error('Local Git safety check failed.');return result.stdout.trim();};
if(git(['ls-files','--','.env.local'])||!git(['check-ignore','.env.local']))throw new Error('The local environment must be ignored and untracked.');
const envDigest=()=>createHash('sha256').update(readFileSync(envPath)).digest('hex');
const envBefore=envDigest(),configuredWorkspaceId=process.env.PRODWISE_WORKSPACE_ID;
const approved=[
 {email:'mohamed.hibrahim@aman.eg',name:'Mohamed Ibrahim',platformRole:'PLATFORM_OWNER',role:'ORG_OWNER'},
 {email:'mohamedhassanpe@outlook.com',name:'Mohamed Hassan',platformRole:'PLATFORM_OWNER',role:'ORG_OWNER'},
];
const organizationId='40000000-0000-4000-8000-000000000001';
const policy={domains:['aman.eg','rayacorp.com'],exactEmails:['mohamedhassanpe@outlook.com']};
const lock=authPath+'.lock';
mkdirSync(lock); // Never bypass the application's exclusive persistence lock.
let temporary;
try{
 const raw=JSON.parse(readFileSync(authPath,'utf8'));
 const access=JSON.parse(readFileSync(accessPath,'utf8'));
 const oldWorkspace=raw.schema===2?raw.workspaces.find(w=>w.id===configuredWorkspaceId):raw.workspace;
 if(!oldWorkspace||oldWorkspace.id!==configuredWorkspaceId)throw new Error('The selected local workspace does not match its environment.');
 if(raw.schema===2&&oldWorkspace.organizationId!==organizationId)throw new Error('Existing organization binding differs. Refusing to replace it.');
 let state;
 if(raw.schema===2)state=raw;
 else{
  const identities=raw.members.map(member=>({id:member.userId,email:member.email,displayName:member.displayName,passwordHash:member.passwordHash,authUserId:member.authUserId??null,active:true,platformRole:null}));
  const memberships=raw.members.map(member=>({id:member.id,organizationId,userId:member.userId,role:member.role.toUpperCase()==='OWNER'?'ORG_OWNER':member.role.toUpperCase(),isProductLead:member.isProductLead,active:member.active,policyOverride:false,policyOverrideReason:null}));
  state={schema:2,workspaces:[{...oldWorkspace,organizationId}],organizations:[{id:organizationId,name:'AMAN',status:'ACTIVE',emailPolicy:policy}],identities,memberships,
   invitations:raw.invitations.map(invite=>({...invite,organizationId,role:invite.role.toUpperCase(),provisionedByPlatform:false,policyOverride:false,policyOverrideReason:null})),
   sessions:[],events:raw.events.map(event=>({...event,organizationId}))};
 }
 const organization=state.organizations.find(o=>o.id===organizationId);
 if(!organization)throw new Error('AMAN organization is missing.');
 organization.name='AMAN';organization.status='ACTIVE';organization.emailPolicy=policy;
 state.workspaces.find(workspace=>workspace.id===configuredWorkspaceId).status='ACTIVE';
 const now=new Date().toISOString();
 // Preserve fixture IDs, passwords and names. Only known fictional addresses are
 // moved into the explicitly configured local AMAN organization policy.
 for(const identity of state.identities){
  if(identity.email.endsWith('@prodwise.test')&&identity.displayName.startsWith('Demo ')){
   const prior=identity.email;identity.email=prior.split('@')[0]+'.demo@aman.eg';
   const credential=access.find(item=>item.email===prior);
   if(credential)credential.email=identity.email;
  }
 }
 for(const grant of approved){
  let identity=state.identities.find(user=>user.email===grant.email);
  if(!identity){
   const password=randomBytes(24).toString('base64url');
   identity={id:randomUUID(),email:grant.email,displayName:grant.name,passwordHash:passwordHash(password),authUserId:null,active:true,platformRole:null};
   state.identities.push(identity);access.push({...grant,password,userId:identity.id});
  }
  if(!identity.active)throw new Error('An approved identity is inactive; explicit recovery is required.');
  const platformBefore=identity.platformRole;
  let membership=state.memberships.find(member=>member.organizationId===organizationId&&member.userId===identity.id);
  const roleBefore=membership?.role??null;
  if(!membership){membership={id:randomUUID(),organizationId,userId:identity.id,role:grant.role,isProductLead:false,active:true,policyOverride:false,policyOverrideReason:null};state.memberships.push(membership);}
  membership.role=grant.role;membership.active=true;membership.policyOverride=false;membership.policyOverrideReason=null;
  const credential=access.find(item=>item.email===grant.email);
  if(credential){credential.role=grant.role;credential.platformRole=identity.platformRole;}
  const actor=state.identities.find(user=>user.email===approved[0].email)??identity;
  if(roleBefore!==grant.role)state.events.push({
   id:randomUUID(),workspaceId:configuredWorkspaceId,organizationId,actorId:actor.id,actorLabel:'Explicitly authorized local platform bootstrap',
   targetId:identity.id,targetUserId:identity.id,role:grant.role,action:'LOCAL_PLATFORM_BOOTSTRAP',at:now,policyOverridden:false,
   reason:'User-approved local provisioning of the two platform owners and AMAN organization owners.',
   before:{platformRole:platformBefore,role:roleBefore},after:{platformRole:identity.platformRole,role:grant.role},
  });
 }
 if(!state.memberships.some(member=>member.organizationId===organizationId&&member.active&&member.role==='ORG_OWNER'))throw new Error('An active organization requires an active Org Owner.');
 if(!existsSync(resolve('.data/auth-before-platform-bootstrap.json')))writeFileSync(resolve('.data/auth-before-platform-bootstrap.json'),JSON.stringify(raw,null,2),{flag:'wx',mode:0o600});
 writeFileSync(accessPath,JSON.stringify(access,null,2),{mode:0o600});
 temporary=authPath+'.'+randomUUID()+'.tmp';writeFileSync(temporary,JSON.stringify(state,null,2),{mode:0o600});renameSync(temporary,authPath);
 if(envDigest()!==envBefore)throw new Error('The environment file changed during provisioning.');
}finally{if(temporary&&existsSync(temporary))rmSync(temporary);rmSync(lock,{recursive:true});}
const store=new LocalAuthStore(authPath,configuredWorkspaceId);
let projection=store.read();
const first=projection.identities.find(identity=>identity.email===approved[0].email);
if(!projection.identities.some(identity=>identity.platformRole==='PLATFORM_OWNER'))await store.bootstrapPlatformOwner(first.id);
projection=store.read();
const actorMember=projection.members.find(member=>member.userId===first.id);
if(actorMember.platformRole!=='PLATFORM_OWNER')throw new Error('The approved bootstrap identity does not have platform authority. An existing Platform Owner must grant it explicitly.');
const actor=contextForMember(actorMember,configuredWorkspaceId);
for(const grant of approved){
 const identity=store.read().identities.find(user=>user.email===grant.email);
 if(identity.platformRole!=='PLATFORM_OWNER')await store.grantPlatformOwner(actor,identity.id,'User-approved local provisioning of the second global Platform Owner.');
}
const access=JSON.parse(readFileSync(accessPath,'utf8'));
for(const credential of access){const member=store.read().members.find(item=>item.email===credential.email);if(member){credential.role=member.role;credential.platformRole=member.platformRole;}}
writeFileSync(accessPath,JSON.stringify(access,null,2),{mode:0o600});
if(envDigest()!==envBefore)throw new Error('The environment file changed during provisioning.');
console.log('PASS: both approved local identities provisioned with persisted PLATFORM_OWNER and AMAN ORG_OWNER roles. Private credentials remain ignored. Environment unchanged.');
