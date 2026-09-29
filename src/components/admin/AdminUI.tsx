import {formatDateTime} from "@/lib/domain/labels";
import Link from "next/link";
import type {ReactNode} from "react";
import {PageHeader} from "@/components/workspace/PageHeader";
import {InstrumentIcon} from "@/components/shell/InstrumentIcon";
import {ADMIN_SECTIONS,OPERATOR_HOME,OPERATOR_SECTIONS,organizationStatusLabel,roleLabel} from "./model";
import styles from "./admin.module.css";
export {default as styles} from "./admin.module.css";

/**
 * The administration frame. Everyday administration is a task list on the left
 * (Organization · Members · Roles & permissions · Integrations · Preferences ·
 * Security & access); the operator surface is a separate group, only offered to
 * a Platform Owner, and announces platform-wide authority in its own band.
 */
export function AdminFrame({area,active,title,meta,actions,operator,organizationName,children}:{area:"organization"|"operator";active:string;title:string;meta?:ReactNode;actions?:ReactNode;operator:boolean;organizationName:string;children:ReactNode}){
 return <div className={styles.page} data-area={area}>
  <PageHeader title={title} meta={meta} actions={actions}/>
  {area==="operator"&&<div className={styles.operatorBand} role="note">
   <InstrumentIcon name="administration" aria-hidden="true"/>
   <p><strong>Operator surface · platform-wide authority.</strong> Changes here reach every organization and are recorded with your identity and reason. Everyday administration of {organizationName||"your organization"} lives under <Link prefetch={false} href="/administration">Administration</Link>.</p>
  </div>}
  <div className={styles.console}>
   <nav className={styles.subnav} aria-label="Administration sections">
    <div className={styles.navGroup}>
     <p className={styles.navLabel}>{organizationName||"Organization"}</p>
     {ADMIN_SECTIONS.map(s=><Link prefetch={false} key={s.key} href={s.href} className={styles.navItem} aria-current={area==="organization"&&active===s.key?"page":undefined}>{s.label}</Link>)}
    </div>
    {operator&&<div className={styles.navGroup}>
     <p className={styles.navLabel}>Operator</p>
     {area==="operator"
      ?OPERATOR_SECTIONS.map(s=><Link prefetch={false} key={s.key} href={s.href} className={styles.navItem} data-operator="" aria-current={active===s.key?"page":undefined}>{s.label}</Link>)
      :<Link prefetch={false} href={OPERATOR_HOME} className={styles.navItem} data-operator=""><InstrumentIcon name="administration" aria-hidden="true"/>All organizations</Link>}
    </div>}
   </nav>
   <div className={styles.content}>{children}</div>
  </div>
 </div>;
}

export function Restricted({guest=false,operator=false}:{guest?:boolean;operator?:boolean}){
 return <div className={styles.page}>
  <PageHeader title={operator?"Operator surface is unavailable":"Administration is unavailable"} meta={guest?"Explore Demo session":"Access restricted"}/>
  <section className={styles.section}>
   <p className={styles.prose}>{guest?"Explore Demo includes synthetic product work. Account and organization administration are unavailable in this session.":operator?"The operator surface needs global Platform Owner authority. Organization administration is unaffected.":"Organization administration requires an Org Owner or Admin. Ask an organization administrator if you need a change made."}</p>
   <div className={styles.linkRow}><Link prefetch={false} className={styles.secondary} href={operator?"/administration":"/"}>{operator?"Back to Administration":"Return to Home"}</Link></div>
  </section>
 </div>;
}
export function ManagementNotice({writable}:{writable:boolean}){return !writable?<p className={styles.notice} role="status"><strong>Changes are disabled in this environment.</strong> Everything here is read-only for now; your role and access are unchanged.</p>:null;}

