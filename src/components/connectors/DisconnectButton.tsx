"use client";
import { useState } from "react";
import { useFormAction } from '@/components/forms/useFormAction';
import { Button } from "@/components/primitives/Button";
import styles from "./connectors.module.css";

type State = { error: string | null; message: string | null };
/** Disconnect is destructive, so it asks once, inline, and says exactly what stays. */
export function DisconnectButton({ action, connector, label }: { action: (s: State, f: FormData) => Promise<State>; connector: string; label: string }) {
  const [state, formAction, pending, keepFormAction] = useFormAction(action, { error: null, message: null });
  const [confirming, setConfirming] = useState(false);
  if (state.message) return <p role="status" className={styles.successText}>{state.message}</p>;
  if (!confirming) return <Button variant="ghost" className={styles.dangerGhost} onClick={() => setConfirming(true)}>Disconnect</Button>;
  return <form action={formAction} onReset={keepFormAction} aria-busy={pending} className={styles.confirm} role="group" aria-label={`Disconnect ${label}?`}>
    <input type="hidden" name="connector" value={connector} />
    <p><strong>Disconnect {label}?</strong> Prodwise deletes its stored access. Sources you already imported and their snapshots stay.</p>
    <div className={styles.confirmActions}>
      <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirming(false)} autoFocus>Keep connected</Button>
      <Button type="submit" variant="primary" className={styles.danger} disabled={pending}>{pending ? "Disconnecting…" : `Disconnect ${label}`}</Button>
    </div>
    {state.error && <p role="alert" className={styles.error}>{state.error}</p>}
  </form>;
}
