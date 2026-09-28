import { capText, clip, type ProviderCall } from "./http.ts";
import { ConnectorError, type ProviderResult, type ProviderSnapshot } from "./types.ts";

/**
 * Google Drive / Docs, read-only (drive.readonly). Search, then explicit selection.
 * Google Docs, Sheets and Slides are exported as text; plain-text files are read
 * directly; any other file is recorded by link and metadata only, and says so.
 * File ids are global, so one Drive file is one source whoever imports it.
 */
const API = "https://www.googleapis.com/drive/v3";
export const FILE_ID = /^[A-Za-z0-9_-]{10,200}$/;
const FIELDS = "id,name,mimeType,modifiedTime,version,webViewLink,size,owners(displayName),lastModifyingUser(displayName)";
const EXPORT: Record<string, string> = { "application/vnd.google-apps.document": "text/plain", "application/vnd.google-apps.presentation": "text/plain", "application/vnd.google-apps.spreadsheet": "text/csv" };
const TEXT_TYPES = /^(text\/|application\/(json|xml|x-yaml)$)/;
export const KIND: Record<string, string> = { "application/vnd.google-apps.document": "Google Doc", "application/vnd.google-apps.spreadsheet": "Google Sheet", "application/vnd.google-apps.presentation": "Google Slides", "application/pdf": "PDF" };

interface DriveFile { id?: string; name?: string; mimeType?: string; modifiedTime?: string; version?: string; webViewLink?: string; size?: string; owners?: { displayName?: string }[]; lastModifyingUser?: { displayName?: string } }

export function driveQuery(query: string): string {
  const q = query.normalize("NFKC").trim();
  if (q.length < 2 || q.length > 120) throw new ConnectorError("INVALID_REQUEST");
  const esc = q.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `(name contains '${esc}' or fullText contains '${esc}') and trashed = false and mimeType != 'application/vnd.google-apps.folder'`;
}

export async function searchFiles(call: ProviderCall, query: string): Promise<ProviderResult[]> {
  const body = await call(`${API}/files?pageSize=20&orderBy=modifiedTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=${encodeURIComponent(`files(${FIELDS})`)}&q=${encodeURIComponent(driveQuery(query))}`) as { files?: DriveFile[] };
  return (body.files ?? []).flatMap(f => typeof f.id === "string" && FILE_ID.test(f.id) ? [{ reference: f.id, name: clip(f.name ?? "Untitled", 200), kind: clip(KIND[f.mimeType ?? ""] ?? f.mimeType ?? "File", 50), url: f.webViewLink ?? null, updatedAt: f.modifiedTime ?? null,
    detail: [readable(f.mimeType) ? null : "Link and details only", f.lastModifyingUser?.displayName ? `Last edited by ${f.lastModifyingUser.displayName}` : null, f.owners?.[0]?.displayName ? `Owner ${f.owners[0].displayName}` : null].filter(Boolean).join(" · ") }] : []);
}
export const readable = (mime?: string) => Boolean(mime && (EXPORT[mime] || TEXT_TYPES.test(mime)));

export async function fileSnapshot(call: ProviderCall, fileId: string): Promise<ProviderSnapshot> {
  if (!FILE_ID.test(fileId)) throw new ConnectorError("INVALID_REQUEST");
  const f = await call(`${API}/files/${fileId}?supportsAllDrives=true&fields=${encodeURIComponent(FIELDS)}`) as DriveFile;
  const mime = f.mimeType ?? "";
  let content: string;
  if (EXPORT[mime]) content = await call(`${API}/files/${fileId}/export?mimeType=${encodeURIComponent(EXPORT[mime])}`, { as: "text" }) as string;
  else if (TEXT_TYPES.test(mime) && Number(f.size ?? 0) <= 1_000_000) content = await call(`${API}/files/${fileId}?alt=media&supportsAllDrives=true`, { as: "text" }) as string;
  else content = `Content not read: Prodwise imports text from Google Docs, Sheets, Slides and plain-text files. This ${KIND[mime] ?? "file"} is recorded by link and details only; open the original to read it.`;
  const name = f.name ?? "Untitled";
  const header = [`Google Drive file "${name}" (${KIND[mime] ?? mime}; snapshot of Drive at import).`, `Last modified: ${f.modifiedTime ?? "?"}${f.lastModifyingUser?.displayName ? ` by ${f.lastModifyingUser.displayName}` : ""}${f.version ? ` · Drive version ${f.version}` : ""}`, f.owners?.length ? `Owner: ${f.owners.map(o => o.displayName).filter(Boolean).join(", ")}` : null].filter(Boolean).join("\n");
  return { connector: "GOOGLE_DRIVE", provider: "DOCUMENT", providerWorkspace: "drive.google.com", containerReference: "google-drive", containerName: "Google Drive",
    item: { reference: fileId, name: clip(name, 200), kind: clip(KIND[mime] ?? "File", 50), url: f.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view` },
    title: clip(name, 200), text: capText(`${header}\n\n${content.trim() || "The file is empty."}`), evidenceSourceType: "DOCUMENT", externalUpdatedAt: f.modifiedTime ?? null, occurredAt: f.modifiedTime ?? null };
}
