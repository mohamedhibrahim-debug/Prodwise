"use client";
import {useActionState,useId} from "react";
import {switchOrganizationAction} from "@/app/account/organization-actions";
import styles from "./admin.module.css";
export function OpenOrganizationForm({workspaceId,scopeWorkspaceId}:{workspaceId:string;scopeWorkspaceId:string}){const[state,action,pending]=useActionState(switchOrganizationAction,{});const hint=useId();return <form action={action} aria-busy={pending}><input type="hidden" name="workspaceId" value={workspaceId}/><input type="hidden" name="scopeWorkspaceId" value={scopeWorkspaceId}/>{state.error&&<p role="alert" className={styles.error}>{state.error}</p>}<button className={styles.secondary} disabled={pending} aria-describedby={hint}>{pending?"Opening organization…":"Open this organization"}</button><p id={hint} className={styles.meta}>Returns to this organization’s Home. Save any changes on this page first.</p></form>;}
