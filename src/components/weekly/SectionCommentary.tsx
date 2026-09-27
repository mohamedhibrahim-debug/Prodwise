import {MakeCommitment} from './MakeCommitment';
import {saveWeeklySectionAction} from "@/lib/delivery/actions";
import type {PortfolioInput,ReviewSection,WeeklyReview} from "@/lib/delivery/types";
import {displayedCommentary} from "@/lib/delivery/weekly-copy";
import {safeUserLabel} from "@/lib/demo/presentation";
import {memberLabel} from "@/components/delivery/FactEditor";
import {WeeklyActionForm} from "./WeeklyActionForm";
import styles from "./weekly.module.css";
const fields=[['headline','Status headline'],['updates','What changed'],['attention','Blockers / needs attention'],['decisionNeeded','Decisions needed'],['nextMilestone','Next milestone'],['nextStep','Next step']] as const;
export function SectionCommentary({review,section,baseline,editable,writesEnabled}:{review:WeeklyReview;section:ReviewSection;baseline:PortfolioInput|null;editable:boolean;writesEnabled:boolean}) {
  const text=displayedCommentary(section,review.input,baseline);
  return <section className={styles.block}><h3>Meeting commentary — this review only</h3><p className={styles.meta}>{section.editedAt?`${review.preparedAsFixture?"Prepared scenario notes":"Reviewed by"} ${safeUserLabel({preparedAsFixture:review.preparedAsFixture,confirmedByLabel:section.editedByLabel??memberLabel(review.input.members,section.editedByMemberId)})} · ${new Date(section.editedAt).toLocaleString("en-GB",{timeZone:"Africa/Cairo",dateStyle:"medium",timeStyle:"short"})} Cairo`:"This section has not been saved and reviewed."} Commentary never updates initiative records.</p>{section.needsRecheck&&<p className={styles.warning}>Needs re-check. Inputs or draft wording changed; your commentary was preserved.</p>}
    {editable?<WeeklyActionForm action={saveWeeklySectionAction} scopeWorkspaceId={review.workspaceId} label="Save and mark reviewed" disabled={!writesEnabled} watchEdits><input type="hidden" name="reviewId" value={review.id}/><input type="hidden" name="reviewRevision" value={review.revision}/><input type="hidden" name="initiativeId" value={section.initiativeId}/><input type="hidden" name="sectionRevision" value={section.revision}/><div className={styles.fields}>{fields.map(([field,label])=><label key={field} className={styles.field}>{label}<textarea aria-label={label} name={field} maxLength={4000} defaultValue={text[field]}/></label>)}</div></WeeklyActionForm>:<div className={styles.readout}>{fields.map(([field,label])=><p key={field}><strong>{label}</strong>{text[field]||"Not recorded"}</p>)}</div>}
    {editable&&writesEnabled&&review.status==='DRAFT'&&section.nextStep.split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&s!=='Not recorded').map((line,index)=><MakeCommitment key={`${review.revision}:${index}`} slug={review.input.snapshots.find(s=>s.initiative.id===section.initiativeId)!.initiative.slug} reviewId={review.id} reviewRevision={review.revision} line={line} ownerId={section.ownerMemberId} members={review.input.members}/>)}
    {section.aiOriginal&&<details><summary>AI draft source statements</summary>{section.aiOriginal.map(line=><p key={`${line.referenceId}:${line.text}`} className={styles.meta}>{line.text} · {line.referenceId}</p>)}</details>}
  </section>;
}