export function DataTable({caption,columns,rows,empty="No records match this view.",className}:{caption:string;columns:string[];rows:{key:string;cells:ReactNode[]}[];empty?:ReactNode;className?:string}){
 if(!rows.length)return <p className={styles.empty}>{empty}</p>;
 return <><div className={styles.tableWrap}><table className={`${styles.table} ${className??""}`}><caption className="visually-hidden">{caption}</caption><thead><tr>{columns.map(c=><th scope="col" key={c}>{c}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.key}>{row.cells.map((cell,i)=>i===0?<th scope="row" key={i}>{cell}</th>:<td key={i}>{cell}</td>)}</tr>)}</tbody></table></div><ul className={styles.mobileList} aria-label={caption}>{rows.map(row=><li key={row.key}><div className={styles.mobileTitle}>{row.cells[0]}</div><dl>{row.cells.slice(1).map((cell,i)=><div key={i}><dt>{columns[i+1]}</dt><dd>{cell}</dd></div>)}</dl></li>)}</ul></>;
}
/** A banded section: rule + heading + optional description and actions. Never a card. */
export function Section({title,description,children,action,tone,id}:{title:string;description?:ReactNode;children:ReactNode;action?:ReactNode;tone?:"danger"|"operator";id?:string}){
 return <section className={styles.section} data-tone={tone} id={id} aria-labelledby={id?`${id}-title`:undefined}>
  <div className={styles.sectionHead}><div><h2 id={id?`${id}-title`:undefined}>{title}</h2>{description&&<p className={styles.sectionDesc}>{description}</p>}</div>{action&&<div className={styles.sectionActions}>{action}</div>}</div>
  {children}
 </section>;
}
export function Badge({children,role,status}:{children:ReactNode;role?:string;status?:string}){return <span className={styles.badge} data-role={role} data-status={status}>{children}</span>;}
export function RoleBadge({role}:{role:string|null|undefined}){return <Badge role={role??undefined}>{roleLabel(role)}</Badge>;}
export function StatusBadge({status}:{status:string}){return <Badge status={status}>{organizationStatusLabel(status)}</Badge>;}
/** Access as glyph + text: Active (filled), Deactivated (hollow). */
export function AccessMark({active,label}:{active:boolean;label?:string}){return <span className={styles.status} data-on={active||undefined} data-off={!active||undefined}>{label??(active?"Active":"Deactivated")}</span>;}
/** An organization's email policy as plain key / value lines. */
export function PolicyText({policy,selfSignup}:{policy:{domains:readonly string[];exactEmails:readonly string[]};selfSignup?:boolean}){
 return <KeyValue items={[
  {label:"Allowed domains",value:policy.domains.length?policy.domains.join("\n"):"None recorded"},
  {label:"Exact email exceptions",value:policy.exactEmails.length?policy.exactEmails.join("\n"):"None recorded"},
  ...(selfSignup!==undefined?[{label:"Self sign-up",value:selfSignup?"On — a verified address this policy allows may join on its own, as Member":"Off — invitation only"}]:[]),
 ]}/>;
}
export function KeyValue({items}:{items:{label:string;value:ReactNode}[]}){return <dl className={styles.details}>{items.map(i=><div key={i.label}><dt>{i.label}</dt><dd>{i.value}</dd></div>)}</dl>;}

const ACCESS_EVENT_LABEL:Record<string,string>={SELF_SIGNUP:"Joined through self sign-up",ORGANIZATION_SELF_SIGNUP_CHANGED:"Self sign-up setting changed",INVITATION_ACCEPTED:"Invitation accepted",INVITATION_CREATED:"Invitation sent",INVITED:"Invitation sent",INVITATION_RESENT:"Invitation link replaced",INVITATION_REVOKED:"Invitation withdrawn",ROLE_CHANGED:"Role changed",MEMBERSHIP_CHANGED:"Membership changed",MEMBER_DEACTIVATED:"Access removed",MEMBER_REACTIVATED:"Access restored",WORKSPACE_RENAMED:"Workspace renamed",ORGANIZATION_CREATED:"Organization created",ORGANIZATION_POLICY_CHANGED:"Access policy changed",ORGANIZATION_OWNERS_REPLACED:"Organization owners replaced",PLATFORM_MEMBERSHIP_GRANTED:"Access granted by the operator",PLATFORM_ROLE_GRANTED:"Platform authority granted",PLATFORM_BOOTSTRAPPED:"Platform set up",PLATFORM_INVITATION_RESENT:"Operator invitation link replaced",PLATFORM_INVITATION_REVOKED:"Operator invitation withdrawn",ORGANIZATION_CONTEXT_SWITCHED:"Switched organization",PASSWORD_CHANGED:"Password changed"};
/** Access events read as sentences, never as stored codes. */
export function accessEventLabel(action:string){const known=ACCESS_EVENT_LABEL[action];if(known)return known;const words=action.toLowerCase().replaceAll("_"," ");return words.charAt(0).toUpperCase()+words.slice(1);}
export function History({events}:{events:{id:string;at:string;action:string;actorLabel?:string;reason?:string;policyOverridden?:boolean}[]}){return <ol className={styles.history}>{events.length?events.slice(0,50).map(e=><li key={e.id}><strong>{accessEventLabel(e.action)}</strong><p>{e.actorLabel??"Recorded operator"} · {formatDateTime(e.at)} Cairo time</p>{e.reason&&<p>{e.reason}</p>}{e.policyOverridden&&<p>Organization email policy overridden</p>}</li>):<li>No recorded access events for this selection.</li>}</ol>;}
