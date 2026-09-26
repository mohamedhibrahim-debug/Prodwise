import Link from 'next/link';
import { requireWorkspaceAccess } from '@/lib/auth/access';
import { platformSnapshot } from '@/lib/auth/service';
import { isPlatformOwner } from '@/lib/auth/roles';
import { AuthForm } from '@/components/auth/AuthForm';
import styles from '@/components/auth/auth.module.css';
import { createOrganizationAction,configurePolicyAction,provisionMembershipAction,replaceOrgOwnersAction,grantPlatformOwnerAction,platformInvitationAction } from './actions';
export const dynamic='force-dynamic';
export default async function Platform(){
 const ctx=await requireWorkspaceAccess();
 if(!isPlatformOwner(ctx))return <section className={styles.page}><h1>Platform administration is restricted</h1><p>Global Platform Owner authority is required.</p><Link href="/">Go to Home</Link></section>;
 const state=await platformSnapshot();
 const writable=process.env.MANAGEMENT_WRITE_ENABLED==='true'&&process.env.VERCEL_ENV!=='preview';
 const person=(id:string)=>state.identities.find(identity=>identity.id===id)?.email??id;
 return <section className={styles.page}><p>Global administration</p><h1>Platform administration</h1>
  <p>Platform authority is independent from organization membership. Each organization maintains its own access policy.</p>
  {!writable&&<p role="status">Platform administration changes are disabled in this environment.</p>}
  <Link href="/users">Current organization users</Link>
  <details><summary>Create organization</summary><AuthForm action={createOrganizationAction} submit="Create organization" disabled={!writable}><fieldset disabled={!writable}>
   <label>Organization name<input name="name" required maxLength={120}/></label>
   <label>Allowed domains<textarea name="domains" placeholder="examplebank.com"/></label>
   <label>Exact allowed emails<textarea name="exactEmails"/></label>
  </fieldset></AuthForm><p>A new organization needs an Org Owner before normal access is available.</p></details>
  <h2>Organizations</h2>
  {state.organizations.map(org=><div className={styles.card} key={org.id}><h3>{org.name}</h3><p>{org.status} · {state.memberships.filter(member=>member.organizationId===org.id&&member.active&&member.role==='ORG_OWNER').length} active Org Owners</p>
   <details><summary>Access policy for {org.name}</summary><AuthForm action={configurePolicyAction} submit="Save organization policy" disabled={!writable}><input type="hidden" name="organizationId" value={org.id}/><fieldset disabled={!writable}>
    <label>Allowed domains<textarea name="domains" defaultValue={org.emailPolicy.domains.join('\n')}/></label>
    <label>Exact allowed emails<textarea name="exactEmails" defaultValue={org.emailPolicy.exactEmails.join('\n')}/></label>
   </fieldset></AuthForm><p>Each entry is exact. An email exception does not allow its entire domain.</p></details>
   <details><summary>Grant organization access for {org.name}</summary><AuthForm action={provisionMembershipAction} submit="Grant organization access" disabled={!writable}><input type="hidden" name="organizationId" value={org.id}/><fieldset disabled={!writable}>
    <label>User email<input type="email" name="email" required/></label>
    <label>Organization role<select name="role" defaultValue="MEMBER">{['ORG_OWNER','ADMIN','MEMBER','VIEWER'].map(role=><option key={role} value={role}>{role}</option>)}</select></label>
    <label><input type="checkbox" name="policyOverride"/>Deliberately override this organization’s email policy for this user</label>
    <label>Reason<textarea name="reason" required maxLength={500}/></label>
   </fieldset></AuthForm><p>Overrides are recorded for this user and organization. Existing identities keep their account credentials.</p></details>
   <details><summary>Replace organization owners for {org.name}</summary><AuthForm action={replaceOrgOwnersAction} submit="Replace organization owners" disabled={!writable}><input type="hidden" name="organizationId" value={org.id}/><fieldset disabled={!writable}>
    <label>New Org Owner<select name="userId" required><option value="">Choose an active organization member</option>{state.memberships.filter(member=>member.organizationId===org.id&&member.active).map(member=><option key={member.id} value={member.userId}>{person(member.userId)}</option>)}</select></label>
    <label>Reason<textarea name="reason" required maxLength={500}/></label>
   </fieldset></AuthForm><p>This replaces all current Org Owners with the selected member. Previous owners become Admins. Use Grant organization access to add another owner while keeping existing owners.</p></details>
   <div>{state.memberships.filter(member=>member.organizationId===org.id).map(member=><p key={member.id}>{person(member.userId)} · {member.role} · {member.active?'Active':'Deactivated'}{member.policyOverride?' · Recorded email-policy override':''}</p>)}</div>
  </div>)}
  <h2>Global identities</h2>{state.identities.map(identity=><p key={identity.id}>{identity.email} · {identity.platformRole??'No platform role'}</p>)}
  <h2>Platform invitations</h2>{state.invitations.filter(invite=>invite.provisionedByPlatform).map(invite=><div className={styles.row} key={invite.id}><div><strong>{invite.email}</strong><p>{state.organizations.find(org=>org.id===invite.organizationId)?.name} · {invite.role} · {invite.usedAt?'Accepted':invite.revokedAt?'Revoked':Date.parse(invite.expiresAt)<=state.capturedAt?'Expired':'Invited'}</p><p>Expires {new Date(invite.expiresAt).toLocaleDateString('en-GB')}</p></div>
   {!invite.usedAt&&!invite.revokedAt&&<AuthForm action={platformInvitationAction} submit="Update platform invitation" disabled={!writable}><input type="hidden" name="invitationId" value={invite.id}/><fieldset disabled={!writable}>
    <label>Operation<select name="operation"><option value="resend">Resend — replace old link</option><option value="revoke">Revoke</option></select></label>
    <label>Reason<textarea name="reason" required maxLength={500}/></label>
   </fieldset></AuthForm>}
  </div>)}
  <details><summary>Grant global Platform Owner authority</summary><AuthForm action={grantPlatformOwnerAction} submit="Grant Platform Owner" disabled={!writable}><fieldset disabled={!writable}>
   <label>Global identity<select name="userId" required><option value="">Choose an active identity</option>{state.identities.filter(identity=>identity.active&&!identity.platformRole).map(identity=><option key={identity.id} value={identity.id}>{identity.email}</option>)}</select></label>
   <label>Reason<textarea name="reason" required maxLength={500}/></label>
  </fieldset></AuthForm><p>This grants full platform authority across organizations. Organization roles cannot grant it.</p></details>
  <details><summary>Platform access history</summary>{state.events.slice(-100).reverse().map(event=>{
   const after=event.after&&typeof event.after==='object'?event.after as Record<string,unknown>:null;
   const recordedRole=after?.role??after?.platformRole;
   return <p key={event.id}>{event.at} · {event.action.replaceAll('_',' ')} · Actor {event.actorLabel} · Target {person(event.targetId)} · {state.organizations.find(org=>org.id===event.organizationId)?.name??'Global platform'}{typeof recordedRole==='string'&&` · Recorded role ${recordedRole}`} · Policy override {event.policyOverridden?'Yes':'No'}{event.reason&&` · ${event.reason}`}</p>;
  })}</details>
 </section>;
}
