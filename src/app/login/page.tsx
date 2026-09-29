import { LoginForm } from '@/components/auth/LoginForm';
import { AuthFrame } from '@/components/auth/AuthFrame';
import styles from '@/components/auth/login.module.css';
import { safeReturnPath } from '@/lib/auth/core';
import Link from 'next/link';
import { ProviderReturn } from '@/components/auth/ProviderReturn';
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Sign in" };

export const dynamic = 'force-dynamic';

export default async function Login({ searchParams }: {
  searchParams: Promise<{ returnTo?: string; signedOut?: string; access?: string }>;
}) {
  const query = await searchParams;

  return <AuthFrame titleId="login-title">
    <header className={styles.heading}>
      <h1 id="login-title">Sign in</h1>
      <p>Continue to your workspace.</p>
    </header>
    {query.signedOut && <p className={styles.notice} role="status">You are signed out.</p>}
    {query.access && <p className={styles.error} role="alert">Your workspace access is unavailable. Contact your Admin.</p>}
    <LoginForm returnTo={safeReturnPath(query.returnTo)} />
    <ProviderReturn />
    <p className={styles.switchLink}>New to Prodwise? <Link href="/signup">Create an account</Link> with your work email.</p>
    <p className={styles.invitationNote}>Invited by an administrator? Use the link in your invitation email.</p>
  </AuthFrame>;
}
