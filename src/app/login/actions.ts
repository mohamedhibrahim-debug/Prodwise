'use server';
import { redirect } from 'next/navigation';
import { signIn,signOut } from '@/lib/auth/service';
import { safeReturnPath } from '@/lib/auth/core';
import type { AuthFormState } from '@/components/auth/AuthForm';
export async function loginAction(_state:AuthFormState,form:FormData):Promise<AuthFormState> {
  try { await signIn(String(form.get('email')??''),String(form.get('password')??'')); }
  catch(error) { return {error:error instanceof Error?error.message:'Could not sign in.'}; }
  redirect(safeReturnPath(String(form.get('returnTo')??'/')));
}
export async function logoutAction() { await signOut(); redirect('/login?signedOut=1'); }
