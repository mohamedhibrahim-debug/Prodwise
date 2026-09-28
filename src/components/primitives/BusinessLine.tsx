import { BUSINESS_LINE_LABEL, BUSINESS_LINE_OFFICIAL_NAME } from "@/lib/domain/labels";
import type { BusinessLine as Code } from "@/lib/domain/types";

/**
 * A business line exactly as recorded. Short codes (BP, FS, MF) are official
 * identifiers and are never expanded by guesswork; a confirmed official name,
 * when one exists, appears as a secondary label and in the tooltip.
 */
export function BusinessLine({ code, detailed = false }: { code: Code | null | undefined; detailed?: boolean }) {
  if (!code) return <span className="business-line" data-empty="">No business line</span>;
  const label = BUSINESS_LINE_LABEL[code], full = BUSINESS_LINE_OFFICIAL_NAME[code];
  const isCode = /^[A-Z]{2,4}$/.test(label);
  return <span className="business-line" data-code={isCode || undefined} title={full ? `Business line ${label} — ${full}` : `Business line ${label}`}>
    {label}{full && detailed ? <small>{full}</small> : null}
  </span>;
}
