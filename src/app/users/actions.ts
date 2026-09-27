'use server';
import { authErrorMessage } from '@/lib/auth/errors';
import {checkAdminScope,refreshAdministration} from '@/components/admin/action-support';
import {assertReviewedChange} from '@/components/admin/model';

import { revalidatePath } from 'next/cache';
import { inviteUser,rotateInvitation,changeMembership,renameWorkspace } from '@/lib/auth/service';
import type { Role } from '@/lib/auth/core';
import type { AuthFormState } from '@/components/auth/AuthForm';
const text=(form:FormData,key:string)=>String(form.get(key)??'');
export async function renameWorkspaceAction(_state:AuthFormState,form:FormData):Promise<AuthFormState> {
  try {await checkAdminScope(form);await renameWorkspace(text(form,'name'));refreshAdministration(form);revalidatePath('/');return {error:null,message:'Workspace name updated.'};}
  catch(error){return {error:authErrorMessage(error,'Could not update workspace configuration.')};}
}
export async function inviteAction(_state:AuthFormState,form:FormData):Promise<AuthFormState> {
  try {await checkAdminScope(form);const token=await inviteUser(text(form,'email'),text(form,'role') as Role);refreshAdministration(form);return {error:null,message:'Invitation created. Email delivery is not configured; share the link privately.',link:`/invite/${token}`};}
  catch(error){return {error:authErrorMessage(error,'Could not invite this person.')};}
}
export async function changeMemberAction(_state:AuthFormState,form:FormData):Promise<AuthFormState> {
  try {await checkAdminScope(form);assertReviewedChange(form);await changeMembership(text(form,'memberId'),text(form,'role') as Role,text(form,'active')==='true',text(form,'isProductLead')==='true');refreshAdministration(form);return {error:null,message:'Workspace access updated.'};}
  catch(error){return {error:authErrorMessage(error,'Could not update access.')};}
}
export async function invitationAction(_state:AuthFormState,form:FormData):Promise<AuthFormState> {
  try {await checkAdminScope(form);const token=await rotateInvitation(text(form,'inviteId'),text(form,'operation')==='revoke');refreshAdministration(form);return {error:null,message:token?'New invitation link created. The old link is invalid.':'Invitation revoked.',link:token?`/invite/${token}`:undefined};}
  catch(error){return {error:authErrorMessage(error,'Could not update invitation.')};}
}
