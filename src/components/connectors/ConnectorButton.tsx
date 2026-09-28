"use client";
import { useActionState } from "react";
import styles from "@/components/admin/admin.module.css";

type State = { error: string | null; message: string | null };
/** One-button form for connect / disconnect. Pending state is visible; results are announced. */
export function ConnectorButton({ action, connector, returnTo, label, pendingLabel, tone }: { action: (s: State, f: FormData) => Promise<State>; connector: string; returnTo?: string; label: string; pendingLabel: string; tone?: "danger" | "secondary" }) {
  const [state, formAction, pending] = useActionState(action, { error: null, message: null });
  return <form action={formAction} aria-busy={pending}>
    <input type="hidden" name="connector" value={connector} />{returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
    <button className={tone === "secondary" || tone === "danger" ? styles.secondary : styles.primary} data-tone={tone === "danger" ? "danger" : undefined} disabled={pending}>{pending ? pendingLabel : label}</button>
    {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
    {state.message && <p role="status" className={styles.success}>{state.message}</p>}
  </form>;
}
