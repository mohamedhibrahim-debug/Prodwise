"use server";
import { safeMessage } from '@/lib/errors/safe-message';
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { listAuthorizedContexts, switchOrganization } from "@/lib/auth/service";
export async function listOrganizationContextsAction() { return listAuthorizedContexts(); }
export async function switchOrganizationAction(_previous:{error?:string},form:FormData):Promise<{error?:string}> {
  try {
    await switchOrganization(String(form.get("workspaceId")??""),String(form.get("scopeWorkspaceId")??""));
  } catch(error) {
    return {error:safeMessage(error, "The organization switch could not be completed.")};
  }
  revalidatePath("/","layout");
  redirect("/?organizationChanged=1");
}
