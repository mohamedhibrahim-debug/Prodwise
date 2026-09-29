import Link from "next/link";
import {notFound} from "next/navigation";
import {userManagementSnapshot,readOrganizationAdministration} from "@/lib/auth/service";
import {hasOrganizationOwnerAuthority,isPlatformOwner} from "@/lib/auth/roles";
import {connectorOverview} from "@/lib/connectors/service";
import {CONNECTOR_LABEL,CONNECTOR_SLUG} from "@/lib/connectors/types";
import {ConnectionPill} from "@/components/connectors/ConnectionPill";
import {ProviderIcon} from "@/components/connectors/icons";
import {StatStrip} from "@/components/workspace/StatStrip";
import {Segmented} from "@/components/workspace/TabToolbar";
import {inviteAction,changeMemberAction,invitationAction,renameWorkspaceAction} from "@/app/users/actions";
import {AdminForm} from "./AdminForm";
import {AccessMark,AdminFrame,Badge,DataTable,History,KeyValue,ManagementNotice,PolicyText,RoleBadge,Section,StatusBadge,styles} from "./AdminUI";
import {MembersList,type MemberRow} from "./MembersList";
import {ADMIN_SECTIONS,OPERATOR_HOME,dateLabel,invitationStatus,roleLabel,type AdminSectionKey} from "./model";
import {GRANT_TEXT,MATRIX_COLUMNS,roleMatrix,type Grant} from "./roles-matrix";
import type {adminAccess} from "./access";
export {OperatorConsole} from "./OperatorConsole";

type Access=Awaited<ReturnType<typeof adminAccess>>;
type Query=Record<string,string|undefined>;
const roleOptions=(owner:boolean)=>[...(owner?["ADMIN"]:[]),"MEMBER","VIEWER"].map(value=>({value,label:roleLabel(value)}));
const orderedEvents=<T extends {at:string}>(events:T[])=>[...events].sort((a,b)=>b.at.localeCompare(a.at));

function GrantCell({grant}:{grant:Grant}){
 const glyph=grant==="yes"?<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8.5l3 3 7-7"/></svg>
  :grant==="lead"||grant==="operator"?<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2 1.5" strokeLinecap="round"/></svg>
  :<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 8h8"/></svg>;
 return <span className={styles.grant} data-grant={grant}>{glyph}{GRANT_TEXT[grant]}</span>;
}

