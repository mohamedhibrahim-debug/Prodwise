"use client";
import { useFormAction } from '@/components/forms/useFormAction';
import { Button } from "@/components/primitives/Button";
import styles from "./connectors.module.css";

type State = { error: string | null; message: string | null };
/** One-button form for connect / reconnect. Pending state is visible; results are announced. */
export function ConnectorButton({ action, connector, returnTo, label, pendingLabel, variant = "primary" }: { action: (s: State, f: FormData) => Promise<State>; connector: string; returnTo?: string; label: string; pendingLabel: string; variant?: "primary" | "secondary" }) {
  const [state, formAction, pending, keepFormAction] = useFormAction(action, { error: null, message: null });
  return <form action={formAction} onReset={keepFormAction} aria-busy={pending} className={styles.inlineForm}>
    <input type="hidden" name="connector" value={connector} />{returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
    <Button type="submit" variant={variant} disabled={pending}>{pending ? pendingLabel : label}</Button>
    {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
    {state.message && <p role="status" className={styles.successText}>{state.message}</p>}
  </form>;
}
