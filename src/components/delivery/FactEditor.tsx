import { hasOrganizationAdminAuthority, canBusinessWrite } from "@/lib/auth/roles";
import Link from "next/link";
import type { DeliveryFact, DeliveryMember, FactKind, PortfolioSource, WorkspaceAccess } from "@/lib/delivery/types";
import { FACT_KINDS } from "@/lib/delivery/types";
import { ownerFor, supportChanged } from "@/lib/delivery/model";
import { saveDeliveryFactAction } from "@/lib/delivery/actions";
import { isDemoWriteEnabled } from "@/lib/env";
import { safeUserLabel } from "@/lib/demo/presentation";
import { ActionForm } from "./ActionForm";
import styles from "./delivery.module.css";
export const FACT_LABELS:Record<FactKind,string>={SCOPE:"Delivery phase / scope",OWNER:"Responsible PM",SOLUTION_DEFINED:"Solution baseline confirmed — actual",DEV_STARTED:"Development Start — actual",TARGET_LIVE:"Target Live — planned",ACTUAL_LIVE:"Actual Live",NEXT_MILESTONE:"Next milestone — planned",BLOCKER:"Blocker / attention",NEXT_STEP:"Next step"};
const definitions:Partial<Record<FactKind,string>>={SCOPE:"Name the exact phase, pilot or rollout this delivery record describes. Dates apply only to this scope.",SOLUTION_DEFINED:"The date a human confirmed the named scope's agreed solution baseline: requirements and proposed approach were recorded well enough for implementation planning. This does not confirm development start, release readiness or launch approval.",DEV_STARTED:"The confirmed date implementation began for this scope. Do not enter an estimated future start here.",TARGET_LIVE:"The current committed production target for this scope, recorded or confirmed by a human. Each change retains its previous date and reason.",ACTUAL_LIVE:"The confirmed first production live date for real users in this scope. Specify partial or full rollout. A missing date does not mean the initiative is not live.",NEXT_MILESTONE:"Name the next concrete delivery checkpoint. Its planned date can remain unknown."};
export function FactEditor({initiativeId,facts,source,ctx}:{initiativeId:string;facts:DeliveryFact[];source:PortfolioSource;ctx:WorkspaceAccess}) {
  const snapshot=source.snapshots.find(s=>s.initiative.id===initiativeId)!;
  const owner=ownerFor(facts,initiativeId);
  return <div>{FACT_KINDS.map(kind=>{
    const fact=facts.find(f=>f.initiativeId===initiativeId && f.kind===kind);
    const canEdit=canBusinessWrite(ctx) && (kind === "OWNER" ? hasOrganizationAdminAuthority(ctx) || ctx.isProductLead : hasOrganizationAdminAuthority(ctx) || owner===ctx.memberId);
    const value=fact?.state === "SET" ? fact.value : null;
    return <details key={kind} className={styles.details}><summary>{FACT_LABELS[kind]} · {kind === "OWNER" ? memberLabel(source.members,value?.memberId ?? null) : [value?.date,value?.text].filter(Boolean).join(" — ") || "Not recorded"}</summary>
      {definitions[kind] && <p className={styles.meta}>{definitions[kind]}</p>}
      {fact && <p className={styles.meta}>{fact.preparedAsFixture ? "Prepared by" : "Confirmed by"} {safeUserLabel(fact)} · {new Date(fact.updatedAt).toLocaleString("en-GB",{timeZone:"Africa/Cairo"})} Cairo · revision {fact.revision} · {fact.basis === "EVIDENCE" ? "Evidence" : "Direct knowledge"}{fact.state === "RETRACTED" ? " · withdrawn" : ""}<br/>{fact.note}{fact.evidenceId && <><br/><Link href={`/initiatives/${snapshot.initiative.slug}/knowledge/sources`}>{snapshot.evidence.find(e=>e.id===fact.evidenceId)?.title ?? "Linked source unavailable"}</Link>{fact.locator && ` · ${fact.locator}`}</>}</p>}
      {fact && supportChanged(fact,source) && <p className={styles.warning}>Supporting evidence changed. Review it before relying on this value; the confirmation has been preserved.</p>}
      {canEdit ? <ActionForm action={saveDeliveryFactAction} label="Confirm and save" disabled={!isDemoWriteEnabled}>
        <input type="hidden" name="initiativeId" value={initiativeId}/><input type="hidden" name="kind" value={kind}/><input type="hidden" name="revision" value={fact?.revision ?? 0}/>
        <div className={styles.fields}>
          {["SOLUTION_DEFINED","DEV_STARTED","TARGET_LIVE","ACTUAL_LIVE","NEXT_MILESTONE"].includes(kind) && <label className={styles.field}>{kind === "TARGET_LIVE" || kind === "NEXT_MILESTONE" ? "Planned date" : "Actual date"}<input type="date" name="date" defaultValue={value?.date ?? ""}/></label>}
          {["SCOPE","NEXT_MILESTONE","BLOCKER","NEXT_STEP","ACTUAL_LIVE"].includes(kind) && <label className={styles.field}>{kind === "ACTUAL_LIVE" ? "Rollout scope (required for partial launch)" : "Label or description"}<input name="text" maxLength={2000} defaultValue={value?.text ?? ""} placeholder={kind === "SCOPE" ? "For example: Phase A pilot release" : undefined}/></label>}
          {kind === "OWNER" && <label className={styles.field}>Workspace PM<select name="memberId" defaultValue={value?.memberId ?? ""}><option value="">Unassigned</option>{source.members.filter(m=>m.active && m.role!=="VIEWER").map(m=><option key={m.id} value={m.id}>{m.displayName}</option>)}</select></label>}
          {kind === "ACTUAL_LIVE" && <label className={styles.field}>Extent within the recorded delivery scope<select name="extent" defaultValue={value?.extent ?? ""}><option value="">Select extent</option><option value="FULL">Full named scope</option><option value="PARTIAL">Partial named scope</option></select></label>}
          <label className={styles.field}>How was this confirmed?<select name="basis" defaultValue={fact?.basis ?? "DIRECT_KNOWLEDGE"}><option value="DIRECT_KNOWLEDGE">Direct knowledge</option><option value="EVIDENCE">Evidence</option></select></label>
          <label className={styles.field}>Current-scope source<select name="evidenceId" defaultValue={fact?.evidenceId ?? ""}><option value="">No linked source</option>{snapshot.evidence.filter(e=>e.boundary === "CURRENT_SCOPE").map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
          <label className={styles.field}>Source location<input name="locator" maxLength={500} defaultValue={fact?.locator ?? ""}/></label>
          <label className={styles.field}>Confirmation / change reason<textarea name="note" maxLength={2000} required defaultValue=""/></label>
        </div>
        {fact && <label><input type="checkbox" name="retract" value="yes"/> Withdraw the earlier value and preserve its history</label>}
      </ActionForm> : <p className={styles.meta}>{!canBusinessWrite(ctx) ? "Read-only view." : "The assigned PM, Owner or Admin maintains these facts. An Org Owner, Admin or Product Lead assigns owners."}</p>}
    </details>;
  })}</div>;
}
export function memberLabel(members:DeliveryMember[],id:string|null):string { if (!id) return "Unassigned"; const member=members.find(m=>m.id===id); return member ? `${member.displayName}${member.active?"":" (inactive)"}` : "Owner unavailable"; }
