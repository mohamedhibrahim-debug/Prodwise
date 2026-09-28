import "server-only";
import { cache } from "react";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { adminClient, contextForRequest, isLocalAuth, localAuthStore } from "@/lib/auth/service";
import type { WorkspaceAccess } from "@/lib/auth/core";

export interface WorkspacePresentation { organizationName:string; workspaceName:string; isDemo:boolean; scenarioAt:string|null;
  /** When the shared Demo was last restored to its canonical records; null outside the Demo or when not recorded. */
  resetAt?:string|null; }
/** Presentation comes from the verified session, never a query parameter or
 * organization name. A registered synthetic scenario has a fixed review date. */
export async function workspacePresentation(access?:WorkspaceAccess):Promise<WorkspacePresentation> {
  const ctx=access??await contextForRequest();
  return readPresentation(ctx.workspaceId,ctx.organizationId);
}
const readPresentation=cache(async (workspaceId:string, organizationId:string):Promise<WorkspacePresentation> => {
  const ctx={workspaceId,organizationId};
  if (isLocalAuth()) {
    const state=localAuthStore(ctx.workspaceId).read(true);
    let scenarioAt:string|null=null;
    try {
      const registered=JSON.parse(await readFile(join(process.cwd(),".data","demo-access.json"),"utf8"));
      if(registered.workspaceId===ctx.workspaceId&&registered.organizationId===ctx.organizationId&&["prodwise-graduation-2026-09-v1","prodwise-graduation-2026-09-v2"].includes(registered.version)) scenarioAt=registered.scenarioAt??registered.asOf??"2026-09-26T10:00:00.000Z";
    } catch(error) { if((error as NodeJS.ErrnoException).code!=="ENOENT") throw new Error("Demo scenario registration is unavailable."); }
    let resetAt:string|null=null;
    if(scenarioAt){try{const audit=JSON.parse(await readFile(join(process.cwd(),".data","demo-reset-audit.json"),"utf8")) as {workspaceId?:string;at?:string}[];resetAt=audit.filter(a=>a.workspaceId===ctx.workspaceId&&a.at).map(a=>a.at!).sort().at(-1)??null;}catch{resetAt=null;}}
    return {organizationName:state.organization.name,workspaceName:state.workspace.name,isDemo:scenarioAt!==null,scenarioAt,resetAt};
  }
  const db=adminClient();
  const [org,workspace,scenario]=await Promise.all([
    db.from("organizations").select("name").eq("id",ctx.organizationId).single(),
    db.from("workspaces").select("name").eq("id",ctx.workspaceId).eq("organization_id",ctx.organizationId).single(),
    db.from("demo_scenarios").select("scenario_at,registered_at").eq("workspace_id",ctx.workspaceId).eq("organization_id",ctx.organizationId).maybeSingle(),
  ]);
  if(org.error||workspace.error||scenario.error) throw new Error("Workspace context is unavailable.");
  return {organizationName:org.data.name,workspaceName:workspace.data.name,isDemo:!!scenario.data,scenarioAt:scenario.data?.scenario_at??null,resetAt:scenario.data?.registered_at??null};
});
