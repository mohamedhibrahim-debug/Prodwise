import assert from 'node:assert/strict';
import { readFileSync,mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const {chromium}=await import(pathToFileURL('C:/Users/mohamed.hibrahim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({executablePath:'C:/Users/mohamed.hibrahim/.cache/puppeteer/chrome-headless-shell/win64-152.0.7977.54/chrome-headless-shell-win64/chrome-headless-shell.exe',headless:true});
const base='http://127.0.0.1:3200',out=resolve('docs/ui-review/delivery-final');mkdirSync(out,{recursive:true});
const credentials=JSON.parse(readFileSync('.data/local-access.json','utf8')),account=credentials.find(c=>c.email==='mohamed.hibrahim@aman.eg');
assert.ok(account,'Existing local account required');
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],checks=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try {
 await page.goto(base+'/login');await page.locator('[name=email]').fill(account.email);await page.locator('[name=password]').fill(account.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(url=>url.pathname==='/');
 for(const width of [390,768,1024,1440]){
  await page.setViewportSize({width,height:1000});
  for(const [route,label] of [['/roadmap','roadmap'],['/weekly-review','weekly-review']]){
   await page.goto(base+route);await page.getByRole('heading',{name:label==='roadmap'?'Roadmap':'Weekly Product Review',exact:true}).waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow '+label+' '+width);
   if(label==='roadmap'){assert.match(await page.locator('body').innerText(),/Missing Actual Live does not mean/);assert.equal(await page.locator('input[name=cutoff]').count(),1);}
   await page.screenshot({path:resolve(out,label+'-'+width+'.png'),fullPage:true});checks.push(label+' '+width+' no overflow');
  }
 }
 assert.deepEqual(errors,[],'Browser errors detected');writeFileSync(resolve(out,'results.json'),JSON.stringify({passed:checks.length,checks,consoleErrors:errors},null,2));console.log(JSON.stringify({passed:checks.length,consoleErrors:errors.length}));
}finally{await browser.close();}
