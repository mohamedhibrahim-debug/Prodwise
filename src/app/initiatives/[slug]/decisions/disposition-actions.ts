'use server';
import {revalidatePath} from 'next/cache';
import {requireBusinessWriteAccess} from '@/lib/auth/access';
import {assertFormWorkspace} from '@/lib/auth/scope';
import {recordDisposition} from '@/lib/review/dispositions-service';
import type {DispositionResult,DispositionKind} from '@/lib/review/dispositions';
export type QueueActionState={result:DispositionResult|null;error:string|null};
export async function dispositionAction(_previous:QueueActionState,form:FormData):Promise<QueueActionState>{
 try{const ctx=await requireBusinessWriteAccess();assertFormWorkspace(form,ctx);const text=(key:string)=>String(form.get(key)??'');const result=await recordDisposition({workspaceId:ctx.workspaceId,initiativeId:text('initiativeId'),findingId:text('findingId'),kind:text('kind') as DispositionKind,reason:text('reason'),deferUntil:text('mode')==='date'?text('deferUntil')||null:null,deferUntilNextReview:text('kind')==='DEFERRED'&&text('mode')==='review',expectedDigest:text('expectedDigest'),expectedLatestDispositionId:text('expectedLatestDispositionId')||null,clientRequestId:text('clientRequestId')});
 if(result.code==='ok'){revalidatePath('/');revalidatePath('/initiatives','layout');revalidatePath('/roadmap');revalidatePath('/analysis','layout');revalidatePath('/weekly-review');}return {result,error:result.code==='ok'?null:result.message};
 }catch{return {result:null,error:"Couldn't record this. Nothing changed. Retry."};}
}
