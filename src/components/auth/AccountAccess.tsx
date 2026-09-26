import { hasOrganizationAdminAuthority, canBusinessWrite, isPlatformOwner } from "@/lib/auth/roles";
import { requireWorkspaceAccess } from '@/lib/auth/access';
import { isDemoWriteEnabled } from '@/lib/env';
import { logoutAction } from '@/app/login/actions';
import styles from './auth.module.css';
import { workspacePresentation } from '@/lib/workspace/context';
export async function AccountAccess() {
  const ctx=await requireWorkspaceAccess();
  const workspace=await workspacePresentation(ctx);
  return <div className={styles.account}><div className={styles.workspaceIdentity}><strong>{workspace.organizationName}</strong>
    {workspace.isDemo&&<span>Synthetic scenario · {new Date(workspace.scenarioAt!).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}</span>}
    {!canBusinessWrite(ctx)&&<span className={styles.viewOnly}>Viewer · read-only</span>}
    {!isDemoWriteEnabled&&<span className={styles.environment}>Environment · changes disabled</span>}
  </div><details className={styles.accountMenu}><summary>{ctx.actor.label}<span aria-hidden="true">⌄</span></summary><div className={styles.accountPopover}>
    <p>Organization role: {ctx.role??'No membership'}{ctx.isProductLead?' · Product Lead':''}</p>
    {ctx.platformRole&&<p>Platform role: {ctx.platformRole}</p>}
    <p>Environment: {isDemoWriteEnabled?'business changes enabled':'business changes disabled'}</p>
    <a href="/account">My account</a>{hasOrganizationAdminAuthority(ctx)&&<a href="/users">Users</a>}{isPlatformOwner(ctx)&&<a href="/platform">Platform administration</a>}
    <form action={logoutAction}><button type="submit">Sign out</button></form>
  </div></details>
  </div>;
}
