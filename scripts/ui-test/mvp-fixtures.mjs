// Private fictional identities for the isolated local acceptance test only.
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { LocalAuthStore, contextForMember } from '../../src/lib/auth/core.ts';
if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV) throw Error('Local acceptance fixtures only');
const store = new LocalAuthStore('.data/auth.json', '10000000-0000-4000-8000-000000000001');
const identities = JSON.parse(readFileSync('.data/local-access.json', 'utf8'));
const ctx = contextForMember(store.read().members.find(m => m.role === 'Admin'), store.workspaceId);
for (const [email,name,lead] of [['lead@prodwise.test','Demo Product Lead',true],['pm2@prodwise.test','Demo PM Two',false]]) {
  if (identities.some(i => i.email === email)) continue;
  const password = randomBytes(24).toString('base64url');
  const token = await store.invite(ctx,email,'Member');
  await store.accept(token,name,password);
  const member = store.read().members.find(m => m.email === email);
  if (lead) await store.change(ctx,member.id,'Member',true,true);
  identities.push({email,name,role:'Member',password});
}
writeFileSync('.data/local-access.json',JSON.stringify(identities,null,2),{mode:0o600});
console.log('Private PM and Product Lead test identities ready. No credentials printed.');
