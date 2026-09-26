'use server';
import { changeOwnPassword } from '@/lib/auth/service';
import type { AuthFormState } from '@/components/auth/AuthForm';
export async function passwordAction(_state:AuthFormState,form:FormData):Promise<AuthFormState>{
  const next=String(form.get('password')??'');
  if(next!==form.get('confirmPassword'))return {error:'The new passwords do not match.'};
  try{await changeOwnPassword(String(form.get('currentPassword')??''),next);return {error:null,message:'Password updated. Other workspace sessions have been signed out.'};}
  catch(error){return {error:error instanceof Error?error.message:'Could not update your password.'};}
}
