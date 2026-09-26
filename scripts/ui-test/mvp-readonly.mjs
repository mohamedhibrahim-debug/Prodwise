import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL('C:/Users/mohamed.hibrahim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({executablePath:'C:/Users/mohamed.hibrahim/.cache/puppeteer/chrome-headless-shell/win64-152.0.7977.54/chrome-headless-shell-win64/chrome-headless-shell.exe',headless:true});
const base='http://127.0.0.1:3200';const out='docs/ui-review/mvp-integration';const identities=JSON.parse(readFileSync('.data/local-access.json','utf8'));const checks=[];
function pass(name){checks.push(name);console.log('PASS: '+name);}
try {
 const before=readFileSync('.data/prodwise-delivery-weekly.json','utf8');
 for(const email of ['admin@prodwise.test','reviewer@prodwise.test']){
  const ctx=await browser.newContext({viewport:{width:1440,height:1100}});const page=await ctx.newPage();const identity=identities.find(i=>i.email===email);await page.goto(base+'/login');await page.locator('[name=email]').fill(email);await page.locator('[name=password]').fill(identity.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(url=>url.pathname==='/');assert.match(await page.locator('body').innerText(),/Environment: business changes disabled/);
  await page.goto(base+'/weekly-review?week=2026-W39');if(email.startsWith('admin')){assert.match(await page.locator('body').innerText(),/Changes are disabled in this environment/);const buttons=page.getByRole('button',{name:/Draft wording with Claude|Finalize reviewed portfolio|Refresh delivery inputs|Save and mark section reviewed/});assert.ok(await buttons.count()>0);for(let i=0;i<await buttons.count();i++)assert.ok(await buttons.nth(i).isDisabled());await page.screenshot({path:out+'/environment-disabled-1440.png',fullPage:false,caret:'initial'});await page.goto(base+'/users');for(const button of await page.getByRole('button',{name:'Update access',exact:true}).all())assert.ok(await button.isDisabled());pass('Admin role unchanged; environment restriction disables weekly and management controls');}
  else {assert.match(await page.locator('body').innerText(),/Role: Viewer.*View-only/);assert.match(await page.locator('body').innerText(),/Viewer access/);assert.equal(await page.getByRole('button',{name:/Draft wording with Claude|Save and mark section reviewed/}).count(),0);pass('Viewer restriction and disabled environment remain independently visible');}
  await ctx.close();
 }
 assert.equal(readFileSync('.data/prodwise-delivery-weekly.json','utf8'),before);pass('Read-only environment retains existing delivery truth without mutation');
}finally{writeFileSync(out+'/readonly-results.json',JSON.stringify({checks,passed:checks.length,at:new Date().toISOString()},null,2));await browser.close();}
