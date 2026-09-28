"use server";
import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/data";
import { importSelection, refreshSource, type ImportOutcome } from "@/lib/connectors/service";
import { ConnectorError, connectorFromSlug, connectorMessage } from "@/lib/connectors/types";
import { SOURCE_ROLES, type SourceRole } from "@/lib/workspace/source-mapping";

export interface ImportState { error: string | null; outcomes: ImportOutcome[] }
const refresh = (slug: string) => { for (const p of [`/initiatives/${slug}/sources`, `/initiatives/${slug}/evidence`, `/initiatives/${slug}/history`, `/initiatives/${slug}`]) revalidatePath(p); };

/** Imports the selected items as Source + Evidence snapshots. Nothing here confirms a fact. */
export async function importAction(_previous: ImportState, form: FormData): Promise<ImportState> {
  const slug = String(form.get("slug") ?? ""), connector = connectorFromSlug(String(form.get("connector") ?? ""));
  if (!connector) return { error: "Choose a supported source.", outcomes: [] };
  const references = form.getAll("ref").map(String).filter(Boolean), role = String(form.get("role") ?? "GENERAL") as SourceRole;
  if (!references.length) return { error: "Select at least one item to import.", outcomes: [] };
  if (references.length > 10) return { error: "Import up to 10 items at a time so each can be reviewed.", outcomes: [] };
  if (!SOURCE_ROLES.includes(role)) return { error: "Choose what this source is for.", outcomes: [] };
  try {
    const i = await getRepository().getInitiativeBySlug(slug); if (!i) return { error: "This initiative is unavailable in your organization.", outcomes: [] };
    const outcomes = await importSelection({ initiativeId: i.id, connector, references, role, site: String(form.get("site") ?? "") || null, includeComments: form.get("includeComments") === "on" });
    refresh(slug);
    return { error: null, outcomes: outcomes.map(o => ({ ...o, message: o.ok ? o.message : /^[A-Z_]+$/.test(o.message ?? "") ? connectorMessage(o.message as never, connector) : o.message })) };
  } catch (e) {
    return { error: e instanceof ConnectorError ? connectorMessage(e.code, connector) : e instanceof Error ? e.message : "The import failed. Nothing was saved.", outcomes: [] };
  }
}

export interface RefreshState { error: string | null; message: string | null }
export async function refreshAction(_previous: RefreshState, form: FormData): Promise<RefreshState> {
  const slug = String(form.get("slug") ?? ""), itemId = String(form.get("itemId") ?? ""), connector = connectorFromSlug(String(form.get("connector") ?? ""));
  if (!connector) return { error: "Choose a supported source.", message: null };
  try {
    const i = await getRepository().getInitiativeBySlug(slug); if (!i) return { error: "This initiative is unavailable in your organization.", message: null };
    const r = await refreshSource(i.id, itemId); refresh(slug);
    if (r.code) return { error: connectorMessage(r.code as never, connector), message: null };
    return { error: null, message: r.changed ? "Changed since the last snapshot. A new snapshot was saved; review it for proposals. Nothing was confirmed." : "No change since the last snapshot. Checked just now." };
  } catch (e) {
    return { error: e instanceof ConnectorError ? connectorMessage(e.code, connector) : e instanceof Error ? e.message : "The refresh failed. The last snapshot is kept.", message: null };
  }
}
