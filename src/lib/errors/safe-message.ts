/**
 * What a person may read from a failure. Our own refusals are written as plain
 * sentences and pass through; anything that looks technical — database or driver
 * text, internal codes, JSON, stack fragments, identifiers, URLs — is replaced by
 * the caller's plain fallback, which says what happened and what to do next.
 */
const TECHNICAL = [
  /violates|constraint|duplicate key|null value in column|relation "|column "|syntax error|function public\.|permission denied for|row-level security/i,
  /\bPGRST\d+|\bSQLSTATE\b|\bpostgres\b|\bsupabase\b/i,
  /TypeError|ReferenceError|SyntaxError|RangeError|Unexpected token|is not a function|Cannot read propert|undefined|\$undefined/,
  /ECONN|ETIMEDOUT|ENOTFOUND|ENOENT|EACCES|fetch failed|socket hang up|network error/i,
  /\bat [\w.<>]+ \(|\.tsx?:\d+|\.js:\d+/,
  /https?:\/\//i,
  /[{}[\]<>]/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
];

export function safeMessage(error: unknown, fallback: string): string {
  const text = error instanceof Error ? error.message.trim() : typeof error === "string" ? error.trim() : "";
  if (!text || text.length > 400) return fallback;
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(text)) return fallback; // bare internal code
  if (TECHNICAL.some(r => r.test(text))) return fallback;
  if (!/^[A-Z“"'(0-9]/.test(text)) return fallback; // written sentences only
  return text;
}
