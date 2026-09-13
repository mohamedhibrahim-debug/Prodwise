import { createHash } from "node:crypto";

/**
 * Deterministic content identity for a derived finding.
 *
 * A finding is never stored, so its identity has to come from its content. That
 * identity is also the primary key of the human-state table, which makes
 * collisions a correctness bug rather than a curiosity: two different findings
 * sharing a fingerprint would share one person's resolution.
 *
 * Naive `parts.join("|")` is unsafe, because nothing stops a claim's subject or
 * value from containing the delimiter. Subject "Repayment|Divisor" with
 * attribute "Cap" would produce the same string as subject "Repayment" with
 * attribute "Divisor|Cap"; values {"27", "30|31"} would collide with
 * {"27", "30", "31"}, so splitting one claim into two would silently inherit
 * the older finding's resolution.
 *
 * Every component is therefore length-prefixed as `{length}:{value}` and
 * concatenated. The prefix makes the encoding uniquely parseable, so no content
 * can impersonate a boundary between components.
 */

/**
 * Absent is framed with a length no real string can produce, rather than with a
 * sentinel value.
 *
 * A sentinel lives in the same alphabet as the data, so it can be forged: the
 * raw, un-normalised slots — a supersession pointer, an id — could carry the
 * sentinel's own text and collide with a genuinely absent component. A negative
 * length cannot occur, so absence sits outside the alphabet entirely.
 */
export function frame(part: string | null): string {
  if (part === null) return "-1:";
  return `${part.length}:${part}`;
}

/**
 * Hashed as UTF-16, not UTF-8.
 *
 * UTF-8 encoding replaces every unpaired surrogate with the same U+FFFD, and
 * `Buffer.byteLength` agrees with it — so the length prefix and the payload are
 * lossy in lockstep and the framing cannot separate them. Two claims differing
 * only by an unpaired surrogate would hash identically and share one person's
 * resolution. UTF-16 is a direct code-unit encoding: nothing is replaced, and
 * `.length` is exact.
 *
 * Unpaired surrogates are not hypothetical: the local JSON store is
 * hand-editable and `JSON.parse` produces them happily.
 */
export function fingerprint(parts: readonly (string | null)[]): string {
  return createHash("sha256")
    .update(parts.map(frame).join(""), "utf16le")
    .digest("hex");
}

/**
 * Sorts by UTF-16 code unit, never `localeCompare`.
 *
 * Locale-aware collation is ICU- and environment-dependent, so it would produce
 * a different fingerprint for the same data on a different machine — silently
 * detaching every recorded resolution.
 */
export function sortStable(values: readonly string[]): string[] {
  return [...values].sort();
}
