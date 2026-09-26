import { hasOrganizationAdminAuthority, canBusinessWrite } from "@/lib/auth/roles";
import Link from "next/link";
import type { PortfolioInput, ReviewSection, WeeklyReview, WorkspaceAccess } from "@/lib/delivery/types";
import { factFor, ownerFor } from "@/lib/delivery/model";
import { saveWeeklySectionAction } from "@/lib/delivery/actions";
import { isDemoWriteEnabled } from "@/lib/env";
import { memberLabel } from "./FactEditor";
import { ActionForm } from "./ActionForm";
import styles from "./delivery.module.css";
const fields=[['headline','Status headline'],['updates','What changed / PM update'],['attention','What needs attention'],['decisionNeeded','Decision needed'],['nextMilestone','Next milestone note'],['nextStep','Next step note']] as const;
export function WeeklySection({section,review,current,ctx}:{section:ReviewSection;review:WeeklyReview;current:PortfolioInput;ctx:WorkspaceAccess}) {
  const snapshot=review.input.snapshots.find(s=>s.initiative.id===section.initiativeId); if (!snapshot) return null;
  if (!current.snapshots.some(s=>s.initiative.id===section.initiativeId)) return null;
  const initiative=snapshot.initiative; const target=factFor(review.input.facts,initiative.id,"TARGET_LIVE"); const actual=factFor(review.input.facts,initiative.id,"ACTUAL_LIVE"); const milestone=factFor(review.input.facts,initiative.id,"NEXT_MILESTONE");
  const canEdit=review.status === "DRAFT" && canBusinessWrite(ctx) && (hasOrganizationAdminAuthority(ctx) || ctx.isProductLead || ownerFor(current.facts,initiative.id)===ctx.memberId && section.ownerMemberId===ctx.memberId);
  return <section className={styles.section}><div className={styles.header}><div><h2><Link href={`/initiatives/${initiative.slug}`}>{initiative.name}</Link></h2><p className={styles.meta}>{initiative.businessLine} · {initiative.stage.replaceAll("_"," ")} · {factFor(review.input.facts,initiative.id,"SCOPE")?.value.text ?? "Scope not confirmed"}</p></div><p className={styles.meta}>Snapshot PM: {memberLabel(review.input.members,section.ownerMemberId)}</p></div>
    <div className={styles.facts}><p><span className={styles.factLabel}>Target Live · planned</span>{target?.value.date ?? "Unknown"}</p><p><span className={styles.factLabel}>Actual Live</span>{actual?.value.date ?? "Not recorded"}{actual && ` · ${actual.value.extent?.toLowerCase()} named scope`}</p><p><span className={styles.factLabel}>Next milestone · planned</span>{milestone ? `${milestone.value.text} · ${milestone.value.date ?? "Date not recorded"}` : "Not recorded"}</p><p><span className={styles.factLabel}>Next step · recorded</span>{factFor(review.input.facts,initiative.id,"NEXT_STEP")?.value.text ?? "Not recorded"}</p></div>
    {section.needsRecheck && <p className={styles.warning}>Updated inputs or draft wording need review. Your PM notes were preserved.</p>}
    <p className={styles.meta}>{(section.editedByMemberId || section.editedByUserId) ? `Reviewed by ${section.editedByLabel ?? memberLabel(review.input.members,section.editedByMemberId)} · ${section.editedAt}` : "PM section has not been reviewed yet."} · Narrative notes do not change the confirmed facts above.</p>
    {canEdit ? <ActionForm action={saveWeeklySectionAction} label="Save and mark section reviewed" disabled={!isDemoWriteEnabled}><input type="hidden" name="reviewId" value={review.id}/><input type="hidden" name="reviewRevision" value={review.revision}/><input type="hidden" name="initiativeId" value={initiative.id}/><input type="hidden" name="sectionRevision" value={section.revision}/><div className={styles.fields}>{fields.map(([name,label])=><label className={styles.field} key={name}>{label}<textarea name={name} maxLength={4000} defaultValue={section[name]}/></label>)}</div></ActionForm> : <div>{fields.filter(([key])=>section[key]).map(([key,label])=><p className={styles.bodyText} key={key}><strong>{label}</strong><br/>{section[key]}</p>)}</div>}
    {section.aiOriginal && <details className={styles.details}><summary>Original draft wording and source references</summary>{section.aiOriginal.map(line=><p key={line.referenceId}>{line.text}<span className={styles.meta}> · {line.referenceId}</span></p>)}</details>}
  </section>;
}
