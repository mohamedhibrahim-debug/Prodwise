import { requireWorkspaceAccess } from '@/lib/auth/access';
import { AccountAccess } from '@/components/auth/AccountAccess';
import styles from '@/components/auth/auth.module.css';
import Link from 'next/link';
import { AuthForm } from '@/components/auth/AuthForm';
import { passwordAction } from './actions';
export const dynamic='force-dynamic';
export default async function Account({searchParams}:{searchParams:Promise<{restricted?:string}>}) {
  const ctx=await requireWorkspaceAccess();const query=await searchParams;
  return <section className={styles.page}><AccountAccess/><h1>My account</h1>
    {query.restricted&&<p className={styles.role}>You have view-only access. You can inspect initiatives, Sources, Knowledge and Decisions.</p>}
    <p>{ctx.actor.label} · {ctx.role}</p><p>Workspace access and your account email are managed by your Admin.</p><Link href="/">Go to Home</Link>
    <div className={styles.card}><h2>Change my password</h2><AuthForm action={passwordAction} submit="Update password">
      <label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required/></label>
      <label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} required/></label>
      <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256} required/></label>
    </AuthForm></div>
  </section>;
}
