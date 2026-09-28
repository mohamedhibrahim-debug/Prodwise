import 'server-only';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { contextForRequest, freshContextForRequest } from './service';
import { AccessError, authorizeBusiness, authorizeFinalize } from './core';
import { isDemoWriteEnabled } from '@/lib/env';
export type { WorkspaceAccess } from './core';
/** Shown when a save arrives after the session ended. Redirecting would discard what the person typed. */
import { SESSION_ENDED } from '@/lib/errors/messages';
export { SESSION_ENDED };
async function unauthenticated(): Promise<never> {
  // Server actions answer with a refusal the form can show; pages go to sign-in.
  if ((await headers()).get('next-action')) throw new AccessError('UNAUTHENTICATED', SESSION_ENDED);
  redirect('/login');
}
export async function requireWorkspaceAccess() {
  try { return await contextForRequest(); }
  catch (error) { if (error instanceof AccessError && error.code === 'UNAUTHENTICATED') return unauthenticated(); throw error; }
}
export async function requireFreshWorkspaceAccess() {
  try { return await freshContextForRequest(); }
  catch (error) { if (error instanceof AccessError && error.code === 'UNAUTHENTICATED') return unauthenticated(); throw error; }
}
export async function requireBusinessWriteAccess() { return authorizeBusiness(await requireFreshWorkspaceAccess(), isDemoWriteEnabled); }
export async function requireReviewFinalizeAccess() { return authorizeFinalize(await requireFreshWorkspaceAccess(), isDemoWriteEnabled); }
