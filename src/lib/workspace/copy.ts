/** Display language for historical activity summaries; stored audit text stays intact. */
export function activitySummary(summary: string): string {
  return summary
    .replace(/\bconflict detected\b/gi, "mismatch raised")
    .replace(/\bclaims\b/gi, "Knowledge entries")
    .replace(/\bclaim\b/gi, "Knowledge entry")
    .replace(/\bevidence\b/gi, "Source")
    .replace(/\bsuperseded\b/gi, "replaced")
    .replace(/\bactive\b/gi, "Confirmed");
}
