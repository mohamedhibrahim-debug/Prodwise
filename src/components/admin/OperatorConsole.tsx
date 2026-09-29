import Link from "next/link";
import {notFound} from "next/navigation";
import {AutoFilterForm} from "./AutoFilterForm";
import {platformSnapshot} from "@/lib/auth/service";
import {StatStrip} from "@/components/workspace/StatStrip";
import {OpenOrganizationForm} from "./OpenOrganizationForm";
import {accessPolicyAction,createOrganizationAction,provisionMembershipAction,replaceOrgOwnersAction,platformInvitationAction} from "@/app/platform/actions";
import {AdminForm} from "./AdminForm";
import {AccessMark,AdminFrame,Badge,DataTable,History,KeyValue,ManagementNotice,PolicyText,RoleBadge,Section,StatusBadge,styles} from "./AdminUI";
import {OPERATOR_HOME,OPERATOR_SECTIONS,ORGANIZATION_STATUSES,activeOrganizationMembers,dateLabel,invitationStatus,organizationStatusLabel,roleLabel,type OperatorSectionKey} from "./model";
import type {adminAccess,PlatformState} from "./access";

type Access=Awaited<ReturnType<typeof adminAccess>>;
type Query=Record<string,string|undefined>;
const allRoles=["ORG_OWNER","ADMIN","MEMBER","VIEWER"].map(value=>({value,label:roleLabel(value)}));
const person=(s:PlatformState,id:string)=>s.identities.find(x=>x.id===id);
const orderedEvents=<T extends {at:string}>(events:T[])=>[...events].sort((a,b)=>b.at.localeCompare(a.at));

