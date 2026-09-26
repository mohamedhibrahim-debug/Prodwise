import type { NarrativeLine, Reference } from "./types.ts";

/** Extractive validation rather than a regex assertion of factual truth.
 * Arbitrary prose, spelled/relative dates, launch/health inventions and foreign
 * evidence references cannot pass because each whole line must match a permitted
 * canonical statement for the same initiative and frozen snapshot. */
export function validateDraft(value:unknown,refs:Reference[]):{initiativeId:string;lines:NarrativeLine[]}[] {
  if (!value || typeof value!=="object" || !("sections" in value) || !Array.isArray(value.sections) || value.sections.length>200) throw new Error("Invalid structured draft");
  const seen=new Set<string>();
  return value.sections.map((section:unknown)=>{
    if (!section || typeof section!=="object" || !("initiativeId" in section) || typeof section.initiativeId!=="string" || seen.has(section.initiativeId) || !("lines" in section) || !Array.isArray(section.lines) || section.lines.length>12) throw new Error("Invalid section");
    const id=section.initiativeId; seen.add(id); if (!refs.some(r=>r.initiativeId===id)) throw new Error("Unknown initiative");
    const used=new Set<string>(); const lines=section.lines.map((line:unknown)=>{
      if (!line || typeof line!=="object" || !("referenceId" in line) || typeof line.referenceId!=="string" || !("text" in line) || typeof line.text!=="string" || used.has(line.referenceId)) throw new Error("Invalid reference");
      const ref=refs.find(r=>r.id===line.referenceId && r.initiativeId===id);
      if (!ref || !ref.texts.includes(line.text)) throw new Error("Unsupported statement");
      used.add(line.referenceId); return {referenceId:line.referenceId,text:line.text};
    });
    return {initiativeId:id,lines};
  });
}
