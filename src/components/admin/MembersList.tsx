"use client";
import Link from "next/link";
import {useMemo,useState} from "react";
import {Segmented} from "@/components/workspace/TabToolbar";
import {AccessMark,DataTable,RoleBadge} from "./AdminUI";
import {joinedViaLabel} from "./model";
import styles from "./admin.module.css";

export interface MemberRow{id:string;name:string;email:string;role:string;active:boolean;joinedVia:string|null;productLead:boolean;protectedReason:string|null}
type Status="ACTIVE"|"DEACTIVATED"|"ALL";
const ROLE_ITEMS=[["","All roles"],["ORG_OWNER","Owners"],["ADMIN","Admins"],["MEMBER","Members"],["VIEWER","Viewers"]] as const;

/**
 * The member list filters in memory, instantly: search by name or email, one
 * role, and active / deactivated. Rows are what the server rendered; nothing
 * here changes access — every change goes through the member's own page.
 */
export function MembersList({members,base,initialQuery=""}:{members:MemberRow[];base:string;initialQuery?:string}){
 const [q,setQ]=useState(initialQuery);const [role,setRole]=useState("");const [status,setStatus]=useState<Status>("ACTIVE");
 const counts=useMemo(()=>({active:members.filter(m=>m.active).length,deactivated:members.filter(m=>!m.active).length}),[members]);
 const rows=useMemo(()=>{const text=q.trim().toLowerCase();return members.filter(m=>(status==="ALL"||(status==="ACTIVE")===m.active)&&(!role||m.role===role)&&(!text||`${m.name} ${m.email}`.toLowerCase().includes(text)));},[members,q,role,status]);
 const filtered=Boolean(q.trim()||role||status!=="ACTIVE");
 return <>
  <div className={styles.filterBar} role="search" aria-label="Filter members">
   <label className={styles.search}><span className="visually-hidden">Search members by name or email</span>
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.75"/><path d="M10.5 10.5L14 14"/></svg>
    <input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Name or email" autoComplete="off"/></label>
   <Segmented label="Role" items={ROLE_ITEMS.map(([value,label])=>({key:value||"all",label,current:role===value,onSelect:()=>setRole(value)}))}/>
   <Segmented label="Access" items={[{key:"active",label:"Active",count:counts.active,current:status==="ACTIVE",onSelect:()=>setStatus("ACTIVE")},{key:"deactivated",label:"Deactivated",count:counts.deactivated,current:status==="DEACTIVATED",onSelect:()=>setStatus("DEACTIVATED")},{key:"all",label:"All",current:status==="ALL",onSelect:()=>setStatus("ALL")}]}/>
   <p className={styles.result} aria-live="polite">{rows.length} of {members.length} members{filtered&&<> · <button type="button" className={styles.linkButton} onClick={()=>{setQ("");setRole("");setStatus("ACTIVE");}}>Reset</button></>}</p>
  </div>
  <DataTable caption="Organization members" columns={["Person","Role","Access","Weekly Review","Joined via","Open"]} empty={filtered?<>No members match these filters. <button type="button" className={styles.linkButton} onClick={()=>{setQ("");setRole("");setStatus("ACTIVE");}}>Reset filters</button></>:"No members are recorded in this organization."}
   rows={rows.map(m=>({key:m.id,cells:[
    <span key="person" className={styles.person}>{m.name}<small>{m.email}</small></span>,
    <span key="role"><RoleBadge role={m.role}/>{m.protectedReason&&<small className={styles.protectedTag}>{m.protectedReason}</small>}</span>,
    <AccessMark key="access" active={m.active}/>,
    m.productLead?"Product Lead":<span key="lead" className={styles.dash} aria-label="Standard">—</span>,
    joinedViaLabel(m.joinedVia),
    <Link prefetch={false} key="open" href={`${base}/${m.id}`} aria-label={`Open ${m.name}`}>Open →</Link>,
   ]}))}/>
 </>;
}
