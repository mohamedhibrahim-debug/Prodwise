export const OPEN_PALETTE_EVENT = "prodwise:open-palette";
export const OPEN_DEMO_EVENT = "prodwise:open-demo";
/** Help side panel; detail `{ section: "shortcuts" }` scrolls to the shortcut sheet. */
export const OPEN_HELP = "prodwise:help";
export const TOGGLE_SIDEBAR = "prodwise:toggle-sidebar";
export const OPEN_ORGANIZATION_SWITCHER = "prodwise:open-organization-switcher";

export function openPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT));
}

export function openDemo() {
  window.dispatchEvent(new CustomEvent(OPEN_DEMO_EVENT));
}

export function openHelp(section?: "shortcuts") {
  window.dispatchEvent(new CustomEvent(OPEN_HELP, { detail: { section } }));
}

export function toggleSidebar() {
  window.dispatchEvent(new CustomEvent(TOGGLE_SIDEBAR));
}

export function openOrganizationSwitcher() {
  window.dispatchEvent(new CustomEvent(OPEN_ORGANIZATION_SWITCHER));
}

/** Help panel open state, so its triggers can expose aria-expanded. */
const HELP_STATE = "prodwise:help-state";
let helpOpen = false;
export function setHelpOpen(open: boolean) { helpOpen = open; window.dispatchEvent(new Event(HELP_STATE)); }
export const isHelpOpen = () => helpOpen;
export function subscribeHelp(cb: () => void) { window.addEventListener(HELP_STATE, cb); return () => window.removeEventListener(HELP_STATE, cb); }
