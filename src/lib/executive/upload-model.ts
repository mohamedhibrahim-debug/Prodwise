export const UPLOAD_LIMIT = 25_000_000;
export interface UploadFile { name: string; size: number; path: string; }
export function uploadFiles(input: unknown, workspaceId: string, id: string): UploadFile[] {
  if (!Array.isArray(input) || !input.length || input.length > 12) throw Error('Select 1 to 12 source files.');
  let total = 0;
  return input.map((file, index) => {
    if (!file || typeof file.name !== 'string' || file.name.length > 200 || !/\.(csv|xlsx)$/i.test(file.name)
      || !Number.isSafeInteger(file.size) || file.size <= 0) throw Error('Select non-empty CSV or XLSX source files.');
    total += file.size;
    if (total > UPLOAD_LIMIT) throw Error('Selected files must total less than 25 MB.');
    return { name: file.name, size: file.size, path: `${workspaceId}/${id}/${index}` };
  });
}
export function assertUploadOwner(ticket: {workspace_id:string;organization_id:string;user_id:string;closed:boolean;expires_at:string} | null,
  scope: {workspaceId:string;organizationId:string;actor:{id:string}}, now = Date.now()) {
  if (!ticket || ticket.workspace_id !== scope.workspaceId || ticket.organization_id !== scope.organizationId
    || ticket.user_id !== scope.actor.id || ticket.closed || !(Date.parse(ticket.expires_at) > now))
    throw Error('This upload expired or belongs to another account or workspace. Select the files again.');
}
export async function boundedUploadBytes(response: Response, expected: number): Promise<Uint8Array> {
  if (!response.ok || !response.body) throw Error('The temporary file is unavailable. Upload it again.');
  if (!Number.isSafeInteger(expected) || expected <= 0 || expected > UPLOAD_LIMIT) throw Error('Invalid upload size.');
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const {value,done} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > expected) throw Error('The uploaded file size does not match the selected file.');
      chunks.push(value);
    }
    if (size !== expected) throw Error('The upload is incomplete. Select the file again.');
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
    return bytes;
  } finally { await reader.cancel().catch(()=>undefined); reader.releaseLock(); }
}
