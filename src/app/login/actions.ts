'use server';
import { redirect } from 'next/navigation';
import { signIn,signOut,startDemoSession } from '@/lib/auth/service';
import { safeReturnPath, AccessError } from '@/lib/auth/core';
import type { AuthFormState } from '@/components/auth/AuthForm';
export async function loginAction(_state:AuthFormState,form:FormData):Promise<AuthFormState> {
  try { await signIn(String(form.get('email')??''),String(form.get('password')??'')); }
  catch(error) { return {error:error instanceof AccessError?error.message:'Sign-in is temporarily unavailable. Please try again.'}; }
  redirect(safeReturnPath(String(form.get('returnTo')??'/')));
}
/** No client email, identity, organization, return URL or provider token is used. */
export async function demoLoginAction():Promise<AuthFormState> {
  try { await startDemoSession(); }
  catch(error) { return {error:error instanceof AccessError?error.message:'Demo is temporarily unavailable. Please try again shortly.'}; }
  redirect('/');
}
export async function logoutAction() { await signOut(); redirect('/login?signedOut=1'); }
