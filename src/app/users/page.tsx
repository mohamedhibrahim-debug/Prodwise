import { requireWorkspaceAccess } from '@/lib/auth/access';
import { userManagementSnapshot } from '@/lib/auth/service';
import { hasOrganizationAdminAuthority, hasOrganizationOwnerAuthority } from '@/lib/auth/roles';
import { AuthForm } from '@/components/auth/AuthForm';
import styles from '@/components/auth/auth.module.css';
import { inviteAction,changeMemberAction,invitationAction,renameWorkspaceAction } from './actions';
import Link from 'next/link';
export const dynamic='force-dynamic';
export default async function Users() {
  const ctx=await requireWorkspaceAccess();
  if(!hasOrganizationAdminAuthority(ctx)) return <section className={styles.page}><h1>User management is restricted</h1><p>Only an Org Owner, Admin or Platform Owner can manage workspace access.</p><Link href="/">Go to Home</Link></section>;
  const state=await userManagementSnapshot();
  const writable=process.env.MANAGEMENT_WRITE_ENABLED==='true'&&process.env.VERCEL_ENV!=='preview';
  const roles=hasOrganizationOwnerAuthority(ctx)?['ADMIN','MEMBER','VIEWER']:['MEMBER','VIEWER'];
  const roleOptions=roles.map(role=><option key={role} value={role}>{role}</option>);
  return <section className={styles.page}><p>{state.organizationName} · {state.workspaceName} · Settings</p><h1>Users</h1>
    <p className={styles.role}>Org Owner manages Admin authority and workspace configuration. Admin manages Member and Viewer access. Member works on initiatives. Viewer is read-only. Product Lead is a separate review capability.</p>
    {!writable&&<p role="status">User management changes are disabled in this environment.</p>}
    <details><summary>Invite a person</summary><AuthForm action={inviteAction} submit="Create invitation" disabled={!writable}><fieldset disabled={!writable}>
      <label>Email<input name="email" type="email" required/></label><label>Role<select name="role" defaultValue="MEMBER">{roleOptions}</select></label>
    </fieldset></AuthForm></details>
    <h2>Workspace members</h2>{state.members.map(member=><div className={styles.row} key={member.id}><div><h3>{member.displayName}</h3><p>{member.email}</p><p>{member.role} · {member.active?'Active':'Deactivated'}{member.isProductLead?' · Product Lead':''}</p></div>
      {member.role==='ORG_OWNER'||member.platformRole==='PLATFORM_OWNER'?<p>This account is protected in normal User Management. Platform administration manages organization ownership and platform authority.</p>:member.role==='ADMIN'&&!hasOrganizationOwnerAuthority(ctx)?<p>Only an Org Owner or Platform Owner can change Admin access.</p>:<AuthForm action={changeMemberAction} submit="Update access" disabled={!writable}><input name="memberId" type="hidden" value={member.id}/><fieldset disabled={!writable}>
        <label>Role<select name="role" defaultValue={member.role}>{roleOptions}</select></label>
        <label>Access<select name="active" defaultValue={String(member.active)}><option value="true">Active</option><option value="false">Deactivated</option></select></label>
        <label>Review finalization<select name="isProductLead" defaultValue={String(member.isProductLead)}><option value="false">Standard access</option><option value="true">Product Lead capability (Admin / Member)</option></select></label>
      </fieldset></AuthForm>}</div>)}
    <h2>Invitations</h2>{state.invitations.length===0?<p>No invitations recorded.</p>:state.invitations.map(invite=><div className={styles.row} key={invite.id}><div><strong>{invite.email}</strong><p>{invite.role} · {invite.usedAt?'Accepted':invite.revokedAt?'Revoked':Date.parse(invite.expiresAt)<=state.capturedAt?'Expired':'Invited'}</p><p>Expires {new Date(invite.expiresAt).toLocaleDateString('en-GB')}</p></div>
      {!invite.usedAt&&!invite.revokedAt&&(invite.provisionedByPlatform?<p>Managed in Platform administration.</p>:(hasOrganizationOwnerAuthority(ctx)||invite.role!=='ADMIN')&&<AuthForm action={invitationAction} submit="Update invitation" disabled={!writable}><input name="inviteId" type="hidden" value={invite.id}/><fieldset disabled={!writable}><label>Action<select name="operation"><option value="resend">Resend — replace old link</option><option value="revoke">Revoke invitation</option></select></label></fieldset></AuthForm>)}</div>)}
    {hasOrganizationOwnerAuthority(ctx)&&<details><summary>Workspace configuration</summary><AuthForm action={renameWorkspaceAction} submit="Save workspace name" disabled={!writable}><fieldset disabled={!writable}><label>Workspace name<input name="name" defaultValue={state.workspaceName} required maxLength={120}/></label></fieldset></AuthForm><p>At least one active Org Owner is required. Platform administration manages organization owner assignments.</p></details>}
    <details><summary>Recorded access history</summary>{state.events.length===0?<p>No membership events recorded yet.</p>:state.events.map(event=><p key={event.id}>{new Date(event.at).toLocaleString('en-GB')} · {event.action.replaceAll('_',' ')} · Actor {event.actorLabel??'Recorded operator'}</p>)}</details>
  </section>;
}
