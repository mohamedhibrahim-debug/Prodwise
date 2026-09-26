import { requireWorkspaceAccess } from '@/lib/auth/access';
import { userManagementSnapshot } from '@/lib/auth/service';
import { AuthForm } from '@/components/auth/AuthForm';
import styles from '@/components/auth/auth.module.css';
import { inviteAction,changeMemberAction,invitationAction } from './actions';
import Link from 'next/link';
export const dynamic='force-dynamic';
export default async function Users() {
  const ctx=await requireWorkspaceAccess();
  if(ctx.role!=='Admin') return <section className={styles.page}><h1>User management is restricted</h1><p>Only an Admin can manage workspace access.</p><Link href="/">Go to Home</Link></section>;
  const state=await userManagementSnapshot();
  const writable=process.env.MANAGEMENT_WRITE_ENABLED==='true'&&process.env.VERCEL_ENV!=='preview';
  return <section className={styles.page}><p>{state.workspaceName} · Settings</p><h1>Users</h1>
    <p className={styles.role}>Admin manages access. Member works on initiatives. Viewer can inspect the workspace. Product Lead is a separate capability for Admins and Members.</p>
    {!writable&&<p role="status">User management changes are disabled in this environment.</p>}
    <details><summary>Invite a person</summary><AuthForm action={inviteAction} submit="Create invitation" disabled={!writable}><fieldset disabled={!writable}>
      <label>Email<input name="email" type="email" required/></label><label>Role<select name="role" defaultValue="Member"><option>Admin</option><option>Member</option><option>Viewer</option></select></label>
    </fieldset></AuthForm></details>
    <h2>Workspace members</h2>{state.members.map(member=><div className={styles.row} key={member.id}><div><h3>{member.displayName}</h3><p>{member.email}</p><p>{member.role} · {member.active?'Active':'Deactivated'}{member.isProductLead?' · Product Lead':''}</p></div>
      <AuthForm action={changeMemberAction} submit="Update access" disabled={!writable}><input name="memberId" type="hidden" value={member.id}/><fieldset disabled={!writable}>
        <label>Role<select name="role" defaultValue={member.role}><option>Admin</option><option>Member</option><option>Viewer</option></select></label>
        <label>Access<select name="active" defaultValue={String(member.active)}><option value="true">Active</option><option value="false">Deactivated</option></select></label>
        <label>Review finalization<select name="isProductLead" defaultValue={String(member.isProductLead)}><option value="false">Standard access</option><option value="true">Product Lead capability (Admin / Member)</option></select></label>
      </fieldset></AuthForm></div>)}
    <h2>Invitations</h2>{state.invitations.length===0?<p>No invitations recorded.</p>:state.invitations.map(invite=><div className={styles.row} key={invite.id}><div><strong>{invite.email}</strong><p>{invite.role} · {invite.usedAt?'Accepted':invite.revokedAt?'Revoked':Date.parse(invite.expiresAt)<=state.capturedAt?'Expired':'Invited'}</p><p>Expires {new Date(invite.expiresAt).toLocaleDateString('en-GB')}</p></div>
      {!invite.usedAt&&!invite.revokedAt&&<AuthForm action={invitationAction} submit="Update invitation" disabled={!writable}><input name="inviteId" type="hidden" value={invite.id}/><fieldset disabled={!writable}><label>Action<select name="operation"><option value="resend">Resend — replace old link</option><option value="revoke">Revoke invitation</option></select></label></fieldset></AuthForm>}</div>)}
    <details><summary>Recorded access history</summary>{state.events.length===0?<p>No membership events recorded yet.</p>:state.events.map(event=><p key={event.id}>{new Date(event.at).toLocaleString('en-GB')} · {event.action.replaceAll('_',' ')} · Actor {event.actorLabel??'Recorded operator'}</p>)}</details>
  </section>;
}
