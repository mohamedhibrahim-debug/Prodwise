import Link from "next/link";
import {redirect} from "next/navigation";
import {adminAccess} from "@/components/admin/access";
import {Restricted,styles} from "@/components/admin/AdminUI";
import {workspacePresentation} from "@/lib/workspace/context";
import {isPlatformOwner} from "@/lib/auth/roles";
export const metadata={title:"Administration"};
export default async function Administration(){const access=await adminAccess();if(!access.allowed)return <Restricted guest={access.guest}/>;if(!isPlatformOwner(access.ctx))redirect("/administration/organization/users");const workspace=await workspacePresentation(access.ctx);return <section className={styles.page}><p className={styles.eyebrow}>Administration</p><h1>Choose the scope you want to manage</h1><p className={styles.intro}>Platform authority and organization membership are separate.</p><div className={styles.choices}><Link className={styles.choice} href="/administration/platform/organizations"><div><h2>Platform</h2><p>Organizations, global identities and access policies.</p></div><span>All organizations →</span></Link><Link className={styles.choice} href="/administration/organization/users"><div><h2>{workspace.organizationName}</h2><p>Members, invitations and current workspace settings.</p></div><span>Current organization →</span></Link></div></section>;}
