"use client";
import {useFormAction} from '@/components/forms/useFormAction';
import type { RefreshState } from "@/app/initiatives/[slug]/sources/import/actions";
import styles from "./connectors.module.css";

export function RefreshButton({ action, slug, itemId, connector, label }: { action: (s: RefreshState, f: FormData) => Promise<RefreshState>; slug: string; itemId: string; connector: string; label: string }) {
  const [state, formAction, pending, keepFormAction] = useFormAction(action, { error: null, message: null });
  return <form action={formAction} onReset={keepFormAction} aria-busy={pending}>
    <input type="hidden" name="slug" value={slug} /><input type="hidden" name="itemId" value={itemId} /><input type="hidden" name="connector" value={connector} />
    <button className={styles.secondary} disabled={pending} aria-label={`Refresh ${label}`}>{pending ? "Checking…" : "Refresh"}</button>
    {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
    {state.message && <p role="status" className={styles.muted}>{state.message}</p>}
  </form>;
}
