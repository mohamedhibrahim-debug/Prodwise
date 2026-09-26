'use server';
import { authErrorMessage } from '@/lib/auth/errors';

import { redirect } from 'next/navigation';
import { acceptInvitation, inspectInvitation, configuredWorkspaceId } from '@/lib/auth/service';
import type { AuthFormState } from '@/components/auth/AuthForm';
export async function acceptInviteAction(_state:AuthFormState,form:FormData):Promise<AuthFormState> {
  const password=String(form.get('password')??'');
  if(password!==String(form.get('confirmPassword')??'')) return {error:'Passwords do not match.'};
  try {
    const token=String(form.get('token')??'');
    const invite=await inspectInvitation(token);
    await acceptInvitation(token,String(form.get('displayName')??''),password);
    if('workspaceId' in invite&&invite.workspaceId!==configuredWorkspaceId())return {error:null,message:'Your account has joined the invited organization. This product workspace requires its own access grant.'};
  }
  catch(error) {return {error:authErrorMessage(error,'Could not set up this account.')};}
  redirect('/');
}
