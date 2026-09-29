/**
 * Sidebar width preference: remembered per viewer in browser storage.
 *
 * Storage can be missing or throw (private windows, blocked site data), so
 * every access is guarded and the default (expanded) always renders.
 * The key is unchanged from the previous pin control, so an existing choice survives.
 */
export const RAIL_STORAGE_KEY = "prodwise.navigation.expanded";
export const RAIL_EXPANDED_W = 232;
export const RAIL_COLLAPSED_W = 56;
/** Below this the rail becomes a top bar with a drawer. */
export const RAIL_DRAWER_MAX = 780;
/** Up to this width the rail starts collapsed; expanding overlays content. */
export const RAIL_OVERLAY_MAX = 1023;

type Readable = { getItem(key: string): string | null };
type Writable = { setItem(key: string, value: string): void };

export function readRailExpanded(storage: Readable | null | undefined): boolean {
  try { return storage?.getItem(RAIL_STORAGE_KEY) !== "false"; } catch { return true; }
}

export function writeRailExpanded(storage: Writable | null | undefined, expanded: boolean): boolean {
  try { storage?.setItem(RAIL_STORAGE_KEY, String(expanded)); return true; } catch { return false; }
}

export type RailMode = "drawer" | "overlay" | "pinned";

/**
 * How the rail behaves at a viewport width.
 * - drawer: phone; the rail is replaced by a top bar and slide-over drawer.
 * - overlay: small laptop; collapsed by default, an expand floats over content.
 * - pinned: the remembered preference decides, and content reflows.
 */
export function railLayout(viewportWidth: number, expanded: boolean, overlayOpen = false): { mode: RailMode; contentOffset: number; showsLabels: boolean } {
  if (viewportWidth <= RAIL_DRAWER_MAX) return { mode: "drawer", contentOffset: 0, showsLabels: true };
  if (viewportWidth <= RAIL_OVERLAY_MAX) return { mode: "overlay", contentOffset: RAIL_COLLAPSED_W, showsLabels: overlayOpen };
  return { mode: "pinned", contentOffset: expanded ? RAIL_EXPANDED_W : RAIL_COLLAPSED_W, showsLabels: expanded };
}

/** Runs before first paint (inlined in the root layout) so a collapsed rail never flashes open. */
export const RAIL_BOOT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(RAIL_STORAGE_KEY)})==="false")document.documentElement.dataset.rail="collapsed"}catch(e){}`;
