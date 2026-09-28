import 'server-only';
import type { WorkspaceAccess } from '@/lib/auth/core';
import { adminClient, isLocalAuth } from '@/lib/auth/service';
import { withRepositoryContext } from '@/lib/auth/repository-context';
import { readStore } from './store';
import { lookupFor } from './route-lookup';

/**
 * Runs in the proxy, before rendering starts, so a missing record gets a real
 * 404. Pages still call notFound() themselves; this only decides the status
 * code early, because once a loading boundary has streamed the status is 200.
 * Records in another organization are indistinguishable from missing ones.
 */
export type MissingKind = 'initiative' | 'record';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function missingRecord(ctx: WorkspaceAccess, pathname: string): Promise<MissingKind | null> {
  const want = lookupFor(pathname);
  if (!want) return null;
  if (want.malformed) return 'record';
  const w = ctx.workspaceId;
  if (isLocalAuth()) return withRepositoryContext(ctx, () => {
    const s = readStore();
    const initiative = want.initiative === undefined ? null : s.initiatives.find(i => i.slug === want.initiative && i.workspaceId === w);
    if (want.initiative !== undefined && !initiative) return 'initiative';
    if (want.source && !(s.sourceItems ?? []).some(x => x.id === want.source && x.workspaceId === w)) return 'record';
    if (want.submission && !(s.evidenceSubmissions ?? []).some(x => x.id === want.submission && x.initiativeId === initiative!.id)) return 'record';
    if (want.claim && !s.claims.some(x => x.id === want.claim && x.initiativeId === initiative!.id)) return 'record';
    if (want.evidence && !s.evidence.some(x => x.id === want.evidence && x.initiativeId === initiative!.id)) return 'record';
    return null;
  });
  // Hosted ids are uuid columns: anything else cannot exist, and must not reach a uuid cast.
  if ([want.source, want.submission, want.claim, want.evidence].some(id => id !== undefined && !UUID.test(id))) return 'record';
  const db = adminClient();
  let initiativeId: string | null = null;
  if (want.initiative !== undefined) {
    const { data, error } = await db.from('initiatives').select('id').eq('workspace_id', w).eq('slug', want.initiative).maybeSingle();
    if (error) return null; // Never turn a storage problem into a 404; the page reports it.
    if (!data) return 'initiative';
    initiativeId = data.id as string;
  }
  const exists = async (table: string, id: string, scope: Record<string, string>) => {
    let q = db.from(table).select('id').eq('id', id);
    for (const [k, v] of Object.entries(scope)) q = q.eq(k, v);
    const { data, error } = await q.maybeSingle();
    return error ? true : Boolean(data);
  };
  if (want.source && !(await exists('source_items', want.source, { workspace_id: w }))) return 'record';
  if (want.submission && !(await exists('evidence_submissions', want.submission, { workspace_id: w, initiative_id: initiativeId! }))) return 'record';
  if (want.claim && !(await exists('claims', want.claim, { workspace_id: w, initiative_id: initiativeId! }))) return 'record';
  if (want.evidence && !(await exists('evidence', want.evidence, { workspace_id: w, initiative_id: initiativeId! }))) return 'record';
  return null;
}
