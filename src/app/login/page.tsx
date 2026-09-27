import { LoginForm } from '@/components/auth/LoginForm';
import styles from '@/components/auth/login.module.css';
import { safeReturnPath } from '@/lib/auth/core';

export const dynamic = 'force-dynamic';

export default async function Login({ searchParams }: {
  searchParams: Promise<{ returnTo?: string; signedOut?: string; access?: string }>;
}) {
  const query = await searchParams;

  return <section className={styles.page} aria-labelledby="login-title">
    <div className={styles.frame}>
      <aside className={styles.identity} aria-label="About Prodwise">
        <p className={styles.wordmark}>Prodwise</p>
        <div className={styles.identityBody}>
          <p className={styles.statement}>Product intelligence, from evidence to action.</p>
          <ul className={styles.principles}>
            {['Trusted initiative state', 'Human decisions', 'AI-grounded weekly review'].map(principle =>
              <li key={principle}><span className={styles.node} aria-hidden="true" /><span>{principle}</span></li>,
            )}
          </ul>
        </div>
      </aside>

      <div className={styles.entry}>
        <div className={styles.entryContent}>
          <header className={styles.heading}>
            <h1 id="login-title">Sign in</h1>
            <p>Continue to your workspace.</p>
          </header>
          {query.signedOut && <p className={styles.notice} role="status">You are signed out.</p>}
          {query.access && <p className={styles.error} role="alert">Your workspace access is unavailable. Contact your Admin.</p>}
          <LoginForm returnTo={safeReturnPath(query.returnTo)} />
          <p className={styles.invitationNote}>Access is invitation-only. Contact your workspace Admin for an invitation or help signing in.</p>
        </div>
      </div>
    </div>
  </section>;
}
