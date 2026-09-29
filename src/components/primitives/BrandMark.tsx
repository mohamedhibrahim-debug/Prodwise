/**
 * The Prodwise mark: the Initiative Arc as an identity.
 *
 * A dial of eight equal ring segments — one per lifecycle stage — with a
 * single segment lit in cyan: "where this initiative is now". The segments are
 * equal in weight on purpose; a ring that brightens progressively reads as a
 * loading spinner, a dial with one position marked reads as a state. It sits
 * on a small navy tile so it holds as an app mark from a 16px favicon to a
 * 48px sign-in mark. No letterform, no enclosing emblem, nothing that could be
 * read as the AMAN mark (CLAUDE.md §16).
 */
const SEGMENTS = 8;
const CURRENT = 1; // the 1–2 o'clock position: optically the most "active" spot on a dial

function geometry(size: number) {
  // Smaller renders need heavier strokes and wider gaps to stay legible.
  if (size <= 18) return { stroke: 3.6, gap: 16, radius: 8.6 };
  if (size <= 26) return { stroke: 3.1, gap: 13, radius: 8.8 };
  if (size <= 36) return { stroke: 2.8, gap: 11, radius: 9 };
  return { stroke: 2.4, gap: 10, radius: 9.2 };
}

export function arcSegments(size: number) {
  const { stroke, gap, radius } = geometry(size);
  const step = 360 / SEGMENTS;
  return {
    stroke,
    segments: Array.from({ length: SEGMENTS }, (_, i) => {
      const start = -90 + i * step + gap / 2;
      const end = start + step - gap;
      const pt = (deg: number) => [16 + radius * Math.cos((deg * Math.PI) / 180), 16 + radius * Math.sin((deg * Math.PI) / 180)].map(n => n.toFixed(2)).join(" ");
      return { d: `M ${pt(start)} A ${radius} ${radius} 0 0 1 ${pt(end)}`, current: i === CURRENT };
    }),
  };
}

export function BrandMark({ size = 24, tile = true, className }: { size?: number; tile?: boolean; className?: string }) {
  const { stroke, segments } = arcSegments(size);
  return <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden="true" focusable="false">
    {tile && <>
      <rect x="0" y="0" width="32" height="32" rx="8" fill="var(--chrome-800)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="rgb(255 255 255 / 10%)" />
    </>}
    {segments.map((s, i) => <path key={i} d={s.d} fill="none" stroke={s.current ? "var(--accent-400)" : "var(--chrome-ink)"} strokeOpacity={s.current ? 1 : 0.62} strokeWidth={s.current ? stroke + 0.6 : stroke} strokeLinecap="butt" />)}
  </svg>;
}
