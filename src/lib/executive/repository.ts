import 'server-only';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireWorkspaceAccess, requireBusinessWriteAccess } from '@/lib/auth/access';
import { adminClient, isLocalAuth } from '@/lib/auth/service';
import type { WorkspaceAccess } from '@/lib/auth/core';
import { emptyExecutiveState, type ExecutiveState } from './types';

function pathFor(ctx: WorkspaceAccess) {
  if (!/^[a-zA-Z0-9-]+$/.test(ctx.workspaceId)) throw Error('Invalid workspace.');
  if (process.env.VERCEL) throw Error('Hosted reporting requires database storage.');
  return join(process.cwd(), '.data', `executive-${ctx.workspaceId}.json`);
}
async function readFor(ctx: WorkspaceAccess): Promise<{ state: ExecutiveState; available: boolean }> {
  if (isLocalAuth()) {
    try { return { state: JSON.parse(await readFile(pathFor(ctx), 'utf8')) as ExecutiveState, available: true }; }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { state: emptyExecutiveState(), available: true }; throw e; }
  }
  const { data, error } = await adminClient().from('executive_workspaces').select('data').eq('workspace_id', ctx.workspaceId).eq('organization_id', ctx.organizationId).maybeSingle();
  if (error?.code === 'PGRST205' || error?.code === '42P01') return { state: emptyExecutiveState(), available: false };
  if (error) throw Error('Business reporting is unavailable. Please retry.');
  return { state: data?.data as ExecutiveState ?? emptyExecutiveState(), available: true };
}
export async function readExecutive() { const ctx = await requireWorkspaceAccess(); return { ctx, ...await readFor(ctx) }; }
export async function mutateExecutive(workspaceId: string, change: (state: ExecutiveState, ctx: WorkspaceAccess) => ExecutiveState): Promise<ExecutiveState> {
  const ctx = await requireBusinessWriteAccess();
  if (ctx.workspaceId !== workspaceId) throw Error('Your workspace changed. Reload before saving.');
  if (isLocalAuth()) {
    const file = pathFor(ctx); await mkdir(join(process.cwd(), '.data'), { recursive: true });
    const lockFile = file + '.lock';
    let lock;
    try { lock = await open(lockFile, 'wx'); } catch { throw Error('Another reporting change is saving. Try again.'); }
    const temp = file + '.' + randomUUID() + '.tmp';
    try {
      const { state } = await readFor(ctx);
      const next = { ...change(state, ctx), revision: state.revision + 1 };
      const fresh = await requireBusinessWriteAccess();
      if (fresh.workspaceId !== ctx.workspaceId || fresh.organizationId !== ctx.organizationId) throw Error('Your workspace changed. Reload before saving.');
      const output = await open(temp, 'wx');
      try { await output.writeFile(JSON.stringify(next), 'utf8'); await output.sync(); } finally { await output.close(); }
      await rename(temp, file); return next;
    } finally { await unlink(temp).catch(() => undefined); await lock.close(); await unlink(lockFile); }
  }
  const { state, available } = await readFor(ctx);
  if (!available) throw Error('The Business Analysis database update has not been installed.');
  const next = { ...change(state, ctx), revision: state.revision + 1 };
  const fresh = await requireBusinessWriteAccess();
  if (fresh.workspaceId !== ctx.workspaceId) throw Error('Your workspace changed. Reload before saving.');
  const { error } = await adminClient().rpc('commit_executive_workspace', { p_workspace_id: ctx.workspaceId, p_member_id: fresh.memberId ?? fresh.actor.id, p_expected_revision: state.revision, p_data: next });
  if (error) throw Error(error.message.includes('STALE') ? 'Reporting changed while saving. Review and retry; nothing was overwritten.' : 'The reporting change was refused. Check your access and database setup.');
  return next;
}
