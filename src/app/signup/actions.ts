'use server';
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {AccessError} from '@/lib/auth/core';
import {startSignup,completeVerification,finishSignup} from '@/lib/auth/signup';
export interface SignupFormState {error:string|null;status?:'SENT'|'NOT_ELIGIBLE';email?:string;}
async function origin(){const h=await headers();const host=h.get('x-forwarded-host')??h.get('host')??'localhost';const proto=h.get('x-forwarded-proto')??(host.startsWith('localhost')||host.startsWith('127.')?'http':'https');return `${proto}://${host}`;}
const message=(e:unknown,fallback:string)=>e instanceof AccessError?e.message:e instanceof Error&&/temporarily|could not|Too many/.test(e.message)?e.message:fallback;
export async function startSignupAction(_s:SignupFormState,form:FormData):Promise<SignupFormState>{
 const email=String(form.get('email')??'');
 try{return {error:null,status:await startSignup(email,await origin()),email:email.trim().toLowerCase()};}catch(e){return {error:message(e,'Sign-up is temporarily unavailable. Please try again.'),email};}
}
export async function verifySignupAction(input:{accessToken?:string;tokenHash?:string;type?:string;localToken?:string}):Promise<{error:string|null}>{
 try{await completeVerification(input);return {error:null};}catch(e){return {error:message(e,'This verification link could not be used. Start again.')};}
}
export async function finishSignupAction(_s:SignupFormState,form:FormData):Promise<SignupFormState>{
 try{await finishSignup(String(form.get('organizationId')??''),String(form.get('name')??''),String(form.get('password')??''));}catch(e){return {error:message(e,'Your account could not be created. Please try again.')};}
 redirect('/?welcome=1');
}
