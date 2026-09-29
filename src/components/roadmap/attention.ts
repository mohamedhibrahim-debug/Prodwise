import type { RoadmapAttentionKind } from "@/lib/workspace/roadmap-layout";

/**
 * Attention on the roadmap is always glyph + words; colour only reinforces.
 * Blockers use the BLOCKED family, everything else the AT_RISK amber — never
 * the brand orange.
 */
export const ATTENTION_MARK: Record<RoadmapAttentionKind, { glyph: string; short: string; tone: "blocked" | "risk" }> = {
  DECISION: { glyph: "?", short: "Decision needed", tone: "risk" },
  BLOCKER: { glyph: "■", short: "Blocker", tone: "blocked" },
  PAST_TARGET: { glyph: "▲", short: "Past target", tone: "risk" },
  PAST_MILESTONE: { glyph: "▲", short: "Past milestone", tone: "risk" },
  DEPENDENCY: { glyph: "⇢", short: "Dependency late", tone: "risk" },
  SUPPORT_CHANGED: { glyph: "↻", short: "Support changed", tone: "risk" },
};

/** "15 Oct" — compact labels on the timeline; full dates live in the popover. */
export function shortDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
