import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync,mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { LocalAuthStore,contextForMember } from '../../src/lib/auth/core.ts';
const require=createRequire(import.meta.url);require('@next/env').loadEnvConfig(process.cwd(),true,{info(){},error(){}});
assert.equal(process.env.AUTH_MODE,'local');assert.ok(!process.env.VERCEL_ENV&&!process.env.VERCEL);
const {chromium}=await import(pathToFileURL('C:/Users/mohamed.hibrahim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({executablePath:'C:/Users/mohamed.hibrahim/.cache/puppeteer/chrome-headless-shell/win64-152.0.7977.54/chrome-headless-shell-win64/chrome-headless-shell.exe',headless:true});
const base='http://127.0.0.1:3200',out=resolve('docs/ui-review/platform-rbac');mkdirSync(out,{recursive:true});
const authPath=resolve('.data/auth.json'),store=new LocalAuthStore(authPath,process.env.PRODWISE_WORKSPACE_ID);
const credentials=JSON.parse(readFileSync('.data/local-access.json','utf8'));
const productBefore=readFileSync('.data/prodwise-delivery-weekly.json','utf8');
const checks=[],contexts=[],fixtureUsers=[];
function pass(name){checks.push(name);console.log('PASS: '+name);}
async function signin(email,password){
 const context=await browser.newContext({viewport:{width:1440,height:1100}});contexts.push(context);const page=await context.newPage();
 await page.goto(base+'/login');await page.locator('[name=email]').fill(email);await page.locator('[name=password]').fill(password??credentials.find(item=>item.email===email).password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(url=>url.pathname==='/');
 return {context,page};
}
function detail(page,text){return page.locator('details').filter({has:page.getByText(text,{exact:true})});}
async function open(page,text){const box=detail(page,text);await box.locator('summary').click();return box.locator('form');}
async function submit(page,form,label){const response=page.waitForResponse(result=>result.request().method()==='POST'&&result.request().headers()['next-action']);await form.getByRole('button',{name:label,exact:true}).click();const result=await response;assert.ok(result.status()<500,'Local server action failed');await page.waitForTimeout(150);return result;}
async function screenshot(page,name){await page.screenshot({path:resolve(out,name+'.png'),fullPage:true});}
const ownerEmail='mohamed.hibrahim@aman.eg',secondEmail='mohamedhassanpe@outlook.com';
let replay;
try{
 const owner=await signin(ownerEmail),second=await signin(secondEmail);
 for(const session of [owner,second]){
  await session.page.goto(base+'/users');const body=await session.page.locator('body').innerText();
  assert.match(body,/Organization role: ORG_OWNER/);assert.match(body,/Platform role: PLATFORM_OWNER/);
  assert.equal(await session.page.locator('select[name=role] option[value=ORG_OWNER]').count(),0);
  assert.equal(await session.page.locator('select[name=role] option[value=PLATFORM_OWNER]').count(),0);
  await session.page.goto(base+'/platform');assert.equal(await session.page.getByRole('heading',{name:'Platform administration',exact:true}).count(),1);
 }
 pass('Both approved identities sign in with independent PLATFORM_OWNER and AMAN ORG_OWNER roles');
 await owner.page.goto(base+'/users');await screenshot(owner.page,'users-platform-owner-1440');
 await owner.page.goto(base+'/platform');await screenshot(owner.page,'platform-owner-1440');
 const ownerProjection=store.read(),actor=contextForMember(ownerProjection.members.find(member=>member.email===ownerEmail),store.workspaceId);
 const orgOwnerEmail='org-owner-gate-'+Date.now()+'@aman.eg',orgOwnerPassword=randomBytes(24).toString('base64url');
 const grant=await store.platformProvisionMembership(actor,actor.organizationId,orgOwnerEmail,'ORG_OWNER',false,'Fictional local role-gate Org Owner');
 await store.accept(grant.invitationToken,'Local Org Owner Gate',orgOwnerPassword);
 fixtureUsers.push(store.read().identities.find(identity=>identity.email===orgOwnerEmail).id);
 const orgOwner=await signin(orgOwnerEmail,orgOwnerPassword),admin=await signin('admin.demo@aman.eg');
 for(const session of [orgOwner,admin]){
  await session.page.goto(base+'/platform');assert.equal(await session.page.getByRole('heading',{name:'Platform administration is restricted',exact:true}).count(),1);
 }
 await admin.page.goto(base+'/users');assert.equal(await admin.page.locator('select[name=role] option[value=ADMIN]').count(),0);
 assert.equal(await admin.page.locator('select[name=role] option[value=ORG_OWNER]').count(),0);
 assert.equal(await admin.page.locator('select[name=role] option[value=PLATFORM_OWNER]').count(),0);
 const ownerRow=admin.page.getByRole('heading',{name:'Mohamed Ibrahim',exact:true}).locator('..').locator('..');
 assert.equal(await ownerRow.locator('form').count(),0);await screenshot(admin.page,'users-admin-1440');
 pass('Normal Admin and Org Owner cannot enter platform administration or assign owner/platform roles');
 const deniedInvite=await open(admin.page,'Invite a person');await deniedInvite.locator('[name=email]').fill('arbitrary-gate@outlook.com');
 await submit(admin.page,deniedInvite,'Create invitation');assert.ok(await deniedInvite.getByRole('alert').count());
 pass('Normal organization invitation rejects arbitrary Outlook email');
 await owner.page.goto(base+'/platform');
 owner.page.on('request',request=>{if(request.method()==='POST'&&request.headers()['next-action'])replay={url:request.url(),headers:request.headers(),body:request.postDataBuffer()};});
 const policy=await open(owner.page,'Access policy for AMAN');await submit(owner.page,policy,'Save organization policy');
 assert.ok(replay);const beforeReplay=readFileSync(authPath,'utf8');
 for(const session of [admin,orgOwner]){
  const response=await session.context.request.post(replay.url,{headers:{'next-action':replay.headers['next-action'],'content-type':replay.headers['content-type'],origin:base},data:replay.body});
  assert.ok(response.status()<500);assert.match(await response.text(),/Platform|platform|Could not/);assert.equal(readFileSync(authPath,'utf8'),beforeReplay);
 }
 pass('Forged platform server actions by Admin and Org Owner fail without changing state');
 await owner.page.goto(base+'/platform');const create=await open(owner.page,'Create organization');
 const bankName='Example Bank Local Gate '+Date.now();await create.locator('[name=name]').fill(bankName);await create.locator('[name=domains]').fill('examplebank.com');
 await submit(owner.page,create,'Create organization');await owner.page.reload();
 let state=store.read();const bank=state.organizations.find(org=>org.name===bankName);assert.ok(bank);
 assert.deepEqual(bank.emailPolicy,{domains:['examplebank.com'],exactEmails:[]});
 assert.deepEqual(state.organizations.find(org=>org.name==='AMAN').emailPolicy,{domains:['aman.eg','rayacorp.com'],exactEmails:[secondEmail]});
 pass('Example Bank stores an independent policy and inherits no AMAN domains or exception');
 const bankGrant=await open(owner.page,'Grant organization access for '+bankName);
 const bankEmail='owner-gate-'+Date.now()+'@examplebank.com',bankPassword=randomBytes(24).toString('base64url');
 await bankGrant.locator('[name=email]').fill(bankEmail);await bankGrant.locator('[name=role]').selectOption('ORG_OWNER');await bankGrant.locator('[name=reason]').fill('Fictional local cross-organization invitation gate');
 await submit(owner.page,bankGrant,'Grant organization access');const inviteURL=await bankGrant.locator('a[href*="/invite/"]').getAttribute('href');assert.ok(inviteURL);
 const setupContext=await browser.newContext();contexts.push(setupContext);const setup=await setupContext.newPage();await setup.goto(new URL(inviteURL,base).href);
 assert.equal(await setup.getByRole('heading',{name:'Set up your account',exact:true}).count(),1);
 await setup.locator('[name=displayName]').fill('Local Bank Owner Gate');await setup.locator('[name=password]').fill(bankPassword);await setup.locator('[name=confirmPassword]').fill(bankPassword);
 await submit(setup,setup.locator('form'),'Join workspace');
 state=store.read();const bankIdentity=state.identities.find(identity=>identity.email===bankEmail);assert.ok(bankIdentity);fixtureUsers.push(bankIdentity.id);
 assert.ok(state.memberships.some(member=>member.organizationId===bank.id&&member.userId===bankIdentity.id&&member.role==='ORG_OWNER'));
 const bankWorkspace=state.workspaces.find(workspace=>workspace.organizationId===bank.id),bankStore=new LocalAuthStore(authPath,bankWorkspace.id);
 const bankSession=await bankStore.login(bankEmail,bankPassword);assert.equal(bankStore.session(bankSession).role,'ORG_OWNER');
 const platformBankSession=await bankStore.login(ownerEmail,credentials.find(identity=>identity.email===ownerEmail).password),platformBankActor=bankStore.session(platformBankSession);
 assert.equal(platformBankActor.memberId,null);assert.equal(platformBankActor.role,null);assert.equal(platformBankActor.platformRole,'PLATFORM_OWNER');
 await assert.rejects(()=>bankStore.invite(bankStore.session(bankSession),secondEmail,'MEMBER'),{code:'EMAIL_NOT_ALLOWED'});
 pass('Foreign-org invitation resolves its own organization; Platform Owner enters it without fabricated membership');
 await owner.page.goto(base+'/platform');let access=await open(owner.page,'Grant organization access for AMAN');
 const outsiderEmail='override-gate-'+Date.now()+'@outlook.com',outsiderPassword=randomBytes(24).toString('base64url');
 await access.locator('[name=email]').fill(outsiderEmail);await access.locator('[name=role]').selectOption('MEMBER');await access.locator('[name=reason]').fill('Fictional explicit policy override gate');
 await submit(owner.page,access,'Grant organization access');assert.ok(await access.getByRole('alert').count());
 await access.locator('[name=email]').fill(outsiderEmail);await access.locator('[name=role]').selectOption('MEMBER');await access.locator('[name=reason]').fill('Fictional explicit policy override gate');
 await access.locator('[name=policyOverride]').check();await submit(owner.page,access,'Grant organization access');
 const outsiderURL=await access.locator('a[href*="/invite/"]').getAttribute('href');assert.ok(outsiderURL);
 await setup.goto(new URL(outsiderURL,base).href);await setup.locator('[name=displayName]').fill('Local Override Gate');await setup.locator('[name=password]').fill(outsiderPassword);await setup.locator('[name=confirmPassword]').fill(outsiderPassword);await submit(setup,setup.locator('form'),'Join workspace');
 await setup.waitForURL(url=>url.pathname==='/');
 state=store.read();const outsider=state.identities.find(identity=>identity.email===outsiderEmail),membership=state.memberships.find(member=>member.organizationId===actor.organizationId&&member.userId===outsider.id);
 fixtureUsers.push(outsider.id);assert.equal(membership.policyOverride,true);assert.equal(membership.policyOverrideReason,'Fictional explicit policy override gate');
 assert.equal(new LocalAuthStore(authPath,store.workspaceId).session(await store.login(outsiderEmail,outsiderPassword)).role,'MEMBER');
 assert.ok(state.events.some(event=>event.organizationId===actor.organizationId&&event.actorId===actor.actor.id&&event.policyOverridden===true));
 assert.deepEqual(state.organizations.find(org=>org.name==='AMAN').emailPolicy.exactEmails,[secondEmail]);
 pass('Policy override requires an explicit platform checkbox/reason, persists and does not broaden the allowlist');
 const viewer=await signin('reviewer.demo@aman.eg');await viewer.page.goto(base+'/initiatives/merchant-flex-finance/delivery');
 assert.equal(await viewer.page.getByRole('button',{name:'Confirm and save',exact:true}).count(),0);assert.match(await viewer.page.locator('body').innerText(),/Organization role: VIEWER.*View-only/);assert.match(await viewer.page.locator('body').innerText(),/Environment: business changes enabled/);
 pass('Viewer remains read-only; role and environment restrictions remain distinct');
 const lifecycleEmail='invitation-gate-'+Date.now()+'@aman.eg';
 const pending=await store.platformProvisionMembership(actor,actor.organizationId,lifecycleEmail,'MEMBER',false,'Fictional dedicated invitation lifecycle gate');
 const pendingInvite=store.read().invitations.find(invite=>invite.email===lifecycleEmail);
 await admin.page.goto(base+'/users');const normalInviteRow=admin.page.getByText(lifecycleEmail,{exact:true}).locator('..').locator('..');
 assert.equal(await normalInviteRow.locator('form').count(),0);assert.match(await normalInviteRow.innerText(),/Managed in Platform administration/);
 await owner.page.goto(base+'/platform');let platformInviteRow=owner.page.getByText(lifecycleEmail,{exact:true}).locator('..').locator('..');
 let rotate=platformInviteRow.locator('form');await rotate.locator('[name=reason]').fill('Fictional local resend gate');await submit(owner.page,rotate,'Update platform invitation');
 const rotatedURL=await rotate.locator('a[href*="/invite/"]').getAttribute('href');assert.ok(rotatedURL);
 const rotatedToken=new URL(rotatedURL,base).pathname.split('/').at(-1);
 assert.throws(()=>store.invitation(pending.invitationToken),{code:'INVITE_INVALID'});assert.equal(store.invitation(rotatedToken).email,lifecycleEmail);
 const refreshed=store.read().invitations.find(invite=>invite.id===pendingInvite.id);assert.ok(Date.parse(refreshed.expiresAt)>Date.now()+6.9*86400000);
 await owner.page.reload();platformInviteRow=owner.page.getByText(lifecycleEmail,{exact:true}).locator('..').locator('..');rotate=platformInviteRow.locator('form');
 await rotate.locator('[name=operation]').selectOption('revoke');await rotate.locator('[name=reason]').fill('Fictional local revoke gate');await submit(owner.page,rotate,'Update platform invitation');
 assert.throws(()=>store.invitation(rotatedToken),{code:'INVITE_INVALID'});
 pass('Dedicated platform invitation resend/revoke works; normal User Management cannot alter it');
 for(const width of [390,1440]){await owner.page.setViewportSize({width,height:1100});await owner.page.goto(base+'/platform');assert.ok(await owner.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await screenshot(owner.page,'platform-owner-'+width);}
 await owner.page.setViewportSize({width:1440,height:1100});await owner.page.goto(base+'/platform');await owner.page.screenshot({path:resolve(out,'platform-overview-1440.png'),fullPage:false});
 assert.equal(readFileSync('.data/prodwise-delivery-weekly.json','utf8'),productBefore);
 pass('Platform surfaces fit mobile/desktop; delivery facts, Target Live history and finalized Weekly Reviews remain unchanged');
}finally{
 if(fixtureUsers.length)await store.mutate(state=>{for(const member of state.memberships.filter(member=>fixtureUsers.includes(member.userId)))member.active=false;for(const org of state.organizations){if(!state.memberships.some(member=>member.organizationId===org.id&&member.active&&member.role==='ORG_OWNER')){org.status='BOOTSTRAPPING';for(const workspace of state.workspaces.filter(workspace=>workspace.organizationId===org.id))workspace.status='BOOTSTRAPPING';}}state.sessions=state.sessions.filter(session=>!fixtureUsers.includes(session.userId));},true);
 writeFileSync(resolve(out,'results.json'),JSON.stringify({passed:checks.length,checks,at:new Date().toISOString(),scope:'Local integration only; no production/provider changes'},null,2));
 for(const context of contexts)await context.close();await browser.close();
}
