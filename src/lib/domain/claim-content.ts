import type { ClaimPatch, MemoryClaim } from "./types.ts";

export const CONFIRMED_CONTENT_MESSAGE =
  "This entry is confirmed, so what it says can’t be changed in place — that would show a confirmation nobody gave. Add the corrected entry, then mark this one Replaced by it; the history stays true.";

type Content = Pick<MemoryClaim, "type" | "subject" | "attribute" | "value" | "domain" | "phase">;
const clean = (v: string | null | undefined) => (v ?? "").trim();

/** Content fields a patch would change. Status, supersession and applicability are not content. */
export function contentChanges(existing: Content, patch: ClaimPatch): (keyof Content)[] {
  const changed: (keyof Content)[] = [];
  if (patch.type !== undefined && patch.type !== existing.type) changed.push("type");
  if (patch.subject !== undefined && clean(patch.subject) !== clean(existing.subject)) changed.push("subject");
  if (patch.attribute !== undefined && clean(patch.attribute) !== clean(existing.attribute)) changed.push("attribute");
  if (patch.value !== undefined && clean(patch.value) !== clean(existing.value)) changed.push("value");
  if (patch.domain !== undefined && patch.domain !== existing.domain) changed.push("domain");
  if (patch.phase !== undefined && clean(patch.phase) !== clean(existing.phase)) changed.push("phase");
  return changed;
}

/** A confirmed entry's content is fixed; only its status (e.g. Replaced) may change. */
export function assertConfirmedContentUnchanged(existing: Content & Pick<MemoryClaim, "status">, patch: ClaimPatch): void {
  if (existing.status === "ACTIVE" && contentChanges(existing, patch).length) throw new Error(CONFIRMED_CONTENT_MESSAGE);
}
