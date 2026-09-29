import {notFound,redirect} from "next/navigation";
import {adminAccess} from "@/components/admin/access";
import {Restricted} from "@/components/admin/AdminUI";
import {OperatorConsole,OrganizationConsole} from "@/components/admin/ConsolePages";
import {adminTitle,isAdminSection,isOperatorSection,legacyAdminPath,OPERATOR_HOME} from "@/components/admin/model";
import {workspacePresentation} from "@/lib/workspace/context";

type Params=Promise<{scope:string;path?:string[]}>;
export async function generateMetadata({params}:{params:Params}){const {scope,path=[]}=await params;return {title:adminTitle(["/administration",scope,...path].join("/"))};}
export const dynamic="force-dynamic";

/**
 * /administration/<section>[/record]. Everyday sections: organization · members ·
 * roles · integrations · preferences · security. The operator surface lives under
 * /administration/operator/<organizations|identities|policies>. Pre-restructure
 * addresses (organization/users…, platform/…) redirect to their new home.
 */
export default async function AdminPage({params,searchParams}:{params:Params;searchParams:Promise<Record<string,string|undefined>>}){
 const [{scope,path=[]},query]=await Promise.all([params,searchParams]);
 const legacy=legacyAdminPath(scope,path,query);if(legacy)redirect(legacy);
 if(scope==="operator"){
  if(!path.length)redirect(`${OPERATOR_HOME}/organizations`);
  const section=path[0]!;if(!isOperatorSection(section)||path.length>2)notFound();
  const access=await adminAccess("platform");if(!access.allowed)return <Restricted guest={access.guest} operator={!access.guest}/>;
  const presentation=await workspacePresentation(access.ctx);
  return <OperatorConsole access={access} section={section} path={path.slice(1)} query={query} organizationName={presentation.organizationName}/>;
 }
 if(!isAdminSection(scope))notFound();
 if(scope!=="members"&&path.length)notFound();
 if(path.length>1)notFound();
 const access=await adminAccess();if(!access.allowed)return <Restricted guest={access.guest}/>;
 return <OrganizationConsole access={access} section={scope} path={path} query={query}/>;
}
