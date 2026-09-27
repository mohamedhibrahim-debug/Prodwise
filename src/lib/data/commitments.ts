import 'server-only';
import {createHash} from 'node:crypto';
import {cache} from 'react';
import {requireWorkspaceAccess,requireBusinessWriteAccess} from '@/lib/auth/access';
import {isLocalAuth,adminClient} from '@/lib/auth/service';
import {withRepositoryContext} from '@/lib/auth/repository-context';
import {withLocalOwnerLock,readDeliveryFresh} from '@/lib/delivery/repository';
import {hasOrganizationAdminAuthority} from '@/lib/auth/roles';
import {ownerFor} from '@/lib/delivery/model';
import {reviseCommitment,type Commitment,type CommitmentEvent,type CommitmentInput} from '@/lib/workspace/commitments';
import {readStore,writeStoreAtomic} from './store';
export const readCommitments=cache(async():Promise<{actions:Commitment[];events:CommitmentEvent[]}>=>{
 const ctx=await requireWorkspaceAccess();if(isLocalAuth())return withRepositoryContext(ctx,async()=>{const s=readStore();return {actions:s.commitments??[],events:s.commitmentEvents??[]};});
 const {data,error}=await adminClient().rpc('read_commitments',{p_workspace_id:ctx.workspaceId,p_member_id:ctx.memberId??ctx.actor.id});if(error)throw Error('Commitments could not be loaded.');return data;
});
export async function saveCommitment(input:CommitmentInput,initiativeId:string,workspaceId:string):Promise<string>{
 const ctx=await requireBusinessWriteAccess();if(ctx.workspaceId!==workspaceId)throw Error('Your organization changed. Reload before saving.');
 if(input.origin&&input.origin!=='HUMAN_ENTRY')throw Error('Use the source confirmation flow to create a linked commitment.');
 const d=await readDeliveryFresh(),i=d.source.snapshots.find(s=>s.initiative.id===initiativeId);if(!i)throw Error('Initiative unavailable.');
 function validateWeekly(state:typeof d.state){if(!input.weekly)return;const w=input.weekly,r=state.reviews.find(r=>r.id===w.reviewId&&r.workspaceId===ctx.workspaceId),section=r?.sections.find(s=>s.initiativeId===initiativeId);if(!r||r.status!=='DRAFT'||r.revision!==w.reviewRevision||!section||!w.line.trim()||w.line.trim()==='Not recorded'||!section.nextStep.split(/\r?\n/).map(s=>s.trim()).includes(w.line.trim()))throw Error('The weekly next step changed. Reopen its saved Draft before converting it.');if(!hasOrganizationAdminAuthority(ctx)&&!ctx.isProductLead&&ownerFor(state.facts,initiativeId)!==ctx.memberId)throw Error('Only the initiative owner or review administration can convert its saved next step.');input={...input,origin:'WEEKLY_REVIEW',originRefId:`${r.id}:${initiativeId}:${createHash('md5').update(w.line.trim()).digest('hex')}`,originHref:`/weekly-review?week=${r.week}&initiative=${i!.initiative.slug}`};}
 validateWeekly(d.state);

 if(isLocalAuth())return withRepositoryContext(ctx,async()=>withLocalOwnerLock(ctx,state=>writeStoreAtomic(s=>{
  validateWeekly(state);
  const fresh=s.initiatives.find(x=>x.id===initiativeId&&x.workspaceId===ctx.workspaceId);if(!fresh)throw Error('Initiative unavailable.');
  const next=reviseCommitment(s.commitments??[],s.commitmentEvents??[],input,ctx,fresh,ownerFor(state.facts,i.initiative.id),d.source.members,s.evidence.filter(e=>e.initiativeId===initiativeId).map(e=>e.id),new Date().toISOString());
  if(next.event){s.commitments=[...(s.commitments??[]).filter(a=>a.id!==next.action.id),next.action];(s.commitmentEvents??=[]).push(next.event);s.activity.push({id:next.event.id,workspaceId:ctx.workspaceId,initiativeId,eventType:'COMMITMENT_'+next.event.type,summary:next.event.type==='CREATED'?`Commitment recorded: ${next.action.title}`:`Commitment updated: ${next.action.title} · ${next.action.status.toLowerCase().replaceAll('_',' ')}`,occurredAt:next.event.at,entityType:'ACTION',entityId:next.action.id,actorLabel:ctx.actor.label,payload:{before:next.event.before,after:next.event.after,note:next.event.note,actor:ctx.actor}});}
  return next.action.id;
 })));
 const {data,error}=await adminClient().rpc('save_commitment',{p_workspace_id:ctx.workspaceId,p_member_id:ctx.memberId??ctx.actor.id,p_initiative_id:initiativeId,p_input:input});if(error)throw Error(error.message.includes('STALE')?'This commitment changed. Your input is retained; review the latest record before saving.':'The commitment change was refused. Check your access, status, assignee and reason.');return String(data);
}
