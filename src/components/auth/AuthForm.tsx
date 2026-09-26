'use client';
import { useActionState } from 'react';
import styles from './auth.module.css';
export interface AuthFormState { error: string | null; message?: string; link?: string }
export function AuthForm({ action, children, submit, disabled=false }: {
  action: (state: AuthFormState, form: FormData) => Promise<AuthFormState>;
  children: React.ReactNode; submit: string; disabled?: boolean;
}) {
  const [state,formAction,pending]=useActionState(action,{error:null});
  const invitationLink=state.link && typeof window!=='undefined' ? new URL(state.link,window.location.origin).href : state.link;
  return <form action={formAction} className={styles.form}>
    {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
    {state.message && <p role="status">{state.message}</p>}
    {invitationLink && <div className={styles.link}><strong>Copy this one-time invitation link</strong><p>It expires in seven days. Share it privately with the intended person.</p><a href={invitationLink}>{invitationLink}</a></div>}
    {children}<button type="submit" disabled={pending||disabled}>{pending?'Saving…':submit}</button>
  </form>;
}
