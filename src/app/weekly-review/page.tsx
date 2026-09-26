import { hasOrganizationAdminAuthority, canBusinessWrite } from "@/lib/auth/roles";
import Link from "next/link";
import { readDelivery } from "@/lib/delivery/repository";
import { changesSince, freezeInput, isoWeek, referencesFor, weekValid } from "@/lib/delivery/model";
import { createWeeklyReviewAction, draftWeeklyReviewAction, finalizeWeeklyReviewAction, refreshWeeklyReviewAction } from "@/lib/delivery/actions";
import { ActionForm } from "@/components/delivery/ActionForm";
import { WeeklySection } from "@/components/delivery/WeeklySection";
import { memberLabel } from "@/components/delivery/FactEditor";
import { WriteNotice } from "@/components/delivery/WriteNotice";
import { isDemoWriteEnabled } from "@/lib/env";
import styles from "@/components/delivery/delivery.module.css";
export default async function WeeklyReviewPage({searchParams}:{searchParams:Promise<{week?:string}>}) {
  const selection=await searchParams; const {ctx,source,state}=await readDelivery(); const now=new Date().toISOString(); const week=selection.week && weekValid(selection.week) ? selection.week : isoWeek(now);
  const review=state.reviews.find(r=>r.workspaceId===ctx.workspaceId && r.week===week); const baseline=review ? state.reviews.find(r=>r.id===review.baselineReviewId && r.workspaceId===ctx.workspaceId) : undefined;
  const current=freezeInput(source,state,ctx.workspaceId,now); const changes=review ? changesSince(review.input,baseline?.input ?? null) : [];
  const ai=review?.aiDrafts.at(-1); const editable=canBusinessWrite(ctx); const refs=review ? referencesFor(review.input,baseline?.input ?? null) : [];
  const availableIds=new Set(source.snapshots.map(s=>s.initiative.id));
  const ownerGroups=review ? [...new Set(review.sections.filter(s=>availableIds.has(s.initiativeId)).map(s=>s.ownerMemberId))].sort((a,b)=>memberLabel(review.input.members,a).localeCompare(memberLabel(review.input.members,b))) : [];
  return <div className={styles.page}><header className={styles.header}><div><h1>Weekly Product Review</h1><p>One shared portfolio review for the selected ISO week. PMs maintain their initiative sections.</p></div><nav className={styles.links}><Link href="/">Home</Link><Link href="/roadmap">Roadmap</Link></nav></header>
    <WriteNotice ctx={ctx}/>
    <form className={styles.filters}><label className={styles.field}>Review week<input type="week" name="week" defaultValue={week}/></label><button className={styles.button}>Open week</button></form>
    {!review ? <><p className={styles.notice}>No shared review exists for {week}. Creating it freezes the current portfolio inputs. The review week is a meeting label; its actual data cutoff is recorded separately.</p>{editable && <ActionForm action={createWeeklyReviewAction} label="Prepare shared weekly review" disabled={!isDemoWriteEnabled}><input type="hidden" name="week" value={week}/></ActionForm>}</> : <>
      <div className={styles.notice}><strong>{review.week} · {review.status === "FINAL" ? "Final review" : "Shared draft"}</strong><p>Snapshot cutoff: {new Date(review.input.asOf).toLocaleString("en-GB",{timeZone:"Africa/Cairo"})} Cairo.</p><p>{baseline ? `Recorded changes since the ${baseline.week} final review cutoff ${new Date(baseline.input.asOf).toLocaleString("en-GB",{timeZone:"Africa/Cairo"})} Cairo. The comparison may span skipped weeks and include late-recorded historical changes.` : "No previous finalized review. This is a current-state inventory; no weekly change baseline has been invented."}</p>{review.status === "FINAL" && <p>Finalized by {review.finalizedByLabel} · {review.finalizedAt}. Snapshot and original wording are preserved.</p>}</div>
      <p>{review.input.snapshots.length} initiatives in the frozen portfolio · {new Set(changes.filter(c=>c.kind === "TARGET_LIVE").map(c=>c.initiativeId)).size} target movements · {refs.filter(r=>r.id.startsWith("finding:")).length} recorded mismatches</p>
      {review.input.snapshots.some(s=>!availableIds.has(s.initiative.id)) && <p className={styles.notice}>Only {review.input.snapshots.filter(s=>availableIds.has(s.initiative.id)).length} initiative sections remain available under your current workspace access. The counts above describe the original frozen portfolio.</p>}
      <p className={styles.meta}>Mismatch counts do not assess business impact. Gaps, risks and release readiness are not automatically checked. A PM can record decision context in their section.</p>
      {review.status === "DRAFT" && current.digest!==review.input.digest && <p className={styles.warning}>Portfolio inputs changed after this snapshot. Refresh before saving affected PM sections or finalizing.</p>}
      {ai && <p className={styles.notice}>{ai.mode === "CLAUDE" ? `Wording selected and organized by Claude (${ai.model}) from verified source statements. Review it before saving.` : ai.reason}<span className={styles.meta}> · {ai.generatedAt}</span></p>}
      {review.status === "DRAFT" && editable && <div className={styles.fields}><ActionForm action={refreshWeeklyReviewAction} label="Refresh delivery inputs" disabled={!isDemoWriteEnabled}><input type="hidden" name="reviewId" value={review.id}/><input type="hidden" name="revision" value={review.revision}/></ActionForm><ActionForm action={draftWeeklyReviewAction} label="Draft wording with Claude" disabled={!isDemoWriteEnabled}><input type="hidden" name="reviewId" value={review.id}/><input type="hidden" name="revision" value={review.revision}/></ActionForm>{(hasOrganizationAdminAuthority(ctx) || ctx.isProductLead) && <ActionForm action={finalizeWeeklyReviewAction} label="Finalize reviewed portfolio" disabled={!isDemoWriteEnabled}><input type="hidden" name="reviewId" value={review.id}/><input type="hidden" name="revision" value={review.revision}/></ActionForm>}</div>}
      {ownerGroups.map(owner=><div key={owner ?? "unassigned"}><h2>{memberLabel(review.input.members,owner)} · initiative updates</h2>{review.sections.filter(s=>s.ownerMemberId===owner && availableIds.has(s.initiativeId)).map(section=><WeeklySection key={`${section.initiativeId}:${section.revision}`} section={section} review={review} current={current} ctx={ctx}/>)}</div>)}
      <details className={styles.details}><summary>Recorded delivery changes and source statements</summary>{refs.filter(r=>current.snapshots.some(s=>s.initiative.id===r.initiativeId)).map(ref=><p key={ref.id}>{ref.texts[0]}<span className={styles.meta}> · {ref.id}</span></p>)}</details>
    </>}
  </div>;
}
