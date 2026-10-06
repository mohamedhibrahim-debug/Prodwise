import 'server-only';
import { randomUUID } from 'node:crypto';
import { adminClient, isLocalAuth } from '@/lib/auth/service';
import type { WorkspaceAccess } from '@/lib/auth/core';
import { assertUploadOwner, boundedUploadBytes, uploadFiles, type UploadFile } from './upload-model';

const BUCKET = 'reporting-imports';
export async function prepareUploads(ctx: WorkspaceAccess, input: unknown) {
  if (isLocalAuth()) return { local: true };
  // Do not accept temporary private exports until scheduled cleanup is configured.
  if (process.env.REPORTING_UPLOADS_ENABLED !== 'true' || (process.env.CRON_SECRET?.length ?? 0) < 32)
    throw Error('Hosted file import is not enabled yet.');
  const db = adminClient(), id = randomUUID(), files = uploadFiles(input,ctx.workspaceId,id);
  const recent = await db.from('reporting_uploads').select('id',{count:'exact',head:true})
    .eq('user_id',ctx.actor.id).gt('created_at',new Date(Date.now()-2*60*60*1000).toISOString());
  if (recent.error) throw Error('Temporary upload storage is unavailable.');
  if ((recent.count ?? 0) >= 12) throw Error('Too many recent uploads. Retry later.');
  const saved = await db.from('reporting_uploads').insert({id,workspace_id:ctx.workspaceId,organization_id:ctx.organizationId,user_id:ctx.actor.id,files});
  if (saved.error) throw Error('Could not prepare the upload.');
  const urls: string[] = [];
  for (const file of files) {
    const {data,error} = await db.storage.from(BUCKET).createSignedUploadUrl(file.path,{upsert:false});
    if (error || !data) { await closeUpload(ctx,id); throw Error('Could not prepare the private upload.'); }
    urls.push(data.signedUrl);
  }
  return { id, urls };
}
async function ticketFor(ctx:WorkspaceAccess,id:string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw Error('Invalid upload.');
  const {data,error} = await adminClient().from('reporting_uploads').select('*').eq('id',id)
    .eq('workspace_id',ctx.workspaceId).eq('organization_id',ctx.organizationId).eq('user_id',ctx.actor.id).maybeSingle();
  if (error) throw Error('Temporary upload storage is unavailable.');
  assertUploadOwner(data,ctx);
  return data as {files:UploadFile[]};
}
export async function stagedFiles(ctx:WorkspaceAccess,id:string): Promise<File[]> {
  const ticket = await ticketFor(ctx,id), files:File[] = [];
  for (const file of ticket.files) {
    const {data,error} = await adminClient().storage.from(BUCKET).createSignedUrl(file.path,60);
    if (error || !data) throw Error('The source file is not uploaded yet.');
    const response = await fetch(data.signedUrl,{cache:'no-store',signal:AbortSignal.timeout(60_000)});
    const bytes = await boundedUploadBytes(response,file.size);
    files.push(new File([bytes as Uint8Array<ArrayBuffer>],file.name));
  }
  return files;
}
export async function closeUpload(ctx:WorkspaceAccess,id:string) {
  const ticket = await ticketFor(ctx,id);
  const db = adminClient();
  const {error} = await db.from('reporting_uploads').update({closed:true}).eq('id',id).eq('user_id',ctx.actor.id);
  if (error) throw Error('Could not close the temporary upload.');
  // Keep the ticket until signed upload URLs have expired: a late PUT must also be swept.
  await db.storage.from(BUCKET).remove(ticket.files.map(file=>file.path));
}
export async function cleanupUploads() {
  if (isLocalAuth()) return {removed:0};
  const db = adminClient();
  const {data,error} = await db.from('reporting_uploads').select('id,files').lt('expires_at',new Date().toISOString()).limit(100);
  if (error) throw Error('Upload cleanup unavailable.');
  let removed=0;
  for (const ticket of data ?? []) {
    const files = ticket.files as UploadFile[];
    const result = await db.storage.from(BUCKET).remove(files.map(file=>file.path));
    if (result.error) continue;
    const result2 = await db.from('reporting_uploads').delete().eq('id',ticket.id);
    if (!result2.error) removed++;
  }
  return {removed};
}
