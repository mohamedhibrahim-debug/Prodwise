'use client';
import {useFormAction} from '@/components/forms/useFormAction';
import Link from 'next/link';
import {useEffect,useId,useRef,useState,useCallback} from 'react';
import {useRouter} from 'next/navigation';
import {startSignupAction,finishSignupAction,verifySignupAction,type SignupFormState} from '@/app/signup/actions';
import { EyeIcon } from './EyeIcon';
import styles from './login.module.css';

export function SignupSteps({step}:{step:1|2|3}){const steps=['Work email','Verify email','Your account'];return <ol className={styles.steps} aria-label="Sign-up progress">{steps.map((s,n)=><li key={s} aria-current={step===n+1?'step':undefined} data-done={n+1<step||undefined}><span aria-hidden="true">{n+1<step?'✓':n+1}</span>{s}</li>)}</ol>;}

export function SignupStart(){
 const [state, action, pending, keepAction] = useFormAction(startSignupAction,{error:null} as SignupFormState);const [email,setEmail]=useState('');const id=useId(),err=useId();
 if(state.status==='SENT')return <div className={styles.forms}><SignupSteps step={2}/><div className={styles.notice} role="status"><strong>Check your email.</strong> We sent a verification link to <strong>{state.email}</strong>. Open it on this device to continue. The link expires in 30 minutes.</div><p className={styles.invitationNote}>Didn’t get it? Check spam, or <Link href="/signup">start again</Link>.</p></div>;
 return <div className={styles.forms}><SignupSteps step={1}/>
  <form action={action} onReset={keepAction} className={styles.signInForm} aria-label="Start sign-up" aria-busy={pending}>
   <div className={styles.field}><label htmlFor={id}>Work email</label><input id={id} name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={e=>setEmail(e.target.value)} required disabled={pending} aria-describedby={state.error||state.status?err:undefined}/></div>
   {state.status==='NOT_ELIGIBLE'&&<div id={err} className={styles.error} role="alert"><strong>This email isn’t currently eligible for a Prodwise workspace.</strong> Ask your organization’s Prodwise administrator for an invitation, or use your work email.</div>}
   {state.error&&<p id={err} className={styles.error} role="alert">{state.error}</p>}
   <button className={styles.primaryButton} type="submit" disabled={pending||!email.trim()}>{pending?'Checking…':'Continue'}</button>{!email.trim()&&<p className="disabled-reason">Enter your work email to continue.</p>}
  </form>
  <p className={styles.invitationNote}>Your organization decides who can join. We only continue for addresses its access policy allows, and we verify you own the address first.</p>
 </div>;
}

export function SignupAccount({email,organizations}:{email:string;organizations:{organizationId:string;name:string}[]}){
 const [state, action, pending, keepAction] = useFormAction(finishSignupAction,{error:null} as SignupFormState);const [show,setShow]=useState(false);const [password,setPassword]=useState('');const [org,setOrg]=useState(organizations[0]?.organizationId??'');
 const nameId=useId(),pwId=useId(),pwHelp=useId(),err=useId();const selected=organizations.find(o=>o.organizationId===org);
 return <div className={styles.forms}><SignupSteps step={3}/>
  <p className={styles.verified}><span aria-hidden="true">✓</span> Verified · {email}</p>
  <form action={action} onReset={keepAction} className={styles.signInForm} aria-label="Create your account" aria-busy={pending}>
   {organizations.length===1?<div className={styles.orgCard}><span className={styles.orgMark} aria-hidden="true">{selected?.name.slice(0,1)}</span><div><p className={styles.orgLabel}>You’re joining</p><p className={styles.orgName}>{selected?.name}</p><p className={styles.orgNote}>As a Member. Administrators can change roles later.</p></div><input type="hidden" name="organizationId" value={org}/></div>
   :<fieldset className={styles.orgChoice}><legend>Choose the organization to join</legend>{organizations.map(o=><label key={o.organizationId}><input type="radio" name="organizationId" value={o.organizationId} checked={org===o.organizationId} onChange={()=>setOrg(o.organizationId)}/>{o.name}</label>)}<p className={styles.orgNote}>You join as a Member. Only organizations that accept your address are listed.</p></fieldset>}
   <div className={styles.field}><label htmlFor={nameId}>Your name</label><input id={nameId} name="name" autoComplete="name" maxLength={120} required disabled={pending}/></div>
   <div className={styles.field}><label htmlFor={pwId}>Password</label><div className={styles.passwordControl}><input id={pwId} name="password" type={show?'text':'password'} autoComplete="new-password" minLength={12} maxLength={256} value={password} onChange={e=>setPassword(e.target.value)} required disabled={pending} aria-describedby={pwHelp}/><button type="button" className={styles.visibilityButton} onClick={()=>setShow(v=>!v)} aria-controls={pwId} aria-label={show?'Hide password':'Show password'}><EyeIcon open={!show}/></button></div><p id={pwHelp} className={styles.fieldHint}>{password.length<12?`At least 12 characters · ${12-password.length} to go`:'✓ Long enough'}</p></div>
   {state.error&&<p id={err} className={styles.error} role="alert">{state.error}</p>}
   <button className={styles.primaryButton} type="submit" disabled={pending||password.length<12||!org}>{pending?'Creating your account…':`Join ${selected?.name??'organization'}`}</button>{(!org||password.length<12)&&<p className="disabled-reason">{!org?'Choose the organization to join.':'Use a password of at least 12 characters.'}</p>}
  </form></div>;
}

/** The provider returns proof in the URL fragment (never sent to the server); forward it for server-side verification. */
export function VerifySignup({localToken}:{localToken:string|null}){
 const router=useRouter();const [error,setError]=useState<string|null>(null);const [pending,setPending]=useState(false);
 const [input,setInput]=useState<Parameters<typeof verifySignupAction>[0]|null|undefined>(undefined);const started=useRef(false);
 const run=useCallback(async(value:Parameters<typeof verifySignupAction>[0])=>{setPending(true);const result=await verifySignupAction(value);setPending(false);if(result.error)setError(result.error);else router.replace('/signup');},[router]);
 useEffect(()=>{if(started.current)return;started.current=true;
  const hash=new URLSearchParams(window.location.hash.slice(1)),query=new URLSearchParams(window.location.search);
  const found=localToken?{localToken}:hash.get('access_token')?{accessToken:hash.get('access_token')!}:query.get('token_hash')?{tokenHash:query.get('token_hash')!,type:query.get('type')??undefined}:null;
  const providerError=hash.get('error_description')??query.get('error_description');
  history.replaceState(null,'',window.location.pathname);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the provider's one-time URL fragment once on mount
  if(!found){setError(providerError??'This verification link is incomplete. Start again.');return;}
  // A session returned by the provider can be read more than once; a one-time token is used only
  // when the person presses Confirm, so link scanners and previews cannot use it up.
  if('accessToken' in found)void run(found);else setInput(found);
 },[localToken,run]);
 return <div className={styles.forms}><SignupSteps step={2}/>{error?<><p className={styles.error} role="alert">{error}</p><Link className={styles.primaryButton} href="/signup">Start again</Link></>:input?<><p className={styles.notice}>Confirm that this is your email address to continue.</p><button type="button" className={styles.primaryButton} disabled={pending} onClick={()=>void run(input)}>{pending?'Confirming…':'Confirm my email'}</button></>:<p className={styles.notice} role="status">Verifying your email…</p>}</div>;
}

