"use client";
import {useFormAction} from '@/components/forms/useFormAction';
import { type ReactNode } from "react";
import type { DeliveryActionState } from "@/lib/delivery/actions";
import styles from "./delivery.module.css";
export function ActionForm({ action,children,label,disabled=false,pendingLabel="Saving…" }: {action:(state:DeliveryActionState,form:FormData)=>Promise<DeliveryActionState>;children:ReactNode;label:string;disabled?:boolean;pendingLabel?:string}) {
  const [state, formAction, pending, keepFormAction] = useFormAction(action,{error:null,message:null});
  return <form action={formAction} onReset={keepFormAction} className={styles.form}><fieldset className={styles.formFields} disabled={disabled||pending}>{children}<button className="pw-btn" data-variant="primary" disabled={disabled||pending}>{pending?pendingLabel:label}</button></fieldset>{state.error && <p role="alert" className={styles.error}>{state.error}</p>}{state.message && <p role="status" className={styles.success}>{state.message}</p>}</form>;
}
