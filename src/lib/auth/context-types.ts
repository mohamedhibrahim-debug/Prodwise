import type { PlatformRole, Role } from "./roles";
export interface AuthorizedContext {
  organizationId: string; workspaceId: string; organizationName: string; workspaceName: string;
  role: Role | null; platformRole: PlatformRole; current: boolean; isDemo: boolean;
}
export interface IdentityPresentation { id:string; email:string; displayName:string; active:boolean; platformRole:PlatformRole; }
