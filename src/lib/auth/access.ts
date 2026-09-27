import 'server-only';
import { redirect } from 'next/navigation';
import { contextForRequest, freshContextForRequest } from './service';
import { AccessError, authorizeBusiness, authorizeFinalize } from './core';
import { isDemoWriteEnabled } from '@/lib/env';
export type { WorkspaceAccess } from './core';
export async function requireWorkspaceAccess() {
  try { return await contextForRequest(); }
  catch (error) { if (error instanceof AccessError && error.code === 'UNAUTHENTICATED') redirect('/login'); throw error; }
}
export async function requireFreshWorkspaceAccess() {
  try { return await freshContextForRequest(); }
  catch (error) { if (error instanceof AccessError && error.code === 'UNAUTHENTICATED') redirect('/login'); throw error; }
}
export async function requireBusinessWriteAccess() { return authorizeBusiness(await requireFreshWorkspaceAccess(), isDemoWriteEnabled); }
export async function requireReviewFinalizeAccess() { return authorizeFinalize(await requireFreshWorkspaceAccess(), isDemoWriteEnabled); }
