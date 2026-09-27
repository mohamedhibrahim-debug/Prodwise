'use server';
import {revalidatePath} from 'next/cache';
import {requireBusinessWriteAccess} from '@/lib/auth/access';
import {assertFormWorkspace} from '@/lib/auth/scope';
import {getRepository} from '@/lib/data';
import {saveCommitment} from '@/lib/data/commitments';
import type {ActionStatus} from '@/lib/workspace/commitments';
export async function commitmentAction(_previous:{error:string|null;id?:string},form:FormData):Promise<{error:string|null;id?:string}>{
 try{const ctx=await requireBusinessWriteAccess();assertFormWorkspace(form,ctx);const text=(k:string)=>String(form.get(k)??'').trim();const i=await getRepository().getInitiativeBySlug(text('slug'));if(!i)throw Error('Initiative unavailable.');const id=await saveCommitment({weekly:text('reviewId')?{reviewId:text('reviewId'),reviewRevision:Number(text('reviewRevision')),line:text('reviewLine')}:undefined,id:text('id')||undefined,requestId:text('requestId'),expectedRevision:Number(text('revision')),title:text('title'),assigneeMemberId:text('assigneeMemberId')||null,dueDate:text('dueDate')||null,status:text('status') as ActionStatus,blockedNote:text('blockedNote')||null,evidenceId:text('evidenceId')||null,note:text('note')},i.id,ctx.workspaceId);return {error:null,id};}
 catch(error){return {error:error instanceof Error?error.message:'Commitment was not saved.'};}
 finally{revalidatePath('/initiatives','layout');revalidatePath('/');revalidatePath('/weekly-review');}
}
