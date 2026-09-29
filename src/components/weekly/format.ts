/** "26 Sept 2026, 17:00" in Cairo time — the one way a review cutoff is written. */
export const cairoStamp = (value: string) => new Date(value).toLocaleString('en-GB', { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' });

/** Review state of one section, for the navigator glyphs and the finalization checklist. */
export type SectionReviewState = 'done' | 'todo' | 'recheck' | 'final';
export const SECTION_STATE: Record<SectionReviewState, { glyph: string; label: string }> = {
  done: { glyph: '✓', label: 'Reviewed' },
  todo: { glyph: '○', label: 'Needs review' },
  recheck: { glyph: '▲', label: 'Needs re-check' },
  final: { glyph: '■', label: 'Final' },
};
export function sectionReviewState(section: { needsRecheck: boolean; editedByMemberId: string | null; editedByUserId?: string }, reviewStatus: 'DRAFT' | 'FINAL'): SectionReviewState {
  if (reviewStatus === 'FINAL') return 'final';
  if (section.needsRecheck) return 'recheck';
  return section.editedByMemberId || section.editedByUserId ? 'done' : 'todo';
}
