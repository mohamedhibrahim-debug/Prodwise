import Link from 'next/link';
import {SignupStart,SignupAccount} from '@/components/auth/SignupForms';
import {AuthFrame} from '@/components/auth/AuthFrame';
import {signupState} from '@/lib/auth/signup';
import styles from '@/components/auth/login.module.css';
export const dynamic='force-dynamic';export const metadata={title:'Create your account'};
export default async function Signup(){
 const state=await signupState().catch(()=>null);const open=state?.organizations.filter(o=>!o.member)??[];
 return <AuthFrame titleId="signup-title"><header className={styles.heading}><h1 id="signup-title">{state?'Set up your account':'Create your account'}</h1><p>{state?'Last step. Your organization is chosen from your verified address.':'Use your work email. Your organization’s access policy decides where you can join.'}</p></header>
  {!state?<SignupStart/>:state.existingIdentity?<div className={styles.forms}><p className={styles.notice} role="status"><strong>You already have a Prodwise account for {state.email}.</strong> Sign in with your password. An administrator can add you to another organization.</p><Link className={styles.primaryButton} href="/login">Go to sign in</Link></div>
  :open.length?<SignupAccount email={state.email} organizations={open.map(o=>({organizationId:o.organizationId,name:o.name}))}/>
  :<div className={styles.forms}><p className={styles.error} role="alert"><strong>Your email is verified, but no workspace currently accepts it.</strong> Ask your organization’s Prodwise administrator for an invitation.</p></div>}
  <p className={styles.switchLink}>Already have an account? <Link href="/login">Sign in</Link></p></AuthFrame>;
}
