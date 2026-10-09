import 'server-only';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireWorkspaceAccess, requireBusinessWriteAccess } from '@/lib/auth/access';
import { adminClient, isLocalAuth } from '@/lib/auth/service';
import type { WorkspaceAccess } from '@/lib/auth/core';
import { emptyExecutiveState, type ExecutiveState } from './types';
import { reportingParts } from './save-parts';

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
  const db=adminClient(), batch=randomUUID(), member=fresh.memberId??fresh.actor.id;
  let count=0;
  try {
    for(const rows of reportingParts(next.rows)) {
      if(count>=512)throw Error('Reporting data exceeds the supported save size.');
      const {error}=await db.from('reporting_save_parts').insert({batch_id:batch,part:count,workspace_id:ctx.workspaceId,member_id:member,expected_revision:state.revision,rows});
      if(error)throw Error('Could not stage reporting data. Existing figures were not changed; retry shortly.');
      count++;
    }
    const finalAccess=await requireBusinessWriteAccess();
    if(finalAccess.workspaceId!==ctx.workspaceId||finalAccess.organizationId!==ctx.organizationId||(finalAccess.memberId??finalAccess.actor.id)!==member)
      throw Error('Your workspace changed. Reload before saving.');
    const {error}=await db.rpc('commit_executive_parts',{p_workspace_id:ctx.workspaceId,p_member_id:member,p_expected_revision:state.revision,p_batch_id:batch,p_part_count:count,p_data:{...next,rows:[]}});
    if(error)throw Error(error.message.includes('STALE')?'Reporting changed while saving. Review and retry; nothing was overwritten.':'Reporting publication could not be confirmed. Reload to check the figures before retrying.');
  } finally {
    // Expiry cleanup also handles interrupted requests and failed network cleanup.
    await db.from('reporting_save_parts').delete().eq('batch_id',batch).eq('workspace_id',ctx.workspaceId).eq('member_id',member).then(()=>undefined,()=>undefined);
  }
  return next;
}
