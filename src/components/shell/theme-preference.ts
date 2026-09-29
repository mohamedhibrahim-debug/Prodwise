/**
 * Appearance preference: Light (default) or Dark, remembered per viewer in
 * browser storage — the same pattern as the sidebar width. Storage can be
 * missing or throw, so every access is guarded and Light always renders.
 * The theme is applied as `data-theme` on <html>; tokens.css does the rest.
 */
export const THEME_STORAGE_KEY = "prodwise.appearance";
export type Theme = "light" | "dark";
export const THEMES: { value: Theme; label: string; description: string }[] = [
  { value: "light", label: "Light", description: "The default: light working surfaces." },
  { value: "dark", label: "Dark", description: "Dark surfaces for long sessions and low light." },
];

type Readable = { getItem(key: string): string | null };
type Writable = { setItem(key: string, value: string): void };

export function readTheme(storage: Readable | null | undefined): Theme {
  try { return storage?.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light"; } catch { return "light"; }
}

export function writeTheme(storage: Writable | null | undefined, theme: Theme): boolean {
  try { storage?.setItem(THEME_STORAGE_KEY, theme); return true; } catch { return false; }
}

/** Applies a theme to the document root; Light removes the attribute so the default tokens apply. */
export function applyTheme(root: { dataset: DOMStringMap }, theme: Theme): void {
  if (theme === "dark") root.dataset.theme = "dark"; else delete root.dataset.theme;
}

/** Runs before first paint (inlined in the root layout) so a dark choice never flashes light. */
export const THEME_BOOT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;
