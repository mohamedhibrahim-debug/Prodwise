"use client";
import { useActionState, useEffect } from "react";
import type { MarkState } from "@/app/notifications/actions";
import { NOTIFICATIONS_CHANGED } from "./events";
import styles from "@/app/notifications/notifications.module.css";

export function MarkAllRead({ action, fingerprints, count }: { action: (s: MarkState, f: FormData) => Promise<MarkState>; fingerprints: string[]; count: number }) {
  const [state, formAction, pending] = useActionState(action, { error: null, message: null });
  useEffect(() => { if (state.message) window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED)); }, [state]);
  return <form action={formAction} className={styles.markAll} aria-busy={pending}>
    <input type="hidden" name="fingerprints" value={fingerprints.join(",")} />
    <button className={styles.secondary} disabled={pending}>{pending ? "Marking…" : `Mark ${count} as read`}</button>
    {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
    {state.message && <p role="status" className={styles.muted}>{state.message}</p>}
  </form>;
}
