'use server';
import {revalidatePath} from 'next/cache';
import {mutateDelivery} from '@/lib/delivery/repository';
import {recordFact,canonical} from '@/lib/delivery/model';
import type {FactKind,FactValue} from '@/lib/delivery/types';
import {assertFormWorkspace} from '@/lib/auth/scope';
export interface SetupSaveState {error:string|null;message:string|null;}
export async function saveSetupDelivery(_previous:SetupSaveState,form:FormData):Promise<SetupSaveState>{
 try{
  const text=(key:string)=>String(form.get(key)??'').trim();
  await mutateDelivery(async({ctx,source,state})=>{
   assertFormWorkspace(form,ctx);const snapshot=source.snapshots.find(s=>s.initiative.slug===text('slug'));if(!snapshot)throw new Error('Initiative unavailable.');
   if(snapshot.initiative.updatedAt!==text('expectedUpdatedAt'))throw new Error('The initiative context changed. Reload and review before saving.');
   let next=state;const now=new Date().toISOString();
   const save=(kind:FactKind,value:FactValue)=>{
    const old=next.facts.find(f=>f.initiativeId===snapshot.initiative.id&&f.kind===kind);
    const revision=Number(text(`${kind}:revision`));if(!Number.isSafeInteger(revision)||revision<0||(old?.revision??0)!==revision)throw new Error('A delivery field changed while you were editing. Reload and review; nothing was saved.');
    if(old?.state==='SET'&&canonical(old.value)===canonical(value))return;
    next=recordFact(next,source,ctx,{initiativeId:snapshot.initiative.id,kind,expectedRevision:revision,value,retract:false,basis:'DIRECT_KNOWLEDGE',note:text('reason'),evidenceId:null,locator:null},now);
   };
   const blank={date:null,text:null,memberId:null,extent:null};
   if(text('scope'))save('SCOPE',{...blank,text:text('scope')});
   for(const kind of ['TARGET_LIVE','DEV_STARTED','NEXT_MILESTONE'] as const){
    const mode=text(`${kind}:mode`);if(!mode)continue;
    if(!['KNOWN','UNKNOWN','DATE_UNKNOWN'].includes(mode)||(mode==='DATE_UNKNOWN'&&kind!=='NEXT_MILESTONE'))throw new Error('Choose a supported delivery state.');
    const value:FactValue=mode==='UNKNOWN'?{...blank,unknown:true}:{...blank,date:mode==='DATE_UNKNOWN'?null:text(`${kind}:date`)||null,text:kind==='NEXT_MILESTONE'?text(`${kind}:text`)||null:null,...(mode==='DATE_UNKNOWN'?{dateUnknown:true as const}:{})};
    if(kind==='NEXT_MILESTONE'&&mode==='KNOWN'&&!value.date)throw new Error('Record the milestone date or explicitly choose Date unknown.');
    save(kind,value);
   }
   return next;
  });
  revalidatePath('/initiatives','layout');revalidatePath('/');revalidatePath('/roadmap');revalidatePath('/weekly-review');
  return {error:null,message:'Delivery context saved. Continue to Sources or return later; previous revisions remain in history.'};
 }catch(error){return {error:error instanceof Error?error.message:'Delivery context could not be saved.',message:null};}
}
