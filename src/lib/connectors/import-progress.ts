/**
 * Multi-item import progress. Pure and browser-safe.
 *
 * Each selected item moves Queued → Importing → Saving snapshot → one end state
 * (Imported · Already imported · Failed · Cancelled). The steps are the ones the
 * server reports while it works; nothing is estimated and there are no percentages.
 * Every attempt carries a number, so a late answer from a cancelled or retried
 * attempt can never overwrite what the person now sees.
 */
export type ItemPhase = "QUEUED" | "IMPORTING" | "SAVING" | "IMPORTED" | "UNCHANGED" | "FAILED" | "CANCELLED";
export const PHASE_LABEL: Record<ItemPhase, string> = {
  QUEUED: "Queued", IMPORTING: "Importing", SAVING: "Saving snapshot", IMPORTED: "Imported",
  UNCHANGED: "Already imported", FAILED: "Failed", CANCELLED: "Cancelled",
};

export interface ItemProgress {
  reference: string;
  name: string;
  phase: ItemPhase;
  attempt: number;
  /** Past the "longer than expected" mark and waiting on the person's choice. */
  slow: boolean;
  message: string | null;
  /** A connector error code, e.g. NEEDS_RECONNECT, when the server returned one. */
  code: string | null;
  submissionId: string | null;
}
export interface ProgressState { items: ItemProgress[] }
export const EMPTY_PROGRESS: ProgressState = { items: [] };

export type ProgressEvent =
  | { type: "QUEUE"; items: { reference: string; name: string }[] }
  | { type: "STAGE"; reference: string; attempt: number; stage: "IMPORTING" | "SAVING" }
  | { type: "DONE"; reference: string; attempt: number; changed: boolean; submissionId: string | null; name?: string; message?: string | null }
  | { type: "FAIL"; reference: string; attempt: number; message: string; code?: string | null }
  | { type: "SLOW"; reference: string; attempt: number }
  | { type: "KEEP_WAITING"; reference: string }
  | { type: "CANCEL"; reference: string; message: string }
  | { type: "STOP_QUEUED"; message: string }
  | { type: "RETRY"; references: string[] };

export const isActive = (i: ItemProgress) => i.phase === "IMPORTING" || i.phase === "SAVING";
export const isFinal = (i: ItemProgress) => i.phase === "IMPORTED" || i.phase === "UNCHANGED" || i.phase === "FAILED" || i.phase === "CANCELLED";
export const canRetry = (i: ItemProgress) => i.phase === "FAILED" || i.phase === "CANCELLED";

function update(s: ProgressState, reference: string, fn: (i: ItemProgress) => ItemProgress): ProgressState {
  return { items: s.items.map(i => (i.reference === reference ? fn(i) : i)) };
}
/** Events from an attempt that is no longer current, or for an item already settled, are ignored. */
const current = (i: ItemProgress, attempt: number) => i.attempt === attempt && !isFinal(i);

export function progressReducer(s: ProgressState, e: ProgressEvent): ProgressState {
  switch (e.type) {
    case "QUEUE": {
      const seen = new Set<string>();
      return { items: e.items.filter(x => !seen.has(x.reference) && seen.add(x.reference)).map(x => ({ reference: x.reference, name: x.name, phase: "QUEUED", attempt: 1, slow: false, message: null, code: null, submissionId: null })) };
    }
    case "STAGE":
      return update(s, e.reference, i => (current(i, e.attempt) ? { ...i, phase: e.stage } : i));
    case "DONE":
      return update(s, e.reference, i => (current(i, e.attempt) ? { ...i, phase: e.changed ? "IMPORTED" : "UNCHANGED", slow: false, submissionId: e.submissionId, name: e.name ?? i.name, message: e.message ?? null, code: null } : i));
    case "FAIL":
      return update(s, e.reference, i => (current(i, e.attempt) ? { ...i, phase: "FAILED", slow: false, message: e.message, code: e.code ?? null } : i));
    case "SLOW":
      return update(s, e.reference, i => (current(i, e.attempt) && isActive(i) ? { ...i, slow: true } : i));
    case "KEEP_WAITING":
      return update(s, e.reference, i => ({ ...i, slow: false }));
    case "CANCEL":
      return update(s, e.reference, i => (isFinal(i) ? i : { ...i, phase: "CANCELLED", slow: false, message: e.message }));
    case "STOP_QUEUED":
      return { items: s.items.map(i => (i.phase === "QUEUED" ? { ...i, phase: "CANCELLED", message: e.message } : i)) };
    case "RETRY":
      return { items: s.items.map(i => (e.references.includes(i.reference) && canRetry(i) ? { ...i, phase: "QUEUED", attempt: i.attempt + 1, slow: false, message: null, code: null } : i)) };
  }
}

/** The next item to start, only when nothing is in flight: imports run one at a time. */
export function nextQueued(s: ProgressState): ItemProgress | null {
  if (s.items.some(isActive)) return null;
  return s.items.find(i => i.phase === "QUEUED") ?? null;
}

export interface ProgressSummary {
  total: number; finished: number; imported: number; unchanged: number; failed: number; cancelled: number;
  running: boolean; line: string;
}
/** "Importing 2 of 3" while running; "Imported 3 of 3" or "Imported 2 of 3 · 1 failed" at the end. */
export function summarize(s: ProgressState): ProgressSummary {
  const n = (p: ItemPhase) => s.items.filter(i => i.phase === p).length;
  const total = s.items.length, imported = n("IMPORTED"), unchanged = n("UNCHANGED"), failed = n("FAILED"), cancelled = n("CANCELLED");
  const finished = imported + unchanged + failed + cancelled, running = s.items.some(i => isActive(i) || i.phase === "QUEUED");
  const ok = imported + unchanged;
  const line = running
    ? `Importing ${Math.min(finished + 1, total)} of ${total}`
    : [`Imported ${ok} of ${total}`, failed ? `${failed} failed` : null, cancelled ? `${cancelled} cancelled` : null].filter(Boolean).join(" · ");
  return { total, finished, imported, unchanged, failed, cancelled, running, line };
}

// ── Bounded waiting ─────────────────────────────────────────────────────────
export interface Timers { setTimeout: (fn: () => void, ms: number) => unknown; clearTimeout: (id: unknown) => void }
export interface Watchdog { /** "Keep waiting": both deadlines start again from now. */ extend(): void; stop(): void }

/**
 * Nothing waits forever. After softMs the person is asked "Keep waiting or cancel?";
 * after hardMs without an answer the wait ends on its own with onTimeout.
 */
export function createWatchdog(opts: { softMs: number; hardMs: number; onSlow: () => void; onTimeout: () => void; timers?: Timers }): Watchdog {
  const t: Timers = opts.timers ?? { setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms), clearTimeout: id => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>) };
  let soft: unknown = null, hard: unknown = null, stopped = false;
  const clear = () => { if (soft !== null) t.clearTimeout(soft); if (hard !== null) t.clearTimeout(hard); soft = hard = null; };
  const arm = () => {
    clear(); if (stopped) return;
    soft = t.setTimeout(() => { soft = null; if (!stopped) opts.onSlow(); }, opts.softMs);
    hard = t.setTimeout(() => { hard = null; if (!stopped) { stopped = true; clear(); opts.onTimeout(); } }, opts.hardMs);
  };
  arm();
  return { extend: arm, stop: () => { stopped = true; clear(); } };
}

/** Client deadlines. Server calls are bounded too (20 s per provider request, 30 s per save). */
export const DEADLINES = {
  search: { softMs: 12_000, hardMs: 60_000 },
  item: { softMs: 20_000, hardMs: 90_000 },
} as const;
