import "server-only";
import {freshContextForRequest,isDemoGuestSession} from "@/lib/auth/service";
import {assertFormWorkspace} from "@/lib/auth/scope";
import {AccessError} from "@/lib/auth/core";
import {revalidatePath} from "next/cache";
import {adminReturnPath} from "./model";
export async function checkAdminScope(form:FormData){const ctx=await freshContextForRequest();assertFormWorkspace(form,ctx);if(await isDemoGuestSession())throw new AccessError("DEMO_MANAGEMENT_DISABLED","Organization administration is unavailable in an Explore Demo session.");return ctx;}
export function refreshAdministration(form:FormData){revalidatePath("/administration","layout");revalidatePath("/users");revalidatePath("/platform");const path=adminReturnPath(String(form.get("returnTo")??""));revalidatePath(path.split("?")[0]!);}
