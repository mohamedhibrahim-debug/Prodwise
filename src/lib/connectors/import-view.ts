import type { JiraStatusCategory, ProviderResult } from "./types.ts";

/**
 * Presentation logic for the import picker. Pure, browser-safe, and tested.
 * Nothing here infers anything: a type badge is the issue type Jira returned,
 * and a filter only narrows rows that were already loaded.
 */

export interface ImportRow extends ProviderResult {
  /** Figma: the page a frame sits on. */
  group?: string | null;
}

// ── Jira issue type badges ──────────────────────────────────────────────────
export type TypeTone = "epic" | "story" | "task" | "bug" | "subtask" | "initiative" | "other";
/** Only Jira's standard type names get a dedicated badge; every other type keeps its own name on a neutral badge. */
const STANDARD_TYPES: Record<string, TypeTone> = { epic: "epic", story: "story", task: "task", bug: "bug", "sub-task": "subtask", subtask: "subtask", initiative: "initiative" };

export function jiraTypeBadge(type: string | null, subtask = false): { tone: TypeTone; label: string } {
  const name = type?.trim() || null;
  if (!name) return { tone: "other", label: "Type not returned" };
  const tone = STANDARD_TYPES[name.toLowerCase()];
  // Jira's own sub-task flag (from the API) marks a renamed sub-task type; the name shown is still Jira's.
  return { tone: tone ?? (subtask ? "subtask" : "other"), label: name };
}

// ── Jira status categories ──────────────────────────────────────────────────
/** Jira status is delivery evidence, not a Prodwise state: "Done" is never "Ready" (Rule 1). */
export const STATUS_CATEGORY_LABEL: Record<JiraStatusCategory, string> = { new: "To do", indeterminate: "In progress", done: "Done" };
export function statusTone(category: JiraStatusCategory | null): "todo" | "progress" | "done" | "unknown" {
  return category === "new" ? "todo" : category === "indeterminate" ? "progress" : category === "done" ? "done" : "unknown";
}

// ── Search refinements offered before a search ──────────────────────────────
/** Values are what searchJql accepts; "subtask" means every sub-task type on the site. */
export const JIRA_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "Epic", label: "Epic" }, { value: "Story", label: "Story" }, { value: "Task", label: "Task" },
  { value: "Bug", label: "Bug" }, { value: "subtask", label: "Sub-task" }, { value: "Initiative", label: "Initiative" },
];
/** The standard options plus any other type names seen in loaded results. */
export function typeOptions(rows: readonly ImportRow[], selected: string | null): { value: string; label: string }[] {
  const known = new Set(JIRA_TYPE_OPTIONS.map(o => o.value.toLowerCase()).concat(["sub-task"]));
  const extra = [...new Set([...rows.map(r => r.jira?.type).filter((t): t is string => Boolean(t)), ...(selected ? [selected] : [])])]
    .filter(t => !known.has(t.toLowerCase())).sort((a, b) => a.localeCompare(b));
  return [...JIRA_TYPE_OPTIONS, ...extra.map(t => ({ value: t, label: t }))];
}

// ── Narrowing loaded results ────────────────────────────────────────────────
export interface RowFilter { text?: string; type?: string | null; status?: JiraStatusCategory | "unknown" | null; project?: string | null }
const typeKey = (r: ImportRow) => (r.jira ? r.jira.type ?? "Type not returned" : r.kind);

export function filterRows(rows: readonly ImportRow[], f: RowFilter): ImportRow[] {
  const words = (f.text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter(r => {
    if (f.type && typeKey(r).toLowerCase() !== f.type.toLowerCase()) return false;
    if (f.status && (r.jira?.statusCategory ?? "unknown") !== f.status) return false;
    if (f.project && r.jira?.project?.key !== f.project) return false;
    if (!words.length) return true;
    const hay = [r.reference, r.name, r.detail, r.kind, r.jira?.assignee, r.jira?.status, r.jira?.parent?.key, r.jira?.parent?.summary, r.jira?.project?.name, r.group].filter(Boolean).join(" ").toLowerCase();
    return words.every(w => hay.includes(w));
  });
}

export interface Facet { value: string; label: string; count: number }
/** Counts per value in the loaded rows, most common first; ties keep a stable alphabetical order. */
export function facets(rows: readonly ImportRow[]): { types: Facet[]; statuses: Facet[]; projects: Facet[] } {
  const count = (values: (string | null)[], label: (v: string) => string) => {
    const m = new Map<string, number>(); for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m].map(([value, n]) => ({ value, label: label(value), count: n })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  };
  return {
    types: count(rows.map(typeKey), v => v),
    statuses: count(rows.map(r => (r.jira ? r.jira.statusCategory ?? "unknown" : null)), v => v === "unknown" ? "Status not returned" : STATUS_CATEGORY_LABEL[v as JiraStatusCategory]),
    projects: count(rows.map(r => r.jira?.project?.key ?? null), v => { const p = rows.find(r => r.jira?.project?.key === v)?.jira?.project; return p ? `${p.name} (${p.key})` : v; }),
  };
}

// ── Selection ───────────────────────────────────────────────────────────────
/** A batch is capped so each imported item can be reviewed. */
export const IMPORT_BATCH_LIMIT = 10;
export function toggleSelection(selected: readonly string[], reference: string, limit = IMPORT_BATCH_LIMIT): { selected: string[]; refused: boolean } {
  if (selected.includes(reference)) return { selected: selected.filter(r => r !== reference), refused: false };
  if (selected.length >= limit) return { selected: [...selected], refused: true };
  return { selected: [...selected, reference], refused: false };
}
/** Selects visible rows up to the limit, keeping what was already chosen. */
export function selectVisible(selected: readonly string[], visible: readonly string[], limit = IMPORT_BATCH_LIMIT): string[] {
  const out = [...selected];
  for (const r of visible) { if (out.length >= limit) break; if (!out.includes(r)) out.push(r); }
  return out;
}
