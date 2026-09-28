import 'server-only';
import {cookies,headers} from 'next/headers';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {AccessError,normalizeEmail,signToken,unsignedToken} from './core';
import {adminClient,authClient,isLocalAuth,localAuthStore,secret,signInToWorkspace} from './service';

/**
 * Organization-aware self sign-up.
 * 1. Work email → yes/no by organization policy (rate limited, names no organization).
 * 2. Email verification proves ownership of the address (provider email; local fixture: outbox file).
 * 3. Name + password → join an eligible organization as MEMBER. Re-checked server-side.
 */
const VERIFIED_COOKIE='prodwise_signup';
export interface SignupOption {organizationId:string;name:string;workspaceId:string;member:boolean;}
export interface SignupState {email:string;existingIdentity:boolean;organizations:SignupOption[];}
const SQL_ERRORS:Record<string,string>={EMAIL_INVALID:'Enter a valid work email.',RATE_LIMITED:'Too many attempts for this address. Try again in an hour.',EMAIL_NOT_VERIFIED:'Verify your email first.',SIGNUP_NOT_ALLOWED:'This organization does not accept self sign-up for your address. Ask one of its administrators for an invitation, or sign in if you already have an account.',ACCOUNT_EXISTS:'You already have a Prodwise account. Sign in instead.',NAME_REQUIRED:'Enter your name up to 120 characters.'};
function friendly(message:string){const code=Object.keys(SQL_ERRORS).find(k=>message.includes(k));return code?new AccessError(code,SQL_ERRORS[code]!):new Error('Sign-up is temporarily unavailable. Please try again.');}
async function clientKey(){const h=await headers();const ip=(h.get('x-forwarded-for')??'').split(',')[0]!.trim()||h.get('x-real-ip')||'unknown';return createHash('sha256').update(`prodwise-signup:${ip}`).digest('hex');}

export async function startSignup(email:string,origin:string):Promise<'SENT'|'NOT_ELIGIBLE'>{
 const e=normalizeEmail(email);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)||e.length>254)throw new AccessError('EMAIL_INVALID','Enter a valid work email.');
 if(isLocalAuth()){const r=await localAuthStore().checkSelfSignup(e);if(!r.eligible)return 'NOT_ELIGIBLE';
  // Local fixture outbox: stands in for the provider's verification email. Never used in hosted mode.
  const dir=join(process.cwd(),'.data','outbox');if(!existsSync(dir))mkdirSync(dir,{recursive:true});writeFileSync(join(dir,`${Date.now()}-signup.json`),JSON.stringify({to:e,subject:'Verify your email for Prodwise',link:`${origin}/signup/verify?local=${r.token}`},null,2),{mode:0o600});return 'SENT';}
 const {data,error}=await adminClient().rpc('check_self_signup',{p_email:e,p_client_hash:await clientKey()});if(error)throw friendly(error.message);if(!data)return 'NOT_ELIGIBLE';
 const sent=await authClient().auth.signInWithOtp({email:e,options:{shouldCreateUser:true,emailRedirectTo:`${origin}/signup/verify`}});
 if(sent.error)throw new Error(/rate/i.test(sent.error.message)?'Too many emails were requested. Try again in a few minutes.':'We could not send the verification email. Try again shortly.');
 return 'SENT';
}

async function setVerified(payload:{email:string;authUserId:string|null}){const value=Buffer.from(JSON.stringify({...payload,exp:Date.now()+30*60000})).toString('base64url');
 (await cookies()).set(VERIFIED_COOKIE,signToken(value,secret()),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/signup',maxAge:30*60});}
export async function readVerified():Promise<{email:string;authUserId:string|null}|null>{
 const raw=unsignedToken((await cookies()).get(VERIFIED_COOKIE)?.value,secret());if(!raw)return null;
 try{const v=JSON.parse(Buffer.from(raw,'base64url').toString('utf8')) as {email:string;authUserId:string|null;exp:number};return v.exp>Date.now()?{email:v.email,authUserId:v.authUserId}:null;}catch{return null;}
}
/** Accepts the proof the provider returned to the browser; the server re-verifies it with the provider. */
export async function completeVerification(input:{accessToken?:string;tokenHash?:string;type?:string;localToken?:string}):Promise<void>{
 if(isLocalAuth()){if(!input.localToken)throw new AccessError('VERIFICATION_INVALID','This verification link is not valid.');const email=await localAuthStore().verifySignupToken(input.localToken);await setVerified({email,authUserId:null});return;}
 const client=authClient();let user;
 if(input.accessToken){const r=await client.auth.getUser(input.accessToken);user=r.data.user;}
 else if(input.tokenHash){const r=await client.auth.verifyOtp({token_hash:input.tokenHash,type:(input.type==='signup'?'signup':'email')});user=r.data.user;}
 if(!user?.email||!user.email_confirmed_at)throw new AccessError('VERIFICATION_INVALID','This verification link has expired or was already used. Start again.');
 await setVerified({email:normalizeEmail(user.email),authUserId:user.id});
}
export async function signupState():Promise<SignupState|null>{
 const v=await readVerified();if(!v)return null;
 if(isLocalAuth())return localAuthStore().selfSignupOptions(v.email);
 const {data,error}=await adminClient().rpc('self_signup_options',{p_auth_user_id:v.authUserId});if(error)throw friendly(error.message);return data as SignupState;
}
export async function finishSignup(organizationId:string,displayName:string,password:string):Promise<void>{
 const v=await readVerified();if(!v)throw new AccessError('EMAIL_NOT_VERIFIED','Your verification expired. Start again.');
 const state=await signupState();if(!state||state.existingIdentity)throw new AccessError('ACCOUNT_EXISTS','You already have a Prodwise account. Sign in instead.');
 // The organization must be one of the verified address's eligible options; the id alone grants nothing.
 const option=state.organizations.find(o=>o.organizationId===organizationId&&!o.member);if(!option)throw new AccessError('SIGNUP_NOT_ALLOWED','This organization does not accept self sign-up for your address. Ask one of its administrators for an invitation, or sign in if you already have an account.');
 if(password.length<12||password.length>256)throw new AccessError('PASSWORD_INVALID','Use a password between 12 and 256 characters.');
 // Reject the obvious: a repeated fragment, a password made from the address, or a well-known phrase.
 const lower=password.toLowerCase(),local=v.email.split('@')[0]!.toLowerCase();
 if(/^(.{1,6})\1+$/.test(lower)||/^(password|qwerty|123456|prodwise|welcome)/.test(lower)||(local.length>=4&&lower.includes(local)))throw new AccessError('PASSWORD_INVALID','Choose a less predictable password: not a repeated word, a common phrase or your email name.');
 let workspaceId:string;
 if(isLocalAuth())workspaceId=(await localAuthStore().completeSelfSignup(v.email,organizationId,displayName,password)).workspaceId;
 else{const db=adminClient();const set=await db.auth.admin.updateUserById(v.authUserId!,{password});if(set.error)throw new Error('We could not set your password. Try again.');
  const {data,error}=await db.rpc('complete_self_signup',{p_auth_user_id:v.authUserId,p_organization_id:organizationId,p_display_name:displayName});if(error)throw friendly(error.message);workspaceId=(data as {workspaceId:string}).workspaceId;}
 (await cookies()).delete({name:VERIFIED_COOKIE,path:'/signup'});
 await signInToWorkspace(v.email,password,workspaceId);
}
