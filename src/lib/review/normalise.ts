/**
 * Conservative string normalisation for the review engine.
 *
 * Its only job is to stop *formatting* differences being read as disagreements.
 * It must never infer meaning: "Daily Repayment" and "Repayment Schedule" are
 * different subjects here and always will be. No stemming, no synonyms, no
 * similarity, no LLM.
 *
 * Every transformation below can only make two strings MORE likely to compare
 * equal, which makes the conflict rule strictly more conservative. That is the
 * safe direction of error: a missed conflict is a gap the PM already lives
 * with, a false conflict destroys trust in the engine.
 */
export function normalise(value: string): string {
  // Coerced rather than trusted. The local JSON store is hand-editable and its
  // contract is that a corrupt file must not take the application down — a
  // numeric `"value": 27` would otherwise throw here and 500 the Review page
  // and every resolve action with it.
  if (typeof value !== "string") return normalise(String(value ?? ""));

  return value
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase()
    .replace(/\.$/u, "")
    .trim();
}

/**
 * True when a field carries no content once normalised.
 *
 * The not-blank constraints live only in Postgres, while the hand-editable
 * local JSON store is the default demo path — so the engine cannot assume its
 * input is well formed. A blank value must never reach a finding, or the
 * explanation renders as "different values: and 30".
 */
export function isBlank(value: string | null | undefined): boolean {
  return normalise(value ?? "").length === 0;
}

/**
 * The context two claims must share to be comparable.
 *
 * Returns null when no phase is recorded. A phase that is present but blank
 * means the same thing as an absent one, so both collapse to null rather than
 * becoming a third, look-alike context.
 */
export function contextKey(phase: string | null): string | null {
  if (isBlank(phase)) return null;
  return normalise(phase ?? "");
}
