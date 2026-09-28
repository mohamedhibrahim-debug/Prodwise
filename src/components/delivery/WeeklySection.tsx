import { BusinessLine } from '@/components/primitives/BusinessLine';
import {factDate} from '@/lib/delivery/display';
import { hasOrganizationAdminAuthority, canBusinessWrite } from "@/lib/auth/roles";
import Link from "next/link";
import type { PortfolioInput, ReviewSection, WeeklyReview, WorkspaceAccess } from "@/lib/delivery/types";
import { changesSince, factFor, ownerFor, referencesFor } from "@/lib/delivery/model";
import { displayDate } from "@/lib/delivery/roadmap";
import { saveWeeklySectionAction } from "@/lib/delivery/actions";
import { isDemoWriteEnabled } from "@/lib/env";
import { BUSINESS_LINE_LABEL, STAGE_LABEL } from "@/lib/domain/labels";
import { safeUserLabel } from "@/lib/demo/presentation";
import { memberLabel } from "./FactEditor";
import { ActionForm } from "./ActionForm";
import styles from "./delivery.module.css";
const fields=[['headline','Status headline'],['updates','What changed this week'],['attention','Blockers / needs attention'],['decisionNeeded','Decisions needed'],['nextMilestone','Next milestone'],['nextStep','Next step']] as const;
export function WeeklySection({section,review,current,baseline,ctx}:{section:ReviewSection;review:WeeklyReview;current:PortfolioInput;baseline:PortfolioInput|null;ctx:WorkspaceAccess}) {
  const snapshot=review.input.snapshots.find(s=>s.initiative.id===section.initiativeId); if (!snapshot) return null;
  if (!current.snapshots.some(s=>s.initiative.id===section.initiativeId)) return null;
  const initiative=snapshot.initiative; const target=factFor(review.input.facts,initiative.id,"TARGET_LIVE"); const actual=factFor(review.input.facts,initiative.id,"ACTUAL_LIVE"); const milestone=factFor(review.input.facts,initiative.id,"NEXT_MILESTONE");
  const blocker=factFor(review.input.facts,initiative.id,"BLOCKER");
  const recordedValues=referencesFor(review.input,baseline).filter(ref=>ref.initiativeId===initiative.id && ref.id.startsWith("finding:"));
  const movement=changesSince(review.input,baseline).find(change=>change.initiativeId===initiative.id && change.kind==="TARGET_LIVE");
  const canEdit=review.status === "DRAFT" && canBusinessWrite(ctx) && (hasOrganizationAdminAuthority(ctx) || ctx.isProductLead || ownerFor(current.facts,initiative.id)===ctx.memberId && section.ownerMemberId===ctx.memberId);
  const reviewed=Boolean(section.editedByMemberId || section.editedByUserId) && !section.needsRecheck;
  return <section className={styles.reviewSection} id={`section-${initiative.id}`}><div className={styles.header}><div><h2><Link href={`/initiatives/${initiative.slug}`}>{initiative.name}</Link></h2><p className={styles.meta}><BusinessLine code={initiative.businessLine}/> · {STAGE_LABEL[initiative.stage]} · {factFor(review.input.facts,initiative.id,"SCOPE")?.value.text ?? "Scope not confirmed"}</p></div><span className={section.needsRecheck?styles.attentionTag:styles.quietTag}>{review.status==="FINAL"?"Final snapshot":reviewed?"Reviewed":"Needs human review"}</span></div>
    <div className={styles.recordedReviewFacts} aria-label="Recorded facts"><h3>Recorded facts <span>Frozen at the review cutoff</span></h3>
      <div className={styles.facts}><p><span className={styles.factLabel}>Target Live · planned</span>{factDate(target)}</p><p><span className={styles.factLabel}>Actual Live</span>{actual?.value.date ? factDate(actual) : "Not recorded"}{actual && ` · ${actual.value.extent==="PARTIAL" ? `Partial: ${actual.value.text ?? "rollout not described"}; full launch not recorded` : "Full named scope"}`}</p><p><span className={styles.factLabel}>Next milestone · recorded</span>{milestone ? `${milestone.value.text} · ${milestone.value.date ? factDate(milestone) : "Date not recorded"}` : "Not recorded"}</p></div>
      <p className={styles.movement}><strong>Target Live movements</strong><br/>{movement?.label ?? (baseline ? "No recorded target movement since the previous final review." : "No previous final baseline. Current target is shown above.")}</p>
      <p className={styles.recordedAttention}><strong>Recorded blocker / needs attention</strong>{blocker?.value.text ?? "No blocker recorded. This does not confirm there are none."}</p>
      <div className={styles.recordedAttention}><strong>Open recorded value differences</strong>{recordedValues.length ? <ul>{recordedValues.map(ref=><li key={ref.id}><Link href={`/initiatives/${initiative.slug}/decisions?item=${encodeURIComponent(ref.id.slice("finding:".length))}`}>{ref.texts[0]}</Link></li>)}</ul> : <p>No open value differences under the recorded checks.</p>}</div>
      <p className={styles.recordedAttention}><strong>Recorded next step</strong>{factFor(review.input.facts,initiative.id,"NEXT_STEP")?.value.text ?? "Not recorded"}</p>
    </div>
    {section.needsRecheck && <p className={styles.warning}>Updated inputs or draft wording need review. Your PM notes were preserved.</p>}
    <div className={styles.pmNarrative}><h3>PM narrative <span>{review.preparedAsFixture?"Synthetic scenario notes":review.status==="FINAL"?"Human-reviewed wording":"Working notes"}</span></h3><p className={styles.meta}>{(section.editedByMemberId || section.editedByUserId) ? `${review.preparedAsFixture ? "Prepared scenario notes" : "Reviewed by"} · ${safeUserLabel({preparedAsFixture:review.preparedAsFixture,confirmedByLabel:section.editedByLabel ?? memberLabel(review.input.members,section.editedByMemberId)})} · ${section.editedAt}` : "PM section has not been reviewed yet."} · May include AI-assisted draft text. Notes do not change the recorded facts above.</p>
    {canEdit ? <ActionForm action={saveWeeklySectionAction} label="Save and mark section reviewed" disabled={!isDemoWriteEnabled}><input type="hidden" name="reviewId" value={review.id}/><input type="hidden" name="reviewRevision" value={review.revision}/><input type="hidden" name="initiativeId" value={initiative.id}/><input type="hidden" name="sectionRevision" value={section.revision}/><div className={styles.fields}>{fields.map(([name,label])=><label className={styles.field} key={name}>{label}<textarea name={name} maxLength={4000} defaultValue={section[name]} placeholder="Not recorded"/></label>)}</div></ActionForm> : <div className={styles.reviewReadout}>{fields.map(([key,label])=><p className={styles.bodyText} key={key}><strong>{label}</strong>{section[key] || "Not recorded"}</p>)}</div>}</div>
    {section.aiOriginal && <details className={styles.inlineDetails}><summary>AI-drafted wording · source references</summary>{section.aiOriginal.map(line=><p key={line.referenceId}>{line.text}<span className={styles.meta}> · {line.referenceId}</span></p>)}</details>}
  </section>;
}
