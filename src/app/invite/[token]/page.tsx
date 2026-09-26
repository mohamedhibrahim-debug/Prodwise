import { AuthForm } from '@/components/auth/AuthForm';
import styles from '@/components/auth/auth.module.css';
import { inspectInvitation } from '@/lib/auth/service';
import { acceptInviteAction } from '../actions';
export const dynamic='force-dynamic';
export default async function AcceptInvite({params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  let invite;
  try { invite=await inspectInvitation(token); }
  catch { return <section className={styles.card}><h1>This invitation is unavailable</h1><p>It may be expired, revoked or already used. Ask your Admin for a new link.</p><a href="/login">Sign in</a></section>; }
  return <section className={styles.card}><p>Prodwise</p><h1>Set up your account</h1><p>{invite.email} · {invite.role}</p>
    <AuthForm action={acceptInviteAction} submit="Join workspace"><input name="token" type="hidden" value={token}/>
      <label>Your name<input name="displayName" autoComplete="name" maxLength={120} required/></label>
      <label>Password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} required/></label>
      <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256} required/></label>
      <p>Use at least 12 characters. Your account email and role are set by this invitation.</p>
    </AuthForm></section>;
}
