import { hasOrganizationAdminAuthority, canBusinessWrite, isPlatformOwner } from "@/lib/auth/roles";
import { requireWorkspaceAccess } from '@/lib/auth/access';
import { isDemoWriteEnabled } from '@/lib/env';
import { logoutAction } from '@/app/login/actions';
import styles from './auth.module.css';
export async function AccountAccess() {
  const ctx=await requireWorkspaceAccess();
  return <div className={styles.account}><strong>{ctx.actor.label}</strong>
    <span>Organization role: {ctx.role??'No membership'}{!canBusinessWrite(ctx)?' · View-only':''}{ctx.isProductLead?' · Product Lead':''}</span>
    {ctx.platformRole&&<span>Platform role: {ctx.platformRole}</span>}
    <span>Environment: {isDemoWriteEnabled?'business changes enabled':'business changes disabled'}</span>
    <a href="/account">My account</a>{hasOrganizationAdminAuthority(ctx)&&<a href="/users">Users</a>}{isPlatformOwner(ctx)&&<a href="/platform">Platform administration</a>}
    <form action={logoutAction}><button type="submit">Sign out</button></form>
  </div>;
}