function Filters({query,organizationOptions,statuses,roles=false}:{query:Query;organizationOptions?:{id:string;name:string}[];statuses?:boolean;roles?:boolean}){
 const active=Boolean(query.q||query.role||query.organization||(query.status&&query.status!=="ACTIVE"));
 return <AutoFilterForm className={styles.filterBar} clearHref={active?"?":undefined}>
  <label className={styles.search}><span className="visually-hidden">Search</span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.75"/><path d="M10.5 10.5L14 14"/></svg><input type="search" name="q" defaultValue={query.q??""} placeholder="Name or email"/></label>
  {statuses&&<label className={styles.field}><span className="visually-hidden">Status</span><select name="status" defaultValue={query.status??"ACTIVE"}>{ORGANIZATION_STATUSES.map(s=><option key={s} value={s}>{organizationStatusLabel(s)}</option>)}<option value="ALL">All statuses</option></select></label>}
  {organizationOptions&&<label className={styles.field}><span className="visually-hidden">Organization</span><select name="organization" defaultValue={query.organization??""}><option value="">All organizations</option>{organizationOptions.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
  {roles&&<label className={styles.field}><span className="visually-hidden">Role</span><select name="role" defaultValue={query.role??""}><option value="">All organization roles</option>{allRoles.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select></label>}
 </AutoFilterForm>;
}

/**
 * The operator surface: platform-wide authority over organizations, global
 * identities and access policies. Reached only by a Platform Owner; every
 * action here is the same recorded platform action as before.
 */
export async function OperatorConsole({access,section,path,query,organizationName}:{access:Access;section:OperatorSectionKey;path:string[];query:Query;organizationName:string}){
 const state=await platformSnapshot();const id=path[0];
 const base=OPERATOR_HOME,returnTo=`${base}/${section}${id?`/${id}`:""}`,hidden={returnTo},scopeWorkspaceId=access.ctx.workspaceId;
 const active=(orgId:string)=>activeOrganizationMembers(state.memberships,state.identities,orgId);
 const sectionMeta=OPERATOR_SECTIONS.find(s=>s.key===section)!;
 const frame=(content:React.ReactNode,title:string=sectionMeta.label,actions?:React.ReactNode,meta:React.ReactNode="Operator · every organization on this installation")=>
  <AdminFrame area="operator" active={section} title={title} meta={meta} actions={actions} operator organizationName={organizationName}><ManagementNotice writable={access.writable}/>{content}</AdminFrame>;

 if(section==="organizations"&&id==="new")return frame(<Section title="Organization details" description="The organization stays in “Needs owner” until you assign an Org Owner. Existing organizations and memberships are unchanged.">
  <AdminForm action={createOrganizationAction} scopeWorkspaceId={scopeWorkspaceId} hidden={hidden} disabled={!access.writable} submit="Create organization" cancelHref={`${base}/organizations`} fields={[{name:"name",label:"Organization name",required:true,maxLength:120},{name:"domains",label:"Allowed email domains",type:"textarea",hint:"One domain per line, for example examplebank.com."},{name:"exactEmails",label:"Exact email exceptions",type:"textarea",hint:"Each address allows only that person, not their whole domain."}]}/>
  <div className={styles.linkRow}><Link prefetch={false} className={styles.textLink} href={`${base}/organizations?status=BOOTSTRAPPING`}>Organizations that need an owner →</Link></div>
 </Section>,"New organization",undefined,"Operator · Organizations");

 if(section==="organizations"&&!id){
  const status=[...ORGANIZATION_STATUSES,"ALL"].includes(query.status??"")?query.status!:"ACTIVE",q=(query.q??"").toLowerCase();
  const rows=state.organizations.filter(o=>(status==="ALL"||o.status===status)&&o.name.toLowerCase().includes(q));
  const count=(s:string)=>state.organizations.filter(o=>o.status===s).length;
  return frame(<>
   <StatStrip label="Organizations by status" dense items={[
    {key:"active",value:count("ACTIVE"),label:organizationStatusLabel("ACTIVE"),hint:"Owner assigned, open for work",href:`${base}/organizations?status=ACTIVE`,tone:"neutral"},
    {key:"bootstrapping",value:count("BOOTSTRAPPING"),label:organizationStatusLabel("BOOTSTRAPPING"),hint:"Created; no Org Owner yet",href:`${base}/organizations?status=BOOTSTRAPPING`,tone:count("BOOTSTRAPPING")?"attention":"neutral"},
    {key:"archived",value:count("ARCHIVED"),label:organizationStatusLabel("ARCHIVED"),hint:"Read-only; nothing is deleted",href:`${base}/organizations?status=ARCHIVED`,tone:"unknown"},
   ]}/>
   <Section title="Organization register" description={`${rows.length} of ${state.organizations.length} organizations shown`} action={<Link prefetch={false} className={styles.primary} href={`${base}/organizations/new`}>Create organization</Link>}>
    <Filters query={{...query,status}} statuses/>
    <DataTable caption="Organizations on this installation" columns={["Organization","Status","Org Owners","Active members","Pending operator invitations","Access policy","Open"]} empty="No organizations match these filters."
     rows={rows.map(org=>{const owners=active(org.id).filter(m=>m.role==="ORG_OWNER").length,invites=state.invitations.filter(i=>i.organizationId===org.id&&invitationStatus(i,state.capturedAt)==="Pending").length;return {key:org.id,cells:[
      <span key="name">{org.name}{"isDemo" in org&&org.isDemo?<small>{org.status==="ARCHIVED"?"Archived synthetic generation":"Synthetic demo"}</small>:null}</span>,
      <StatusBadge key="status" status={org.status}/>,
      owners?String(owners):<span className={styles.status} data-warn="">0 · needs owner</span>,
      String(active(org.id).length),
      String(invites),
      `${org.emailPolicy.domains.length} ${org.emailPolicy.domains.length===1?"domain":"domains"} · ${org.emailPolicy.exactEmails.length} exact`,
      <Link prefetch={false} key="open" href={`${base}/organizations/${org.id}`} aria-label={`Open ${org.name}`}>Open →</Link>]};})}/>
   </Section>
  </>);
 }

 if(section==="organizations"&&id){
  const org=state.organizations.find(o=>o.id===id);if(!org)notFound();
  const members=state.memberships.filter(m=>m.organizationId===id),owners=active(id).filter(m=>m.role==="ORG_OWNER"),workspaces=state.workspaces.filter(w=>w.organizationId===id&&w.status==="ACTIVE"),archived=org.status==="ARCHIVED";
  const invites=state.invitations.filter(i=>i.organizationId===id);
  return frame(<>
   <div className={styles.detailColumns}><div>
    <Section title="Overview">
     <KeyValue items={[{label:"Status",value:<StatusBadge status={org.status}/>},{label:"Org Owners",value:owners.length?owners.map(m=>person(state,m.userId)?.displayName).join(", "):<span className={styles.status} data-warn="">No active owner — setup is incomplete</span>},{label:"Active members",value:String(active(id).length)},{label:"Access policy",value:<>{org.emailPolicy.domains.join(", ")||"No domains"} · {org.emailPolicy.exactEmails.length} exact {org.emailPolicy.exactEmails.length===1?"exception":"exceptions"}</>}]}/>
     <div className={styles.actions}>{org.status==="ACTIVE"&&workspaces.length===1&&owners.length>0&&<OpenOrganizationForm workspaceId={workspaces[0]!.id} scopeWorkspaceId={scopeWorkspaceId}/>}<Link prefetch={false} className={styles.secondary} href={`${base}/policies/${id}`}>Access policy</Link><Link prefetch={false} className={styles.secondary} href={`${base}/identities?organization=${id}`}>People with access</Link></div>
    </Section>
    <Section title="Memberships">
     <DataTable caption={`Members of ${org.name}`} columns={["Person","Role","Access","Open"]} empty="No memberships are recorded." rows={members.map(m=>({key:m.id,cells:[<span key="p">{person(state,m.userId)?.displayName??"Unavailable identity"}<small>{person(state,m.userId)?.email}</small></span>,<RoleBadge key="r" role={m.role}/>,<AccessMark key="a" active={Boolean(m.active&&person(state,m.userId)?.active)}/>,<Link prefetch={false} key="open" href={`${base}/identities/${m.userId}`}>Open person →</Link>]}))}/>
    </Section>
    {!archived&&<Section title="Grant organization access" id="grant" description="Add a person, add another Org Owner, or change an existing membership through a recorded operator action.">
     {query.action==="grant"?<AdminForm action={provisionMembershipAction} scopeWorkspaceId={scopeWorkspaceId} hidden={{...hidden,organizationId:id}} disabled={!access.writable} submit="Grant organization access" cancelHref={returnTo} consequence={`This grants the selected role in ${org.name}. Existing account credentials are unchanged. Any email-policy override is recorded with your identity and reason.`} fields={[{name:"email",label:"Person’s email",type:"email",required:true},{name:"role",label:"Organization role",type:"select",value:"MEMBER",options:allRoles,showPrevious:false},{name:"policyOverride",label:"Deliberately override this organization’s email policy",type:"checkbox",hint:"Leave off to enforce the allowed domains and exact email exceptions."},{name:"reason",label:"Reason for this access change",type:"textarea",required:true,maxLength:500}]}/>
     :<div className={styles.actions}><Link prefetch={false} className={styles.primary} href={`${returnTo}?action=grant#grant`}>Grant access</Link></div>}
    </Section>}
    {!archived&&members.some(m=>m.active&&person(state,m.userId)?.active)&&<Section title="Replace all Org Owners" tone="danger" id="replace" description="Every other Org Owner becomes an Admin; at least one active Org Owner must remain. To keep existing owners, grant access instead.">
     {query.action==="replace"?<AdminForm action={replaceOrgOwnersAction} scopeWorkspaceId={scopeWorkspaceId} hidden={{...hidden,organizationId:id}} disabled={!access.writable} submit="Replace all owners" cancelHref={returnTo} consequence={`Replace all Org Owners of ${org.name} with the selected person. Existing other owners become Admins. At least one active Org Owner must remain.`} fields={[{name:"userId",label:"New Org Owner",type:"select",value:"",previousLabel:owners.map(m=>person(state,m.userId)?.displayName??"Recorded owner").join(", ")||"No active owner",required:true,options:[{value:"",label:"Choose an active member"},...members.filter(m=>m.active&&person(state,m.userId)?.active).map(m=>({value:m.userId,label:person(state,m.userId)?.displayName??"Recorded member"}))]},{name:"reason",label:"Reason",type:"textarea",required:true,maxLength:500}]}/>
     :<div className={styles.actions}><Link prefetch={false} className={styles.secondary} href={`${returnTo}?action=replace#replace`}>Replace all owners…</Link></div>}
    </Section>}
    <Section title="Operator invitations" description="Invitations created from this surface. Organization administrators see them as created by the operator.">
     <DataTable caption={`${org.name} operator invitations`} columns={["Email","Role","State","Expires","Open"]} empty="No operator invitations recorded." rows={invites.map(i=>({key:i.id,cells:[i.email,<RoleBadge key="r" role={i.role}/>,invitationStatus(i,state.capturedAt),dateLabel(i.expiresAt),<Link prefetch={false} key="invite" href={`${returnTo}?invite=${i.id}#invite-${i.id}`}>Open →</Link>]}))}/>
     {invites.filter(i=>i.id===query.invite).map(invite=><div className={styles.subsection} key={invite.id} id={`invite-${invite.id}`}><h3>{invite.email}</h3><p className={styles.summary}>{roleLabel(invite.role)} · {invitationStatus(invite,state.capturedAt)} · expires {dateLabel(invite.expiresAt)}</p>{!archived&&!invite.usedAt&&!invite.revokedAt&&<AdminForm action={platformInvitationAction} scopeWorkspaceId={scopeWorkspaceId} hidden={{...hidden,invitationId:invite.id}} disabled={!access.writable} submit="Update invitation" fields={[{name:"operation",label:"Invitation action",type:"select",value:"resend",options:[{value:"resend",label:"Resend — replace the link"},{value:"revoke",label:"Revoke invitation"}]},{name:"reason",label:"Reason",type:"textarea",required:true,maxLength:500}]}/>}</div>)}
    </Section>
   </div><aside className={styles.side}>
    <Section title="Recorded history"><History events={orderedEvents(state.events.filter(e=>e.organizationId===id))}/></Section>
   </aside></div>
  </>,org.name,undefined,<>Operator · Organizations · {organizationStatusLabel(org.status)}</>);
 }

 if(section==="identities"&&!id){
  const q=(query.q??"").toLowerCase();
  const ids=state.identities.filter(p=>(p.displayName+" "+p.email).toLowerCase().includes(q)&&(!query.organization||state.memberships.some(m=>m.userId===p.id&&m.organizationId===query.organization))&&(!query.role||state.memberships.some(m=>m.userId===p.id&&m.role===query.role&&(!query.organization||m.organizationId===query.organization))));
  return frame(<Section title="Global identities" description={`${ids.length} of ${state.identities.length} people. An identity is global; each organization role is held inside one organization, and platform authority is separate from both.`}>
   <Filters query={query} organizationOptions={state.organizations} roles/>
   <DataTable caption="Global identities and memberships" columns={["Person","Platform authority","Organizations","Identity","Open"]} empty="No people match these filters." rows={ids.map(p=>({key:p.id,cells:[<span key="p">{p.displayName}<small>{p.email}</small></span>,p.platformRole?<Badge key="role" role="PLATFORM_OWNER">Platform Owner · global</Badge>:<span className={styles.dash}>—</span>,state.memberships.filter(m=>m.userId===p.id).map(m=><p key={m.id}>{state.organizations.find(o=>o.id===m.organizationId)?.name??"Unavailable organization"} · {roleLabel(m.role)}{!m.active?" · deactivated":""}</p>),<AccessMark key="a" active={p.active}/>,<Link prefetch={false} key="open" href={`${base}/identities/${p.id}`} aria-label={`Open ${p.displayName}`}>Open →</Link>]}))}/>
  </Section>);
 }

 if(section==="identities"&&id){
  const identity=person(state,id);if(!identity)notFound();const memberships=state.memberships.filter(m=>m.userId===id);
  return frame(<div className={styles.detailColumns}><div>
   <Section title="Identity"><KeyValue items={[{label:"Email",value:identity.email},{label:"Identity",value:<AccessMark active={identity.active}/>},{label:"Platform authority",value:identity.platformRole?<Badge role="PLATFORM_OWNER">Platform Owner · global</Badge>:"None — organization roles only"}]}/></Section>
   <Section title="Organization memberships" description="Roles are granted or changed from the named organization. Organization roles never grant platform authority.">
    <DataTable caption={`Memberships for ${identity.displayName}`} columns={["Organization","Role","Access","Weekly Review","Policy","Open"]} empty="No memberships are recorded for this person." rows={memberships.map(m=>({key:m.id,cells:[state.organizations.find(o=>o.id===m.organizationId)?.name??"Unavailable organization",<RoleBadge key="r" role={m.role}/>,<AccessMark key="a" active={m.active}/>,m.isProductLead?"Product Lead":"Standard",m.policyOverride?<span key="override">Recorded override<small>{m.policyOverrideReason??"Reason not recorded"}</small></span>:"Organization policy",<Link prefetch={false} key="org" href={`${base}/organizations/${m.organizationId}`}>Open organization →</Link>]}))}/>
   </Section>
  </div><aside className={styles.side}><Section title="Recorded history"><History events={orderedEvents(state.events.filter(e=>e.targetId===id||memberships.some(m=>m.id===e.targetId)))}/></Section></aside></div>,identity.displayName,undefined,<>Operator · Identities{identity.platformRole?" · Platform Owner":""}</>);
 }

 if(section==="policies"&&!id)return frame(<Section title="Access policies by organization" description="Who may be invited to, or join, each organization. An exact email exception never allows its whole domain.">
  <DataTable caption="Email policies by organization" columns={["Organization","Allowed domains","Exact exceptions","Self sign-up","Recorded overrides","Open"]} rows={state.organizations.map(org=>({key:org.id,cells:[org.name,org.emailPolicy.domains.join(", ")||"None recorded",org.emailPolicy.exactEmails.join(", ")||"None recorded",<span key="s" className={styles.status} data-on={(org as {selfSignup?:boolean}).selfSignup||undefined} data-off={!(org as {selfSignup?:boolean}).selfSignup||undefined}>{(org as {selfSignup?:boolean}).selfSignup?"On":"Off"}</span>,String(state.memberships.filter(m=>m.organizationId===org.id&&m.policyOverride).length),<Link prefetch={false} key="open" href={`${base}/policies/${org.id}`} aria-label={`Open ${org.name} policy`}>Open →</Link>]}))}/>
 </Section>);

 const org=state.organizations.find(o=>o.id===id);if(!org)notFound();
 const selfSignup=Boolean((org as {selfSignup?:boolean}).selfSignup);
 return frame(<>
  <Section title="Current policy" description={`Applies to ${org.name} only. An exact email exception does not allow its entire domain.`}><PolicyText policy={org.emailPolicy} selfSignup={selfSignup}/></Section>
  {org.status!=="ARCHIVED"&&<Section title="Change access policy" tone="danger" description="Widening the policy or turning on self sign-up changes who can enter this organization on their own. Reviewed before saving; a reason is recorded when self sign-up changes.">
   <AdminForm action={accessPolicyAction} scopeWorkspaceId={scopeWorkspaceId} hidden={{...hidden,organizationId:org.id,currentDomains:org.emailPolicy.domains.join("\n"),currentExactEmails:org.emailPolicy.exactEmails.join("\n"),currentSelfSignup:selfSignup?"on":""}} disabled={!access.writable} submit="Save access policy" consequence={`This changes who can be invited to or join ${org.name} only. Self sign-up always creates a Member; roles above Member still need an administrator. Existing members are unchanged. Other organizations are unchanged.`} fields={[{name:"domains",label:"Allowed domains",type:"textarea",value:org.emailPolicy.domains.join("\n"),hint:"One exact domain per line."},{name:"exactEmails",label:"Exact email exceptions",type:"textarea",value:org.emailPolicy.exactEmails.join("\n"),hint:"One exact address per line. An exception never allows its whole domain."},{name:"enabled",label:"Allow people with an allowed, verified address to join on their own (as Member)",type:"checkbox",value:selfSignup?"on":""},{name:"reason",label:"Reason (required when changing self sign-up)",type:"textarea",maxLength:500,hint:"Recorded in platform history."}]}/>
  </Section>}
  <Section title="Recorded policy and access history"><History events={orderedEvents(state.events.filter(e=>e.organizationId===org.id))}/></Section>
 </>,`${org.name} access policy`,undefined,"Operator · Access policies");
}