/** Everyday administration of one organization, by task. Authorization is unchanged: pages read, actions decide. */
export async function OrganizationConsole({access,section,path,query}:{access:Access;section:AdminSectionKey;path:string[];query:Query}){
 const [state,admin]=await Promise.all([userManagementSnapshot(),readOrganizationAdministration()]);
 const owner=hasOrganizationOwnerAuthority(access.ctx),operator=isPlatformOwner(access.ctx),scopeWorkspaceId=access.ctx.workspaceId;
 const meta=ADMIN_SECTIONS.find(s=>s.key===section)!;
 const activeMembers=state.members.filter(m=>m.active),owners=activeMembers.filter(m=>m.role==="ORG_OWNER");
 const frame=(content:React.ReactNode,title:string=meta.label,actions?:React.ReactNode,headMeta:React.ReactNode=<>{state.organizationName} · {meta.summary}</>)=>
  <AdminFrame area="organization" active={section} title={title} meta={headMeta} actions={actions} operator={operator} organizationName={state.organizationName}><ManagementNotice writable={access.writable}/>{content}</AdminFrame>;
 const base="/administration/members",hidden={returnTo:base};

 if(section==="organization")return frame(<>
  <Section title="This organization">
   <KeyValue items={[
    {label:"Organization",value:state.organizationName},
    {label:"Workspace",value:state.workspaceName},
    {label:"Status",value:<StatusBadge status={admin.organization.status}/>},
    {label:"Org Owners",value:owners.length?owners.map(m=>m.displayName).join(", "):"No active Org Owner is recorded"},
    {label:"Active members",value:String(activeMembers.length)},
    {label:"Your role here",value:<>{access.ctx.role?roleLabel(access.ctx.role):"Platform access · not a member"}{access.ctx.isProductLead?" · Product Lead":""}{operator?" · Platform Owner":""}</>},
   ]}/>
  </Section>
  <Section title="How Prodwise is organized" description="Three words that appear throughout administration.">
   <dl className={styles.glossary}>
    <div><dt>Organization</dt><dd>The company or business unit whose people and product records stay together — <strong>{state.organizationName}</strong>. Nobody outside it can see its work, and roles are held inside it.</dd></div>
    <div><dt>Workspace</dt><dd>That organization’s working area in Prodwise, where its initiatives, evidence and reviews live — <strong>{state.workspaceName}</strong>. Each organization has one.</dd></div>
    <div><dt>Prodwise</dt><dd>The platform that hosts every organization. Platform authority is held by an operator and is separate from any organization role.</dd></div>
   </dl>
  </Section>
  <Section title="Administration tasks">
   <ul className={styles.directory}>{ADMIN_SECTIONS.filter(s=>s.key!=="organization").map(s=><li key={s.key}><Link prefetch={false} href={s.href}><strong>{s.label}</strong><span>{s.summary}</span><span className={styles.arrow} aria-hidden="true">→</span></Link></li>)}</ul>
  </Section>
 </>);

 if(section==="roles"){
  const rows=roleMatrix();
  return frame(<>
   <Section title="What each role can do" description="Derived from the access rules in code by exercising them with each role, not written by hand. If a rule changes, this table changes with it.">
    <DataTable className={styles.matrix} caption="Roles and permissions" columns={["Capability",...MATRIX_COLUMNS.map(c=>c==="PLATFORM_OWNER"?"Operator":roleLabel(c))]}
     rows={rows.map(r=>({key:r.key,cells:[<span key="cap">{r.label}<small>{r.note}</small></span>,...MATRIX_COLUMNS.map(c=><GrantCell key={c} grant={r.grants[c]}/>)]}))}/>
    <p className={styles.legend}><span><strong>Operator</strong> is the Platform Owner acting across organizations — not an organization role.</span><span><strong>Product Lead</strong> is a per-person flag an administrator sets on an Admin or Member from their member page.</span></p>
   </Section>
   <Section title="How roles are assigned">
    <p className={styles.prose}><strong>Org Owner</strong> is assigned by the operator, never through an invitation. <strong>Admins</strong> are invited or promoted by an Org Owner. <strong>Members</strong> and <strong>Viewers</strong> are invited by any Owner or Admin, or join on their own when the organization allows self sign-up (always as Member).</p>
    <div className={styles.linkRow}><Link prefetch={false} className={styles.textLink} href="/administration/members">Members →</Link><Link prefetch={false} className={styles.textLink} href="/administration/security">Security &amp; access →</Link></div>
   </Section>
  </>);
 }

 if(section==="integrations"){
  const {overview,isDemo}=await connectorOverview();
  const ready=overview.filter(o=>o.ready).length,connected=overview.filter(o=>o.ready&&o.status==="CONNECTED").length;
  return frame(<>
   <Section title="Where connections live" description="Connections are personal. Each person connects their own Jira, Gmail, Google Drive or Figma account and sees only what that account can see; nothing is shared organization-wide, and nothing an import brings in becomes Knowledge until a person confirms it.">
    <p className={styles.prose}>Manage yours under <Link prefetch={false} href="/account/connections">My account → Connected sources</Link>. Administrators cannot connect on someone else’s behalf and cannot see another person’s connections.</p>
   </Section>
   <Section title="Sources available in this installation" description={isDemo?"Connectors are off in the Demo organization: its sources are synthetic, and real data must never enter it.":`${ready} of ${overview.length} set up for this installation · ${connected} connected for you`}
    action={!isDemo&&<Link prefetch={false} className={styles.primary} href="/account/connections">Manage my connected sources</Link>}>
    <ul className={styles.integrations}>{overview.map(o=><li key={o.connector}>
     <span className={styles.integrationIcon}><ProviderIcon connector={o.connector} size={18}/></span>
     <div><strong>{CONNECTOR_LABEL[o.connector]}</strong><span>{!o.ready?"Not set up for this installation — no app credentials are configured, so nobody can connect it yet. Sources can still be recorded by reference.":o.status==="CONNECTED"?`Connected for you${o.accountLabel?` as ${o.accountLabel}`:""}.`:o.status==="NEEDS_RECONNECT"?"Your connection expired or was revoked; reconnect it from Connected sources.":"Not connected for you. Read-only access; you choose what is imported."}</span></div>
     <Link prefetch={false} href={`/account/connections#connector-${CONNECTOR_SLUG[o.connector]}`} aria-label={`${CONNECTOR_LABEL[o.connector]} on Connected sources`}><ConnectionPill ready={o.ready} status={o.status}/></Link>
    </li>)}</ul>
    {operator&&overview.some(o=>!o.ready)&&<p className={styles.summary}>As the operator you can see which settings are missing for each source on Connected sources.</p>}
   </Section>
  </>);
 }

 if(section==="preferences")return frame(<>
  <Section title="Workspace name" description="Shown in the organization switcher and on every page for everyone in this organization.">
   {owner?<AdminForm action={renameWorkspaceAction} scopeWorkspaceId={scopeWorkspaceId} hidden={{returnTo:"/administration/preferences"}} disabled={!access.writable} submit="Save workspace name" fields={[{name:"name",label:"Workspace name",value:state.workspaceName,required:true,maxLength:120}]}/>
   :<><KeyValue items={[{label:"Workspace name",value:state.workspaceName}]}/><p className={styles.notice}>Only an Org Owner or the operator can change the workspace name.</p></>}
  </Section>
  <Section title="Appearance" description="Light or dark working surfaces. A personal choice, remembered in each person’s browser; it never changes what other people see.">
   <div className={styles.linkRow}><Link prefetch={false} className={styles.textLink} href="/account">Choose appearance in My account →</Link></div>
  </Section>
  <Section title="Ask Prodwise" description="Ask Prodwise is configured in My account. There is no organization-wide setting.">
   <div className={styles.linkRow}><Link prefetch={false} className={styles.textLink} href="/account#ask-prodwise">Ask Prodwise preferences in My account →</Link></div>
  </Section>
 </>);

 if(section==="security"){
  const selfSignup=(admin.organization as {selfSignup?:boolean}).selfSignup;
  return frame(<>
   <Section title="Who can join" description={`Addresses that may be invited to, or join, ${state.organizationName}. Managed by the operator; invitations enforce it.`}
    action={operator&&<Link prefetch={false} className={styles.secondary} href={`${OPERATOR_HOME}/policies/${state.organizationId}`}>Change on the operator surface</Link>}>
    <PolicyText policy={admin.organization.emailPolicy} selfSignup={selfSignup}/>
    {selfSignup===undefined&&<p className={styles.summary}>Whether self sign-up is on is recorded on the operator’s access policy for this organization.</p>}
   </Section>
   <Section title="How invitations work">
    <KeyValue items={[
     {label:"Who can invite",value:"Any Org Owner or Admin can invite Members and Viewers. Only an Org Owner can invite an Admin. Org Owners are assigned by the operator."},
     {label:"The link",value:"Shown once, to the person who created it. Email delivery is not configured, so the link must be shared privately."},
     {label:"Expiry",value:"Seven days. Resending replaces the link; the old one stops working immediately."},
     {label:"On acceptance",value:"The invited address is verified, the person sets their own password, and their membership is recorded. No generic passwords exist."},
    ]}/>
    <div className={styles.linkRow}><Link prefetch={false} className={styles.textLink} href="/administration/members?view=invitations">Invitations →</Link></div>
   </Section>
   <Section title="Actions that need care" tone="danger" description="Each of these is reviewed before it is saved and recorded in history. None is new; they are listed here so nobody meets them by surprise.">
    <ul className={styles.dangerList}>
     <li><div><strong>Deactivate a member</strong><p>Removes their access to this organization; their identity and other memberships stay, and access can be restored later. Org Owners and platform identities are protected from this path.</p></div><Link prefetch={false} className={styles.secondary} href="/administration/members">Choose a member</Link></li>
     <li><div><strong>Replace all Org Owners</strong><p>Operator only. Every other Org Owner becomes an Admin; at least one active Org Owner must remain. Recorded with a reason.</p></div>{operator?<Link prefetch={false} className={styles.secondary} href={`${OPERATOR_HOME}/organizations/${state.organizationId}?action=replace`}>Open on the operator surface</Link>:<span className={styles.meta}>Operator only</span>}</li>
     <li><div><strong>Change who may join</strong><p>Operator only. Widening the allowed addresses or turning on self sign-up changes who can enter this organization on their own.</p></div>{operator?<Link prefetch={false} className={styles.secondary} href={`${OPERATOR_HOME}/policies/${state.organizationId}`}>Open on the operator surface</Link>:<span className={styles.meta}>Operator only</span>}</li>
     <li><div><strong>Delete the organization</strong><p>No such action exists in Prodwise. Nothing deletes an organization or its records.</p></div><span className={styles.meta}>Not available to anyone</span></li>
    </ul>
   </Section>
  </>);
 }

 // Members: list, invitations, invite, one member.
 const id=path[0];
 if(id==="invite")return frame(<>
  <Section title="Invite a person" description={`The person receives ${roleLabel("MEMBER")} or ${roleLabel("VIEWER")} access${owner?", or Admin,":""} in ${state.organizationName}. The invitation link is shown once, here; email delivery is not configured, so share it privately.`}>
   <AdminForm action={inviteAction} scopeWorkspaceId={scopeWorkspaceId} hidden={hidden} disabled={!access.writable} submit="Create invitation" cancelHref={base} fields={[{name:"email",label:"Email",type:"email",required:true,autoComplete:"email",hint:"Must be allowed by this organization’s access policy."},{name:"role",label:"Organization role",type:"select",value:"MEMBER",options:roleOptions(owner),hint:owner?undefined:"Only an Org Owner can invite an Admin."}]}/>
  </Section>
  <Section title={`Allowed in ${state.organizationName}`}><PolicyText policy={admin.organization.emailPolicy}/></Section>
 </>,"Invite a person",undefined,<>{state.organizationName} · Members</>);

 if(id){
  const member=state.members.find(m=>m.id===id);if(!member)notFound();
  const protectedAccount=member.role==="ORG_OWNER"||member.platformRole==="PLATFORM_OWNER",restrictedAdmin=member.role==="ADMIN"&&!owner;
  return frame(<div className={styles.detailColumns}><div>
   <Section title="Membership">
    <KeyValue items={[{label:"Email",value:member.email},{label:"Organization",value:state.organizationName},{label:"Role",value:<RoleBadge role={member.role}/>},{label:"Access",value:<AccessMark active={member.active}/>},{label:"Weekly Review",value:member.isProductLead?"Product Lead — can finalize reviews":"Standard — finalization follows role"},...(member.platformRole?[{label:"Platform authority",value:<Badge role="PLATFORM_OWNER">Platform Owner · global</Badge>}]:[])]}/>
   </Section>
   <Section title="Change access" description={protectedAccount?undefined:"Reviewed before saving; recorded in this organization’s history."}>
    {protectedAccount?<p className={styles.notice}><strong>Protected account.</strong> Org Owners and platform identities are changed only on the operator surface, never from here.</p>
    :restrictedAdmin?<p className={styles.notice}>Only an Org Owner or the operator can change an Admin’s access.</p>
    :<AdminForm action={changeMemberAction} scopeWorkspaceId={scopeWorkspaceId} hidden={{returnTo:`${base}/${member.id}`,memberId:member.id}} disabled={!access.writable} submit="Update access" consequence={`This changes ${member.displayName}’s membership in ${state.organizationName}. Deactivation removes organization access; the global identity and other memberships remain and access can be restored later.`} fields={[{name:"role",label:"Organization role",type:"select",value:member.role,options:roleOptions(owner)},{name:"active",label:"Organization access",type:"select",value:String(member.active),options:[{value:"true",label:"Active"},{value:"false",label:"Deactivated"}]},{name:"isProductLead",label:"Weekly Review finalization",type:"select",value:String(member.isProductLead),options:[{value:"false",label:"Standard — follows role"},{value:"true",label:"Product Lead — can finalize reviews"}],hint:"Available to Admins and Members. A Viewer cannot receive Product Lead capability."}]}/>}
   </Section>
  </div><aside className={styles.side}><Section title="Recorded history"><History events={orderedEvents(state.events.filter(e=>e.targetId===member.id||e.targetId===member.userId))}/></Section></aside></div>,member.displayName,undefined,<>{state.organizationName} · Members · {roleLabel(member.role)}</>);
 }

 const invitations=query.view==="invitations";
 const pending=state.invitations.filter(i=>invitationStatus(i,state.capturedAt)==="Pending");
 const rows:MemberRow[]=state.members.map(m=>({id:m.id,name:m.displayName,email:m.email,role:m.role,active:m.active,joinedVia:m.joinedVia??null,productLead:m.isProductLead,protectedReason:m.platformRole==="PLATFORM_OWNER"?"Platform identity · operator only":m.role==="ORG_OWNER"?"Owner · operator only":null}));
 return frame(<>
  <StatStrip label="Membership summary" dense items={[
   {key:"active",value:activeMembers.length,label:"Active members",hint:`${state.members.length-activeMembers.length} deactivated`},
   {key:"owners",value:owners.length,label:"Org Owners",hint:owners.length?"Assigned by the operator":"None active — setup incomplete",tone:owners.length?"neutral":"attention"},
   {key:"admins",value:activeMembers.filter(m=>m.role==="ADMIN").length,label:"Admins",hint:"Manage members and access"},
   {key:"leads",value:activeMembers.filter(m=>m.isProductLead).length,label:"Product Leads",hint:"Can finalize Weekly Reviews"},
   {key:"pending",value:pending.length,label:"Pending invitations",hint:pending.length?"Links expire after seven days":"None waiting",href:`${base}?view=invitations`,tone:pending.length?"schedule":"neutral"},
  ]}/>
  <Section title={invitations?"Invitations":"People"} description={invitations?"Every invitation sent for this organization. Resending replaces the link; email delivery is not configured, so links are shared privately.":"Everyone with a membership in this organization. Open a person to change their role, access or Product Lead flag."}
   action={<><Segmented label="Members or invitations" items={[{key:"members",label:"Members",count:state.members.length,href:base,current:!invitations},{key:"invitations",label:"Invitations",count:state.invitations.length,href:`${base}?view=invitations`,current:invitations}]}/>{!invitations&&<Link prefetch={false} className={styles.primary} href={`${base}/invite`}>Invite a person</Link>}</>}>
   {invitations?<>
    <DataTable caption="Organization invitations" columns={["Email","Role","State","Expires","Created by","Open"]} empty="No invitations have been created for this organization."
     rows={state.invitations.map(i=>{const status=invitationStatus(i,state.capturedAt);return {key:i.id,cells:[i.email,<RoleBadge key="r" role={i.role}/>,<span key="s" className={styles.status} data-on={status==="Accepted"||undefined} data-warn={status==="Pending"||undefined} data-off={status==="Revoked"||status==="Expired"||undefined}>{status}</span>,dateLabel(i.expiresAt),i.provisionedByPlatform?"Operator":"Organization administrator",<Link prefetch={false} key="i" href={`${base}?view=invitations&invite=${i.id}`}>Open →</Link>]};})}/>
    {state.invitations.filter(i=>i.id===query.invite).map(i=>{const status=invitationStatus(i,state.capturedAt),editable=status==="Pending"&&!i.provisionedByPlatform&&(owner||i.role!=="ADMIN");return <div key={i.id} className={styles.subsection} id={`invite-${i.id}`}><h3>{i.email}</h3><p className={styles.summary}>{roleLabel(i.role)} · {status} · expires {dateLabel(i.expiresAt)}{i.provisionedByPlatform?" · created by the operator":""}</p>
     {editable?<AdminForm action={invitationAction} scopeWorkspaceId={scopeWorkspaceId} hidden={{returnTo:`${base}?view=invitations`,inviteId:i.id}} disabled={!access.writable} submit="Update invitation" fields={[{name:"operation",label:"Invitation action",type:"select",value:"resend",options:[{value:"resend",label:"Resend — replace the link"},{value:"revoke",label:"Revoke invitation"}],hint:"Resend shows a new link once and invalidates the previous one."}]}/>
     :<p className={styles.notice}>{status!=="Pending"?`This invitation is ${status.toLowerCase()}; nothing further can be done with it.`:i.provisionedByPlatform?"Created by the operator; managed on the operator surface.":"Only an Org Owner can manage an Admin invitation."}</p>}</div>;})}
   </>:<MembersList members={rows} base={base} initialQuery={query.q??""}/>}
  </Section>
 </>);
}

