/**
 * Global keyboard shortcuts: pure matching, no DOM listeners.
 *
 * Single keys (`[`, `?`) act immediately. `g` starts a two-key sequence
 * (`g` then `h`) that must complete within `SEQUENCE_MS`. Nothing fires while
 * a modifier other than Shift is held, or while the person is typing.
 */
export const SEQUENCE_MS = 1200;

export type ShortcutAction =
  | { kind: "toggle-sidebar" }
  | { kind: "show-shortcuts" }
  | { kind: "navigate"; href: string };

export const GO_TO: Record<string, { href: string; label: string }> = {
  h: { href: "/", label: "Home" },
  i: { href: "/initiatives", label: "Initiatives" },
  r: { href: "/roadmap", label: "Roadmap" },
  w: { href: "/weekly-review", label: "Weekly Review" },
  a: { href: "/analysis/portfolio", label: "Analysis" },
  n: { href: "/notifications", label: "Notifications" },
};

/** What Help lists. Kept beside the matcher so the two cannot drift. */
export const SHORTCUT_GROUPS: { title: string; items: { keys: string[]; label: string }[] }[] = [
  {
    title: "Global",
    items: [
      { keys: ["⌘", "K"], label: "Search (Ctrl K on Windows)" },
      { keys: ["["], label: "Collapse or expand the sidebar" },
      { keys: ["?"], label: "Show keyboard shortcuts" },
      { keys: ["Esc"], label: "Close a menu, panel or dialog" },
    ],
  },
  {
    title: "Go to",
    items: Object.entries(GO_TO).map(([key, { label }]) => ({ keys: ["G", key.toUpperCase()], label })),
  },
  {
    title: "Inside an initiative",
    items: [{ keys: ["Alt", "1–4"], label: "Brief, Decisions, Knowledge, Sources" }],
  },
];

export interface KeyInput {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  /** Milliseconds; any monotonic clock. */
  time: number;
}

/** Minimal element shape, so the check is testable without a DOM. */
export interface TargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  type?: string;
}

const TEXT_INPUT_TYPES = new Set(["", "text", "search", "email", "password", "url", "tel", "number", "date", "datetime-local", "month", "week", "time"]);

export function isTypingTarget(target: TargetLike | null | undefined): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName ?? "").toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") return TEXT_INPUT_TYPES.has((target.type ?? "").toLowerCase());
  return false;
}

/** Stateful only in the pending `g`; create one per listener. */
export function createShortcutMatcher(sequenceMs = SEQUENCE_MS) {
  let pendingSince: number | null = null;
  return function match(input: KeyInput): ShortcutAction | null {
    if (input.metaKey || input.ctrlKey || input.altKey) { pendingSince = null; return null; }
    const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;
    if (pendingSince !== null) {
      const fresh = input.time - pendingSince <= sequenceMs;
      pendingSince = null;
      if (fresh && GO_TO[key]) return { kind: "navigate", href: GO_TO[key].href };
      if (fresh) return null;
    }
    if (key === "g") { pendingSince = input.time; return null; }
    if (key === "[") return { kind: "toggle-sidebar" };
    if (input.key === "?") return { kind: "show-shortcuts" };
    return null;
  };
}
