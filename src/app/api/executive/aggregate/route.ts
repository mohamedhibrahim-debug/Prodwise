import { randomUUID } from 'node:crypto';
import { mutateExecutive } from '@/lib/executive/repository';
import { money, validDay, validateProduct } from '@/lib/executive/model';
import { revalidatePath } from 'next/cache';
import { assertPerformanceApproval } from '@/lib/executive/access';
export async function POST(request:Request) {
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Origin not allowed.'},{status:403});
  try {
    if(Number(request.headers.get('content-length'))>20_000)throw Error('Entry is too large.');
    const input=await request.json();const text=(k:string)=>typeof input[k]==='string'?input[k].trim():'';
    const start=text('start'),end=text('end'),source=text('source');
    if(!validDay(start)||!validDay(end)||start>end||!source||source.length>2000)throw Error('Enter a valid reporting interval and source.');
    const now=new Date().toISOString();
    await mutateExecutive(text('workspaceId'),(state,ctx)=>{
      assertPerformanceApproval(ctx);
      if(input.mode==='target'){
        const product=validateProduct(input.product),month=text('month');
        if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Select a valid target month.');
        if(state.targets.some(t=>t.product===product&&t.month===month))throw Error('A target already exists for this month. Target revisions require review; nothing was overwritten.');
        return {...state,targets:[...state.targets,{id:randomUUID(),product,month,amount:money(input.amount),basis:source,approvedBy:ctx.actor.label,approvedAt:now}]};
      }
      if(state.aggregates.some(a=>a.product==='SALEFNY'&&a.start<=end&&a.end>=start))throw Error('An overlapping Salefny aggregate already exists. Keep non-overlapping source periods; nothing was added.');
      const amount=(k:string)=>text(k)===''?null:money(text(k));
      const count=(k:string)=>{if(!text(k))return null;if(!/^\d+$/.test(text(k))||!Number.isSafeInteger(Number(text(k))))throw Error('Counts must be non-negative whole numbers.');return Number(text(k));};
      const values={principal:amount('principal'),fees:amount('fees'),collected:amount('collected'),remaining:amount('remaining'),issuedCount:count('issuedCount'),onboarded:count('onboarded')};
      if(Object.values(values).every(v=>v===null))throw Error('Enter at least one reported value.');
      return {...state,aggregates:[...state.aggregates,{id:randomUUID(),product:'SALEFNY',start,end,source,note:text('note').slice(0,2000),values,recordedAt:now,recordedBy:ctx.actor.label}]};
    });
    revalidatePath('/analysis/business');return Response.json({ok:true});
  }catch(e){return Response.json({error:e instanceof Error?e.message:'Could not save.'},{status:400});}
}
