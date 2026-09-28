'use client';

import {useFormAction} from '@/components/forms/useFormAction';
import { useId, useState } from 'react';
import { demoLoginAction, loginAction } from '@/app/login/actions';
import type { AuthFormState } from './AuthForm';
import styles from './login.module.css';

const initialState: AuthFormState = { error: null };

export function LoginForm({ returnTo }: { returnTo: string }) {
  const [loginState, signIn, signingIn, keepSignIn] = useFormAction(loginAction, initialState);
  const [demoState, exploreDemo, openingDemo, keepExploreDemo] = useFormAction(demoLoginAction, initialState);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const emailId = useId();
  const passwordId = useId();
  const loginErrorId = useId();
  const demoErrorId = useId();
  const demoNoteId = useId();
  const pending = signingIn || openingDemo;

  return <div className={styles.forms}>
    <form action={signIn} onReset={keepSignIn} className={styles.signInForm} aria-label="Sign in to your workspace" aria-busy={signingIn}>
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className={styles.field}>
        <label htmlFor={emailId}>Email</label>
        <input id={emailId} name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
          value={email} onChange={event => setEmail(event.target.value)} required disabled={pending}
          aria-describedby={loginState.error ? loginErrorId : undefined} />
      </div>
      <div className={styles.field}>
        <label htmlFor={passwordId}>Password</label>
        <div className={styles.passwordControl}>
          <input id={passwordId} name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
            value={password} onChange={event => setPassword(event.target.value)} required disabled={pending}
            aria-describedby={loginState.error ? loginErrorId : undefined} />
          <button type="button" className={styles.visibilityButton} disabled={pending} aria-controls={passwordId}
            aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}>
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      {loginState.error && <p id={loginErrorId} className={styles.error} role="alert">{loginState.error}</p>}
      {loginState.message && <p className={styles.notice} role="status">{loginState.message}</p>}
      <button className={styles.primaryButton} type="submit" disabled={pending}>
        {signingIn ? 'Signing in…' : 'Sign in'}
      </button>
    </form>

    <form action={exploreDemo} onReset={keepExploreDemo} className={styles.demoForm} aria-label="Explore Demo" aria-busy={openingDemo}>
      {demoState.error && <p id={demoErrorId} className={styles.error} role="alert">{demoState.error}</p>}
      {demoState.message && <p className={styles.notice} role="status">{demoState.message}</p>}
      <button className={styles.demoButton} type="submit" disabled={pending}
        aria-describedby={[demoNoteId, demoState.error ? demoErrorId : ''].filter(Boolean).join(' ')}>
        {openingDemo ? 'Opening demo…' : 'Explore Demo'}
      </button>
      <p id={demoNoteId} className={styles.demoNote}>Uses synthetic demo data. Changes stay inside the demo workspace.</p>
    </form>
    <p className="visually-hidden" role="status" aria-live="polite">
      {signingIn ? 'Signing in…' : openingDemo ? 'Opening demo…' : ''}
    </p>
  </div>;
}
