import {notFound} from "next/navigation";
import {adminAccess} from "@/components/admin/access";
import {Restricted} from "@/components/admin/AdminUI";
import {PlatformConsole,OrganizationConsole} from "@/components/admin/ConsolePages";
export async function generateMetadata({params}:{params:Promise<{scope:string;path?:string[]}>}){const {scope,path=[]}=await params;const label=({organizations:"Organizations",users:"Users & Access",policies:"Access Policies",policy:"Access Policy",settings:"Organization settings"} as Record<string,string>)[path[0]??""]??"Administration";return {title:(scope==="platform"?"Platform · ":"Organization · ")+label};}
export const dynamic="force-dynamic";
export default async function AdminPage({params,searchParams}:{params:Promise<{scope:string;path?:string[]}>;searchParams:Promise<Record<string,string|undefined>>}){const {scope,path=[]}=await params;if(scope!=="platform"&&scope!=="organization")notFound();const access=await adminAccess(scope);if(!access.allowed)return <Restricted guest={access.guest}/>;return scope==="platform"?<PlatformConsole access={access} path={path} query={await searchParams}/>:<OrganizationConsole access={access} path={path} query={await searchParams}/>;}
