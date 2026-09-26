"use client";
import { useActionState, type ReactNode } from "react";
import type { DeliveryActionState } from "@/lib/delivery/actions";
import styles from "./delivery.module.css";
export function ActionForm({ action,children,label,disabled=false }: {action:(state:DeliveryActionState,form:FormData)=>Promise<DeliveryActionState>;children:ReactNode;label:string;disabled?:boolean}) {
  const [state,formAction,pending]=useActionState(action,{error:null,message:null});
  return <form action={formAction} className={styles.form}><fieldset className={styles.formFields} disabled={disabled||pending}>{children}<button className={styles.button} disabled={disabled||pending}>{pending?"Saving…":label}</button></fieldset>{state.error && <p role="alert" className={styles.error}>{state.error}</p>}{state.message && <p role="status" className={styles.success}>{state.message}</p>}</form>;
}
