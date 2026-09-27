"use server";
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireBusinessWriteAccess} from '@/lib/auth/access';
import {assertFormWorkspace} from '@/lib/auth/scope';
import {createManagedInitiative} from '@/lib/data/initiative-creation';
import type {BusinessLine,Stage} from '@/lib/domain/types';
export interface CreateInitiativeState {error:string|null;}
export async function createInitiativeAction(_previous:CreateInitiativeState,form:FormData):Promise<CreateInitiativeState>{
 let slug:string;
 try{const ctx=await requireBusinessWriteAccess();assertFormWorkspace(form,ctx);
 const value=(key:string)=>String(form.get(key)??'').trim();
 slug=await createManagedInitiative({requestId:value('clientRequestId'),name:value('name'),businessLine:value('businessLine') as BusinessLine,stage:value('stage') as Stage,ownerMemberId:value('ownerMemberId'),description:value('description'),contextLabel:value('contextLabel')},ctx.workspaceId);
 }catch(error){return {error:error instanceof Error?error.message:'The initiative could not be created.'};}
 revalidatePath('/initiatives');revalidatePath('/');redirect(`/initiatives/${slug}/setup?step=delivery&created=1`);
}
