/**
 * Collision-aware placement for floating layers (menus, popovers, tooltips).
 *
 * Pure geometry: no DOM, no clock. Given the anchor's viewport rectangle, the
 * floating element's measured size and the viewport, it returns where the
 * floating element goes. It prefers the requested side, flips to the opposite
 * side when the preferred one is too short and the opposite has more room,
 * shifts along the cross axis to stay `margin` inside the viewport, and caps
 * height so an oversized menu scrolls internally instead of being clipped.
 */
export type Side = "top" | "bottom" | "left" | "right";
export type Align = "start" | "center" | "end";
export type Placement = Side | `${Side}-${Align}`;

export interface Box { top: number; left: number; width: number; height: number; }
export interface Size { width: number; height: number; }

export interface PositionInput {
  anchor: Box;
  floating: Size;
  viewport: Size;
  placement?: Placement;
  /** Gap between anchor and floating element. */
  offset?: number;
  /** Minimum distance kept from every viewport edge. */
  margin?: number;
}

export interface PositionResult {
  top: number;
  left: number;
  side: Side;
  align: Align;
  /** Height available on the chosen side; apply as max-height. */
  maxHeight: number;
  /** Width available; apply as max-width. */
  maxWidth: number;
}

const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };

export function parsePlacement(placement: Placement): { side: Side; align: Align } {
  const [side, align] = placement.split("-") as [Side, Align | undefined];
  return { side, align: align ?? "center" };
}

function clamp(value: number, min: number, max: number) {
  return max < min ? min : Math.min(Math.max(value, min), max);
}

/** Room available beyond the anchor on each side, after offset and margin. */
function space(anchor: Box, viewport: Size, offset: number, margin: number): Record<Side, number> {
  return {
    top: anchor.top - offset - margin,
    bottom: viewport.height - (anchor.top + anchor.height) - offset - margin,
    left: anchor.left - offset - margin,
    right: viewport.width - (anchor.left + anchor.width) - offset - margin,
  };
}

function alignOn(start: number, length: number, size: number, align: Align) {
  if (align === "start") return start;
  if (align === "end") return start + length - size;
  return start + (length - size) / 2;
}

export function computePosition({
  anchor, floating, viewport, placement = "bottom-start", offset = 6, margin = 8,
}: PositionInput): PositionResult {
  const requested = parsePlacement(placement);
  const room = space(anchor, viewport, offset, margin);
  const vertical = requested.side === "top" || requested.side === "bottom";
  const need = vertical ? floating.height : floating.width;

  // Flip only when the preferred side cannot hold it and the other side has more room.
  let side = requested.side;
  if (room[side] < need && room[OPPOSITE[side]] > room[side]) side = OPPOSITE[side];

  const maxMain = Math.max(0, room[side]);
  const crossAvailable = Math.max(0, (vertical ? viewport.width : viewport.height) - margin * 2);

  if (vertical) {
    const height = Math.min(floating.height, maxMain);
    const width = Math.min(floating.width, crossAvailable);
    const top = side === "bottom" ? anchor.top + anchor.height + offset : anchor.top - offset - height;
    const left = clamp(alignOn(anchor.left, anchor.width, width, requested.align), margin, viewport.width - margin - width);
    return { top, left, side, align: requested.align, maxHeight: maxMain, maxWidth: crossAvailable };
  }

  const width = Math.min(floating.width, maxMain);
  const height = Math.min(floating.height, crossAvailable);
  const left = side === "right" ? anchor.left + anchor.width + offset : anchor.left - offset - width;
  const top = clamp(alignOn(anchor.top, anchor.height, height, requested.align), margin, viewport.height - margin - height);
  return { top, left, side, align: requested.align, maxHeight: crossAvailable, maxWidth: maxMain };
}
