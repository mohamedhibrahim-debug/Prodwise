import { capText, clip, type ProviderCall } from "./http.ts";
import { ConnectorError, type ProviderSnapshot } from "./types.ts";

/**
 * Figma as design evidence / product definition. Prodwise reads a file's pages
 * and frames and the text on them, plus open comments pinned inside a selected
 * frame. A changed frame is a change signal only: design approval is never
 * inferred, and nothing becomes Knowledge until a person confirms it.
 */
const API = "https://api.figma.com/v1";
export const FILE_KEY = /^[A-Za-z0-9]{10,64}$/;
export const NODE_ID = /^[0-9]+:[0-9]+$/;

/** figma.com/{file|design|proto|board}/KEY/Name?node-id=1-2 → key + node. */
export function parseFigmaLink(raw: string): { fileKey: string; nodeId: string | null } {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new ConnectorError("INVALID_REQUEST"); }
  if (url.protocol !== "https:" || !/(^|\.)figma\.com$/.test(url.hostname)) throw new ConnectorError("INVALID_REQUEST");
  const m = /^\/(file|design|proto|board)\/([A-Za-z0-9]+)/.exec(url.pathname);
  if (!m || !FILE_KEY.test(m[2]!)) throw new ConnectorError("INVALID_REQUEST");
  const node = url.searchParams.get("node-id")?.replace("-", ":") ?? null;
  return { fileKey: m[2]!, nodeId: node && NODE_ID.test(node) ? node : null };
}
export const frameLink = (fileKey: string, nodeId: string) => `https://www.figma.com/design/${fileKey}/?node-id=${nodeId.replace(":", "-")}`;

interface FigmaNode { id?: string; name?: string; type?: string; characters?: string; children?: FigmaNode[] }
interface FigmaFile { name?: string; lastModified?: string; version?: string; editorType?: string; document?: FigmaNode }

export interface FigmaOutline { fileKey: string; name: string; lastModified: string | null; version: string | null; pages: { id: string; name: string; frames: { id: string; name: string; type: string }[] }[] }
const CONTAINER_TYPES = new Set(["FRAME", "SECTION", "COMPONENT", "COMPONENT_SET"]);

export async function fileOutline(call: ProviderCall, fileKey: string): Promise<FigmaOutline> {
  if (!FILE_KEY.test(fileKey)) throw new ConnectorError("INVALID_REQUEST");
  const f = await call(`${API}/files/${fileKey}?depth=2`) as FigmaFile;
  return { fileKey, name: clip(f.name ?? "Untitled Figma file", 200), lastModified: f.lastModified ?? null, version: f.version ?? null,
    pages: (f.document?.children ?? []).filter(p => p.type === "CANVAS" && p.id).map(p => ({ id: p.id!, name: clip(p.name ?? "Page", 120),
      frames: (p.children ?? []).filter(n => n.id && CONTAINER_TYPES.has(n.type ?? "")).slice(0, 100).map(n => ({ id: n.id!, name: clip(n.name ?? "Frame", 120), type: n.type! })) })) };
}

/** Visible text in reading order, one line per text layer. */
export function textLayers(node: FigmaNode | undefined, out: string[] = [], limit = 400): string[] {
  if (!node || out.length >= limit) return out;
  if (node.type === "TEXT" && node.characters?.trim()) out.push(`- ${node.name && node.name !== node.characters ? `${clip(node.name, 60)}: ` : ""}${node.characters.replace(/\s+/g, " ").trim()}`);
  for (const c of node.children ?? []) textLayers(c, out, limit);
  return out;
}
function ids(node: FigmaNode | undefined, set = new Set<string>()): Set<string> { if (node?.id) set.add(node.id); for (const c of node?.children ?? []) ids(c, set); return set; }

interface FigmaComment { id?: string; message?: string; resolved_at?: string | null; created_at?: string; user?: { handle?: string }; client_meta?: { node_id?: string } | null; parent_id?: string }

export async function frameSnapshot(call: ProviderCall, fileKey: string, nodeId: string, includeComments: boolean): Promise<ProviderSnapshot> {
  if (!FILE_KEY.test(fileKey) || !NODE_ID.test(nodeId)) throw new ConnectorError("INVALID_REQUEST");
  const [meta, nodes] = await Promise.all([
    call(`${API}/files/${fileKey}?depth=1`) as Promise<FigmaFile>,
    call(`${API}/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`) as Promise<{ nodes?: Record<string, { document?: FigmaNode } | null> }>,
  ]);
  const frame = nodes.nodes?.[nodeId]?.document; if (!frame) throw new ConnectorError("NOT_FOUND");
  let comments: string[] = [];
  if (includeComments) {
    const inside = ids(frame);
    const body = await call(`${API}/files/${fileKey}/comments`) as { comments?: FigmaComment[] };
    const all = body.comments ?? [];
    const roots = all.filter(c => !c.parent_id && !c.resolved_at && c.client_meta?.node_id && inside.has(c.client_meta.node_id));
    comments = roots.slice(0, 30).map(c => [`- ${c.created_at?.slice(0, 10) ?? "?"} ${c.user?.handle ?? "Someone"}: ${clip(c.message ?? "", 500)}`, ...all.filter(r => r.parent_id === c.id).slice(0, 5).map(r => `  ↳ ${r.user?.handle ?? "Someone"}: ${clip(r.message ?? "", 300)}`)].join("\n"));
  }
  const fileName = meta.name ?? "Untitled Figma file", frameName = frame.name ?? "Frame";
  const text = [`Figma ${(frame.type ?? "frame").toLowerCase()} "${frameName}" in file "${fileName}" (snapshot of Figma at import).`,
    "A design change is a change signal only; it is not a design approval and does not change product decisions.",
    // The file's own modified time is kept as metadata, not in the text: an edit elsewhere in the file must not mark this frame changed.
    `Text on this ${(frame.type ?? "frame").toLowerCase()}:\n${textLayers(frame).join("\n") || "No text layers."}`,
    includeComments ? `Open comments pinned in this frame:\n${comments.join("\n") || "None."}` : "Comments were not included."].join("\n\n");
  return { connector: "FIGMA", provider: "FIGMA", providerWorkspace: "figma", containerReference: fileKey, containerName: clip(fileName, 200),
    item: { reference: `${fileKey}#${nodeId}`, name: clip(`${fileName} · ${frameName}`, 200), kind: clip(frame.type ?? "FRAME", 50), url: frameLink(fileKey, nodeId) },
    title: clip(`Design · ${frameName}`, 200), text: capText(text), evidenceSourceType: "DESIGN", externalUpdatedAt: meta.lastModified ?? null, occurredAt: meta.lastModified ?? null };
}
