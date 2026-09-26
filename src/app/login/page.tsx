import { AuthForm } from '@/components/auth/AuthForm';
import styles from '@/components/auth/auth.module.css';
import { loginAction } from './actions';
import { safeReturnPath } from '@/lib/auth/core';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{returnTo?:string;signedOut?:string;access?:string}>}) {
  const query=await searchParams;
  return <section className={styles.card}><p>Prodwise</p><h1>Sign in to your workspace</h1>
    <p>Product intelligence, from evidence to action.</p>
    {query.signedOut && <p role="status">You are signed out.</p>}
    {query.access && <p role="alert">Your workspace access is unavailable. Contact your Admin.</p>}
    <AuthForm action={loginAction} submit="Sign in">
      <input type="hidden" name="returnTo" value={safeReturnPath(query.returnTo)} />
      <label>Email<input name="email" type="email" autoComplete="username" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
    </AuthForm><p>Accounts are invitation-only. Contact your Admin if you need access or password recovery.</p>
  </section>;
}
