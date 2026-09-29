/** Password visibility glyph: open eye = "show", struck eye = "hide". The button carries the accessible name. */
export function EyeIcon({ open }: { open: boolean }) {
  const c = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z" {...c} />
    <circle cx="10" cy="10" r="2.5" {...c} />
    {!open && <path d="M3.5 3.5l13 13" {...c} />}
  </svg>;
}
