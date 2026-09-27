import { AccessError, type WorkspaceAccess } from './core.ts';

export const DEMO_TOKEN_PREFIX = 'demo:';
export const DEMO_SESSION_SECONDS = 2 * 60 * 60;
export interface DemoEntry {
 workspaceId: string; organizationId: string; memberId: string; userId: string;
 authUserId: string; email: string; displayName: string;
 platformRole: null; role: 'ORG_OWNER'; isProductLead: boolean;
}
/** Treat even server RPC data as untrusted until its scope/authority is complete. */
export function demoEntryContext(value: unknown): { entry: DemoEntry; context: WorkspaceAccess } {
 const x = value as Partial<DemoEntry> | null;
 const ids = [x?.workspaceId,x?.organizationId,x?.memberId,x?.userId,x?.authUserId];
 if (!x || ids.some(id => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))
  || x.platformRole !== null || x.role !== 'ORG_OWNER'
  || typeof x.email !== 'string' || !x.email.includes('@') || typeof x.displayName !== 'string' || !x.displayName.trim()
  || typeof x.isProductLead !== 'boolean') throw new AccessError('ACCESS_DENIED','Demo access is unavailable.');
 const entry = x as DemoEntry;
 return {entry,context:{workspaceId:entry.workspaceId,organizationId:entry.organizationId,memberId:entry.memberId,
  actor:{id:entry.userId,label:entry.displayName},platformRole:null,role:'ORG_OWNER',isProductLead:entry.isProductLead}};
}
export function verifyDemoProvider(entry: DemoEntry, provider: {
 id: string; email?: string; is_anonymous?: boolean; banned_until?: string; deleted_at?: string;
} | null, now = Date.now()) {
 if (!provider || provider.id !== entry.authUserId || provider.email?.trim().toLowerCase() !== entry.email.trim().toLowerCase()
  || provider.is_anonymous !== false || provider.deleted_at
  || (provider.banned_until && Date.parse(provider.banned_until) > now))
  throw new AccessError('ACCESS_DENIED','Demo access is unavailable.');
}
