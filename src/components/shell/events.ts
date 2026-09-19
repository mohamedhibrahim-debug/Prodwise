export const OPEN_PALETTE_EVENT = "prodwise:open-palette";
export const OPEN_DEMO_EVENT = "prodwise:open-demo";

export function openPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT));
}

export function openDemo() {
  window.dispatchEvent(new CustomEvent(OPEN_DEMO_EVENT));
}
