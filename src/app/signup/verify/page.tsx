import {VerifySignup} from '@/components/auth/SignupForms';
import {AuthFrame} from '@/components/auth/AuthFrame';
import styles from '@/components/auth/login.module.css';
export const dynamic='force-dynamic';export const metadata={title:'Verify your email'};
export default async function Verify({searchParams}:{searchParams:Promise<{local?:string}>}){const q=await searchParams;
 return <AuthFrame titleId="verify-title"><header className={styles.heading}><h1 id="verify-title">Verify your email</h1><p>Confirming the link you opened.</p></header><VerifySignup localToken={q.local&&/^[A-Za-z0-9_-]{20,80}$/.test(q.local)?q.local:null}/></AuthFrame>;}
