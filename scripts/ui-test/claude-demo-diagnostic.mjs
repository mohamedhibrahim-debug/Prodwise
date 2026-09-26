// Reports provider status and validation metadata only. Never headers or raw output.
import {readFileSync,writeFileSync} from 'node:fs';
import nextEnv from '@next/env';
import {draftWeeklyWording} from '../../src/lib/delivery/ai.ts';
import {referencesFor,latestBaseline} from '../../src/lib/delivery/model.ts';
import {validateDraft} from '../../src/lib/delivery/ai-validation.ts';
nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
const a=JSON.parse(readFileSync('.data/demo-access.json','utf8')),s=JSON.parse(readFileSync(`.data/delivery/${a.workspaceId}.json`,'utf8')),r=s.reviews.find(x=>x.week==='2026-W39'),b=latestBaseline(s,a.workspaceId,r.week);
const ctx={workspaceId:a.workspaceId,organizationId:a.organizationId,memberId:a.reviewerMemberId,actor:{id:a.reviewerUserId,label:'Demo Reviewer'},platformRole:null,role:'ORG_OWNER',isProductLead:false};
const result={at:new Date().toISOString(),model:process.env.ANTHROPIC_MODEL,keyPresent:!!process.env.ANTHROPIC_API_KEY?.trim()};const start=Date.now();
const draft=await draftWeeklyWording(r,b?.input??null,ctx,async(...args)=>{try{if(process.argv.includes('--long-timeout'))args[1]={...args[1],signal:AbortSignal.timeout(90000)};const response=await fetch(...args);result.http=response.status;const data=await response.clone().json();result.stopReason=data.stop_reason??null;result.errorType=data.error?.type??null;try{const text=(data.content??[]).filter(c=>c.type==='text').map(c=>c.text??'').join('');const parsed=JSON.parse(text);validateDraft(parsed,referencesFor(r.input,b?.input??null));result.validated=true;}catch{result.validated=false;}return response;}catch(error){result.transportError=error.name;throw error;}});
result.elapsedMs=Date.now()-start;result.mode=draft.mode;result.reason=draft.reason;writeFileSync('.data/claude-demo-diagnostic.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
