"use client";
import { useFormAction } from '@/components/forms/useFormAction';
import { ScopeField } from '@/components/auth/WorkspaceScope';
import { Button } from "@/components/primitives/Button";
import type { RefreshState } from "@/app/initiatives/[slug]/sources/import/actions";
import { Glyph } from "./icons";
import styles from "./connectors.module.css";

/** Re-reads one source. Bounded server-side (20 s per provider call); the result is always announced. */
export function RefreshButton({ action, slug, itemId, connector, label, providerLabel }: { action: (s: RefreshState, f: FormData) => Promise<RefreshState>; slug: string; itemId: string; connector: string; label: string; providerLabel: string }) {
  const [state, formAction, pending, keepFormAction] = useFormAction(action, { error: null, message: null });
  return <form action={formAction} onReset={keepFormAction} aria-busy={pending} className={styles.refreshForm}><ScopeField/>
    <input type="hidden" name="slug" value={slug} /><input type="hidden" name="itemId" value={itemId} /><input type="hidden" name="connector" value={connector} />
    <Button type="submit" variant="secondary" disabled={pending} aria-label={`Refresh ${label} from ${providerLabel}`}><span className={pending ? styles.spin : undefined}><Glyph name="refresh" size={13} /></span>{pending ? `Checking ${providerLabel}…` : "Refresh"}</Button>
    {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
    {state.message && <p role="status" className={styles.refreshNote}>{state.message}</p>}
  </form>;
}
