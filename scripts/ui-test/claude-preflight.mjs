// Local provider discovery: never print secrets, request headers, or raw errors.
import { readFileSync, writeFileSync } from 'node:fs';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd(), true, {info(){},error(){}});
const key=process.env.ANTHROPIC_API_KEY?.trim();
const report={at:new Date().toISOString(),keyConfigured:Boolean(key),modelConfigured:Boolean(process.env.ANTHROPIC_MODEL?.trim())};
try {
  if(!key) throw new Error('KEY_NOT_CONFIGURED');
  const response=await fetch('https://api.anthropic.com/v1/models?limit=100',{headers:{'x-api-key':key,'anthropic-version':'2023-06-01'},signal:AbortSignal.timeout(20000)});
  report.httpStatus=response.status;
  const data=await response.json();
  if(!response.ok){report.errorType=data?.error?.type??'provider_error';report.pass=false;}
  else {
    const models=(data.data??[]).map(m=>({id:m.id,name:m.display_name,created:m.created_at}));
    report.availableModels=models;
    let model=process.env.ANTHROPIC_MODEL?.trim();
    if(!model){
      const candidates=models.filter(m=>m.id.includes('sonnet')).sort((a,b)=>b.created.localeCompare(a.created));
      model=candidates[0]?.id;
      if(!model) throw new Error('NO_SONNET_MODEL_AVAILABLE');
      const envPath='.env.local';const envText=readFileSync(envPath,'utf8');
      const line='ANTHROPIC_MODEL='+model;
      writeFileSync(envPath,/^ANTHROPIC_MODEL\s*=.*$/m.test(envText)?envText.replace(/^ANTHROPIC_MODEL\s*=.*$/m,line):envText+'\n'+line+'\n');
      report.modelSetLocally=true;
    }
    report.selectedModel=model;report.pass=true;
  }
}catch(error){report.pass=false;report.blocker=['KEY_NOT_CONFIGURED','NO_SONNET_MODEL_AVAILABLE'].includes(error.message)?error.message:'NETWORK_OR_PROVIDER_UNAVAILABLE';}
writeFileSync('.data/claude-preflight.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(!report.pass)process.exitCode=1;
