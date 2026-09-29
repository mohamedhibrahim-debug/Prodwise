"use server";
import { safeMessage } from '@/lib/errors/safe-message';
import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/data";
import { assertFormWorkspace } from "@/lib/auth/scope";
import { freshContextForRequest } from "@/lib/auth/service";
import { figmaOutline, jiraProjects, refreshSource, searchConnector } from "@/lib/connectors/service";
import { ConnectorError, connectorFromSlug, connectorMessage } from "@/lib/connectors/types";
import type { ImportRow } from "@/lib/connectors/import-view";

const refresh = (slug: string) => { for (const p of [`/initiatives/${slug}/sources`, `/initiatives/${slug}/knowledge/sources`, `/initiatives/${slug}/evidence`, `/initiatives/${slug}/history`, `/initiatives/${slug}`]) revalidatePath(p); };

/** Read-only: the result of one search in the person's own account. Nothing is saved. */
export interface SearchState { rows: ImportRow[]; omitted: number; more?: boolean; error: string | null; code: string | null; fileName?: string | null }
export interface SearchRequest { from: string; q?: string; project?: string; site?: string; type?: string; status?: string; link?: string }

export async function searchAction(input: SearchRequest): Promise<SearchState> {
  const connector = connectorFromSlug(String(input.from ?? ""));
  if (!connector) return { rows: [], omitted: 0, error: "Choose a supported source.", code: "INVALID_REQUEST" };
  try {
    if (connector === "FIGMA") {
      const outline = await figmaOutline(String(input.link ?? ""));
      const rows: ImportRow[] = outline.pages.flatMap(p => p.frames.map(f => ({ reference: `${outline.fileKey}#${f.id}`, name: f.name, kind: f.type, url: `https://www.figma.com/design/${outline.fileKey}/?node-id=${f.id.replace(":", "-")}`, detail: `${outline.name} · ${p.name}`, updatedAt: outline.lastModified, group: p.name })));
      if (outline.selectedNodeId && !rows.some(r => r.reference.endsWith(`#${outline.selectedNodeId}`))) rows.unshift({ reference: `${outline.fileKey}#${outline.selectedNodeId}`, name: "Frame from your link", kind: "FRAME", url: String(input.link), detail: outline.name, updatedAt: null, group: "From your link" });
      return { rows, omitted: 0, error: null, code: null, fileName: outline.name };
    }
    const r = await searchConnector(connector, { query: String(input.q ?? ""), project: input.project || null, site: input.site || null, type: input.type || null, status: input.status || null });
    return { rows: r.results, omitted: r.omitted, more: r.more, error: null, code: null };
  } catch (e) {
    if (e instanceof ConnectorError) return { rows: [], omitted: 0, error: connectorMessage(e.code, connector), code: e.code };
    return { rows: [], omitted: 0, error: safeMessage(e, "The search could not be completed. Nothing was saved."), code: null };
  }
}

/** Jira projects the person can see, for the Project filter. A failure only empties the list. */
export async function jiraProjectsAction(site: string | null): Promise<{ key: string; name: string }[]> {
  try { return await jiraProjects(site || null); } catch { return []; }
}

export interface RefreshState { error: string | null; message: string | null }
export async function refreshAction(_previous: RefreshState, form: FormData): Promise<RefreshState> {
  const slug = String(form.get("slug") ?? ""), itemId = String(form.get("itemId") ?? ""), connector = connectorFromSlug(String(form.get("connector") ?? ""));
  if (!connector) return { error: "Choose a supported source.", message: null };
  try {
    assertFormWorkspace(form, await freshContextForRequest());
    const i = await getRepository().getInitiativeBySlug(slug); if (!i) return { error: "This initiative is unavailable in your organization.", message: null };
    const r = await refreshSource(i.id, itemId); refresh(slug);
    if (r.code) return { error: connectorMessage(r.code as never, connector), message: null };
    return { error: null, message: r.changed ? "Changed since the last snapshot. A new snapshot was saved; review it for proposals. Nothing was confirmed." : "No change since the last snapshot. Checked just now." };
  } catch (e) {
    return { error: e instanceof ConnectorError ? connectorMessage(e.code, connector) : safeMessage(e, "The refresh failed. The last snapshot is kept."), message: null };
  }
}
