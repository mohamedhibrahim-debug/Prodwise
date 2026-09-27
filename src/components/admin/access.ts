import "server-only";
import {contextForRequest,isDemoGuestSession,platformSnapshot,userManagementSnapshot} from "@/lib/auth/service";
import {hasOrganizationAdminAuthority,isPlatformOwner} from "@/lib/auth/roles";
export async function adminAccess(scope?:"platform"|"organization"){const [ctx,guest]=await Promise.all([contextForRequest(),isDemoGuestSession()]);return {ctx,guest,allowed:!guest&&hasOrganizationAdminAuthority(ctx)&&(scope!=="platform"||isPlatformOwner(ctx)),writable:process.env.MANAGEMENT_WRITE_ENABLED==="true"&&process.env.VERCEL_ENV!=="preview"};}
export type PlatformState=Awaited<ReturnType<typeof platformSnapshot>>;
export type OrganizationState=Awaited<ReturnType<typeof userManagementSnapshot>>;
