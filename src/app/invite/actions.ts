'use server';
import { authErrorMessage } from '@/lib/auth/errors';

import { redirect } from 'next/navigation';
import { acceptInvitation } from '@/lib/auth/service';
import type { AuthFormState } from '@/components/auth/AuthForm';
export async function acceptInviteAction(_state:AuthFormState,form:FormData):Promise<AuthFormState> {
  const password=String(form.get('password')??'');
  if(password!==String(form.get('confirmPassword')??'')) return {error:'Passwords do not match.'};
  try { await acceptInvitation(String(form.get('token')??''),String(form.get('displayName')??''),password); }
  catch(error) {return {error:authErrorMessage(error,'Could not set up this account.')};}
  redirect('/');
}
