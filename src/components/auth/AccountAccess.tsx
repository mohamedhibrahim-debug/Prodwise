import { requireWorkspaceAccess } from '@/lib/auth/access';
import { isDemoWriteEnabled } from '@/lib/env';
import { logoutAction } from '@/app/login/actions';
import styles from './auth.module.css';
export async function AccountAccess() {
  const ctx=await requireWorkspaceAccess();
  return <div className={styles.account}><strong>{ctx.actor.label}</strong>
    <span>Role: {ctx.role}{ctx.role==='Viewer'?' · View-only':''}{ctx.isProductLead?' · Product Lead':''}</span>
    <span>Environment: {isDemoWriteEnabled?'business changes enabled':'business changes disabled'}</span>
    <a href="/account">My account</a>{ctx.role==='Admin'&&<a href="/users">Users</a>}
    <form action={logoutAction}><button type="submit">Sign out</button></form>
  </div>;
}
