// Existing local demo only; secrets never enter reports or screenshots.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import nextEnv from '@next/env';
import {referencesFor,changesSince,latestBaseline,canonical,factFor} from '../../src/lib/delivery/model.ts';
import {draftWeeklyWording} from '../../src/lib/delivery/ai.ts';
nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}},true);
const dataPath='.data/prodwise-delivery-weekly.json';
const readState=()=>JSON.parse(readFileSync(dataPath,'utf8'));
const initial=readState();
const initialReview=initial.reviews.find(r=>r.week==='2026-W39');
assert.equal(initialReview?.status,'DRAFT');
const baseline=latestBaseline(initial,initialReview.workspaceId,initialReview.week);
assert.equal(baseline?.week,'2026-W38');
assert.equal(initialReview.baselineReviewId,baseline.id);
const records={at:new Date().toISOString(),localOnly:true,checks:[],realClaude:'BLOCKED',blocker:null};
const out=resolve('docs/ui-review/claude-live');mkdirSync(out,{recursive:true});
const pass=(name)=>{records.checks.push({name,status:'PASS'});console.log('PASS: '+name);};
const {chromium}=await import(pathToFileURL('C:/Users/mohamed.hibrahim/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({executablePath:'C:/Users/mohamed.hibrahim/.cache/puppeteer/chrome-headless-shell/win64-152.0.7977.54/chrome-headless-shell-win64/chrome-headless-shell.exe',headless:true});
try {
 const context=await browser.newContext({viewport:{width:1440,height:1100}});const page=await context.newPage();
 const admin=JSON.parse(readFileSync('.data/local-access.json','utf8')).find(a=>a.role==='Admin');
 await page.goto('http://127.0.0.1:3200/login');await page.locator('[name=email]').fill(admin.email);await page.locator('[name=password]').fill(admin.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(u=>u.pathname==='/');
 await page.goto('http://127.0.0.1:3200/weekly-review?week=2026-W39');
 assert.match(await page.locator('body').innerText(),/2026-W38 final review/);
 pass('Previous-final baseline is the existing W38 Final, not an invented weekly cutoff');
 const response=page.waitForResponse(r=>r.request().method()==='POST'&&r.request().headers()['next-action'],{timeout:60000});
 await page.getByRole('button',{name:'Draft wording with Claude',exact:true}).click();
 assert.ok((await response).status()<500);await page.reload();
 const after=readState();const review=after.reviews.find(r=>r.id===initialReview.id);const ai=review.aiDrafts.at(-1);
 assert.equal(review.aiDrafts.length,initialReview.aiDrafts.length+1,'A new persisted drafting result must be created');
 assert.equal(review.baselineReviewId,baseline.id);assert.equal(canonical(review.input),canonical(initialReview.input));
 assert.equal(canonical(after.reviews.find(r=>r.id===baseline.id)),canonical(baseline));
 assert.equal(canonical(after.facts),canonical(initial.facts));assert.equal(canonical(after.events),canonical(initial.events));
 assert.equal(review.status,'DRAFT');assert.equal(review.finalizedAt,null);
 pass('Drafting preserves confirmed facts, Target history, frozen inputs and immutable previous Final; no automatic finalization');
 const refs=referencesFor(review.input,baseline.input);let lineCount=0;
 assert.ok(ai.original.length>0,'Draft has initiative sections');
 for(const section of ai.original){assert.ok(review.sections.some(s=>s.initiativeId===section.initiativeId));for(const line of section.lines){const ref=refs.find(r=>r.id===line.referenceId&&r.initiativeId===section.initiativeId);assert.ok(ref,'Every line has a same-initiative supported reference');assert.ok(ref.texts.includes(line.text),'Every whole statement is exactly a permitted fact statement');lineCount++;}}
 assert.ok(lineCount>0,'Draft has supported wording');
 records.output={mode:ai.mode,model:ai.model,promptVersion:ai.promptVersion,inputDigest:ai.inputDigest,sectionCount:ai.original.length,lineCount,reason:ai.reason};
 pass('All saved wording matches supported same-initiative statements exactly; no invented facts accepted');
 const target=review.input.facts.find(f=>f.kind==='TARGET_LIVE'&&f.state==='SET');assert.equal(target.value.date,'2026-10-08');
 assert.equal(factFor(baseline.input.facts,target.initiativeId,'TARGET_LIVE').value.date,'2026-10-01');
 const change=changesSince(review.input,baseline.input).find(c=>c.kind==='TARGET_LIVE');assert.equal(change.days,7);assert.match(change.label,/2026-10-01 → 2026-10-08/);
 records.target={previous:'2026-10-01',current:'2026-10-08',daysLater:change.days,revision:target.revision};
 pass('Target Live comparison correctly reports Oct 1 → Oct 8, seven days later, with revision 2 preserved');
 const unknowns=[];
 for(const snapshot of review.input.snapshots){const section=page.locator('section').filter({has:page.getByRole('heading',{name:snapshot.initiative.name,exact:true})});assert.equal(await section.count(),1);const body=await section.innerText();if(!factFor(review.input.facts,snapshot.initiative.id,'TARGET_LIVE')){assert.match(body,/Target Live · planned\s*Unknown/);unknowns.push(snapshot.initiative.id+':TARGET_LIVE');}if(!factFor(review.input.facts,snapshot.initiative.id,'ACTUAL_LIVE')){assert.match(body,/Actual Live\s*Not recorded/);unknowns.push(snapshot.initiative.id+':ACTUAL_LIVE');}const milestone=factFor(review.input.facts,snapshot.initiative.id,'NEXT_MILESTONE');if(milestone&&!milestone.value.date)assert.match(body,/Date not recorded/);}
 assert.ok(unknowns.length>0);records.unknownFieldCount=unknowns.length;
 pass('Unknown Target/Actual dates stay unknown in the data and visible section facts; undated milestone remains undated');
 if(ai.mode==='CLAUDE'){
  assert.match(await page.locator('body').innerText(),/Wording selected and organized by Claude/);
  assert.equal(ai.reason,null);assert.ok(ai.model);assert.equal(ai.inputDigest,review.input.digest);
  for(const section of ai.original){const stored=review.sections.find(s=>s.initiativeId===section.initiativeId);assert.equal(canonical(stored.aiOriginal),canonical(section.lines));assert.equal(stored.needsRecheck,true);}
  records.realClaude='PASS';pass('Real server-side Claude result persisted and visibly marked Claude; original wording retained and human review required');
 }else{
  assert.equal(ai.mode,'TEMPLATE');assert.match(await page.locator('body').innerText(),/not generated by AI|factual template|factual template was used/i);
  records.blocker=!process.env.ANTHROPIC_API_KEY?.trim()?'ANTHROPIC_API_KEY is empty or unavailable in the local server configuration':!process.env.ANTHROPIC_MODEL?.trim()?'ANTHROPIC_MODEL is empty or unavailable':ai.reason;
  pass('Actual UI fallback is truthfully labelled as a template, without a Claude success claim');
 }
 await page.screenshot({path:resolve(out,ai.mode==='CLAUDE'?'claude-weekly-1440.png':'template-weekly-1440.png'),fullPage:true,caret:'initial'});
 const member=review.input.members.find(m=>m.role==='Admin'&&m.active);const ctx={workspaceId:review.workspaceId,memberId:member.id,role:member.role,isProductLead:member.isProductLead,actor:{id:member.id,label:member.displayName}};
 const oldKey=process.env.ANTHROPIC_API_KEY;const oldModel=process.env.ANTHROPIC_MODEL;
 try{
  delete process.env.ANTHROPIC_API_KEY;delete process.env.ANTHROPIC_MODEL;
  const missing=await draftWeeklyWording(review,baseline.input,ctx,async()=>{throw new Error('Must not call provider');});assert.equal(missing.mode,'TEMPLATE');assert.match(missing.reason,/not generated by AI/);
  process.env.ANTHROPIC_API_KEY='test-only-not-a-secret';process.env.ANTHROPIC_MODEL='test-only-unavailable';
  const unavailable=await draftWeeklyWording(review,baseline.input,ctx,async()=>Response.json({error:{type:'overloaded_error'}},{status:503}));assert.equal(unavailable.mode,'TEMPLATE');
  const transport=await draftWeeklyWording(review,baseline.input,ctx,async()=>{throw new Error('Test transport failure');});assert.equal(transport.mode,'TEMPLATE');
  const invented=await draftWeeklyWording(review,baseline.input,ctx,async()=>Response.json({content:[{type:'text',text:JSON.stringify({sections:[{initiativeId:target.initiativeId,lines:[{referenceId:'fact:'+target.id+':'+target.revision,text:'Actual launch completed tomorrow; all risks are resolved.'}]}]})}]}));assert.equal(invented.mode,'TEMPLATE');
  for(const fallback of [missing,unavailable,transport,invented])for(const section of fallback.original)for(const line of section.lines){assert.ok(refs.find(r=>r.id===line.referenceId&&r.initiativeId===section.initiativeId)?.texts.includes(line.text));}
  pass('Missing config, HTTP 503, transport failure and unsupported/invented wording all use factual template fallback (controlled fault injection)');
 }finally{if(oldKey===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=oldKey;if(oldModel===undefined)delete process.env.ANTHROPIC_MODEL;else process.env.ANTHROPIC_MODEL=oldModel;}
 await context.close();
}catch(error){records.failure=error.message;records.realClaude='FAIL';process.exitCode=1;console.log('FAIL: '+error.message);}
finally{writeFileSync(resolve(out,'results.json'),JSON.stringify(records,null,2));await browser.close();}
console.log(JSON.stringify({realClaude:records.realClaude,passedChecks:records.checks.length,blocker:records.blocker},null,2));
