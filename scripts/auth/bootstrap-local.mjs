import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LocalAuthStore, contextForMember } from '../../src/lib/auth/core.ts';
if (process.env.NODE_ENV==='production' || process.env.VERCEL_ENV) throw new Error('Local/test bootstrap only. Hosted account creation is not supported.');
const directory=resolve('.data');
const path=resolve('.data/auth.json'), envPath=resolve('.env.local');
if (existsSync(path)||existsSync(envPath)) throw new Error('Existing local auth/env found. Preserve it; bootstrap only an empty isolated checkout.');
mkdirSync(directory,{recursive:true});
const workspaceId='10000000-0000-4000-8000-000000000001';
const store=new LocalAuthStore(path,workspaceId);
const password=()=>randomBytes(24).toString('base64url');
const identities=[{email:'owner.demo@aman.eg',name:'Demo Owner',role:'ORG_OWNER',password:password()},
  {email:'pm.demo@aman.eg',name:'Demo PM',role:'MEMBER',password:password()},
  {email:'reviewer.demo@aman.eg',name:'Demo Reviewer',role:'VIEWER',password:password()}];
const admin=store.bootstrap(identities[0].email,identities[0].name,identities[0].password,{id:'40000000-0000-4000-8000-000000000001',name:'AMAN local fixture',emailPolicy:{domains:['aman.eg','rayacorp.com'],exactEmails:[]}});
const ctx=contextForMember(admin,workspaceId);
for(const item of identities.slice(1)) { const token=await store.invite(ctx,item.email,item.role);await store.accept(token,item.name,item.password); }
writeFileSync(resolve('.data/local-access.json'),JSON.stringify(identities,null,2),{flag:'wx',mode:0o600});
writeFileSync(envPath,`AUTH_MODE=local\nPRODWISE_WORKSPACE_ID=${workspaceId}\nAUTH_SESSION_SECRET=${randomBytes(48).toString('base64url')}\nDEMO_WRITE_ENABLED=true\nMANAGEMENT_WRITE_ENABLED=true\n`,{flag:'wx',mode:0o600});
console.log('Private fictional identities saved to ignored .data/local-access.json. Local preview is ready; run Next dev on the assigned port. No hosted account was created.');
