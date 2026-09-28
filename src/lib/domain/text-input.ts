/**
 * Hand-entered text is cleaned before it is stored. Control characters (other than
 * line breaks and tabs) and bidirectional overrides are removed: they cannot be seen,
 * hosted Postgres rejects NUL, and direction overrides can make one field reorder
 * another on screen. Limits keep one entry from turning into megabytes of history.
 */
const INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g;
export const cleanText = (value: string) => value.replace(INVISIBLE, "");

export const LIMITS = { subject: 160, attribute: 160, value: 4000, phase: 80, title: 200, sourceReference: 500, contentSummary: 20000 } as const;
const LABEL: Record<keyof typeof LIMITS, string> = { subject: "Subject", attribute: "Attribute", value: "Value", phase: "Phase", title: "Title", sourceReference: "Reference", contentSummary: "Summary" };

/** Cleans the known text fields of a create/update input and enforces their limits. */
export function cleanInput<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = { ...input };
  for (const key of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    const v = out[key];
    if (typeof v !== "string") continue;
    const cleaned = cleanText(v);
    if (cleaned.trim().length > LIMITS[key]) throw new Error(`${LABEL[key]} is too long — keep it under ${LIMITS[key].toLocaleString("en-GB")} characters. Nothing was saved.`);
    out[key] = cleaned;
  }
  if (typeof out.sourceUrl === "string" && out.sourceUrl.trim()) {
    let ok = false;
    try { const u = new URL(out.sourceUrl.trim()); ok = (u.protocol === "https:" || u.protocol === "http:") && !u.username && !u.password; } catch { ok = false; }
    if (!ok) throw new Error("Enter a web link that starts with https or http. Nothing was saved.");
    out.sourceUrl = out.sourceUrl.trim();
  }
  return out as T;
}
