import {adminAccess} from "@/components/admin/access";
import {Restricted} from "@/components/admin/AdminUI";
import {OrganizationConsole} from "@/components/admin/ConsolePages";
export const metadata={title:"Administration"};
export const dynamic="force-dynamic";
/** Administration opens on the Organization section; the task list on the left carries the rest. */
export default async function Administration({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const [access,query]=await Promise.all([adminAccess(),searchParams]);
 if(!access.allowed)return <Restricted guest={access.guest}/>;
 return <OrganizationConsole access={access} section="organization" path={[]} query={query}/>;
}
