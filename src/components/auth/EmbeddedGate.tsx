'use client';
import { useSyncExternalStore } from 'react';
import { frameViewOf, isCrossOriginEmbedded, standaloneHref } from '@/lib/auth/embedding';
import styles from './login.module.css';

const never = () => () => {};
const embeddedNow = () => isCrossOriginEmbedded(frameViewOf(window));
const notEmbedded = () => false;

/**
 * Public entry forms set a SameSite=Lax session cookie, which no browser keeps
 * inside a frame owned by another site. When this document is framed that way,
 * the forms are replaced by one honest route out: the same page in its own tab.
 * Framing never changes, so the snapshot is read once per document.
 */
export function EmbeddedGate({ children, titleId }: { children: React.ReactNode; titleId: string }) {
  const embedded = useSyncExternalStore(never, embeddedNow, notEmbedded);
  if (!embedded) return children;
  return <div className={styles.embedded} role="status" aria-live="polite">
    <h1 id={titleId} className={styles.embeddedTitle}>Continue to Prodwise</h1>
    <p>Open a new tab to sign in or explore the demo without interruptions.</p>
    <a className={styles.primaryButton} href={standaloneHref(window.location)} target="_blank" rel="noopener noreferrer">Open Prodwise in a new tab ↗</a>
    <p className={styles.embeddedNote}>Your place on this page will be kept.</p>
  </div>;
}
