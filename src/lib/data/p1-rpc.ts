import 'server-only';
import {adminClient} from '@/lib/auth/service';
import type {WorkspaceAccess} from '@/lib/auth/access';

/** Shared SQL error vocabulary for P1 commands. Raw database text never reaches the UI. */
const MESSAGES:Record<string,string>={
 VIEW_ONLY:'Your role is read-only.',ACCESS_DENIED:'Your access changed. Reload and try again.',
 INITIATIVE_ARCHIVED:'Archived — restore to edit. Nothing was changed.',ARCHIVED:'Archived — restore to edit. Nothing was changed.',
 INITIATIVE_ACCESS:'That initiative is not available in this organization.',
 STALE_RELATIONSHIP:'This relationship was changed by someone else. Your change was not saved; your input is kept.',
 RELATIONSHIP_DUPLICATE:'This relationship is already recorded.',RELATIONSHIP_CYCLE:'This would create a circular dependency.',
 RELATIONSHIP_PARENT:'This initiative is already part of another initiative. End that relationship first.',
 RELATIONSHIP_PERMISSION:'Only the initiative owner, a Product Lead or administration can record or change its relationships.',
 RELATIONSHIP_TARGET_ARCHIVED:'New relationships to archived initiatives are not allowed.',RELATIONSHIP_SELF:'An initiative cannot relate to itself.',
 RELATIONSHIP_FIELDS:'Check the relationship type, rationale and dates.',RELATIONSHIP_ENDED:'This relationship has ended. Record a new one if it applies again.',
 STALE_PROPOSAL:'This proposal changed. Review the current version; nothing was overwritten.',PROPOSAL_HANDLED:'This proposal was already decided by someone else.',
 STALE_QUESTION:'This question was changed by someone else. Your change was not saved; your input is kept.',
 QUESTION_PERMISSION:'Only the question owner, the initiative owner, a Product Lead or administration can do that.',
 QUESTION_NOT_OPEN:'This question is no longer open.',QUESTION_ALREADY_OPEN:'This question is already open.',ANSWER_REQUIRED:'Record an answer note or link a confirmed Knowledge entry.',
 ANSWER_CLAIM_NOT_CONFIRMED:'Only a confirmed (active) Knowledge entry in this initiative can answer a question. Unverified entries cannot be linked.',
 REASON_REQUIRED:'Add a reason for this change.',NOTHING_CHANGED:'Nothing changed.',QUESTION_FIELDS:'Check the question text, owner and date.',OWNER_INVALID:'Choose an active non-Viewer member in this organization.',
 STALE_RISK:'This risk was changed by someone else. Your change was not saved; your input is kept.',
 RISK_PERMISSION:'Only the risk owner, the initiative owner, a Product Lead or administration can do that.',
 RISK_CLAIM_INVALID:'Only a confirmed risk in this initiative can be tracked.',RISK_ALREADY_TRACKED:'This risk is already tracked.',RISK_FIELDS:'Check the status, owner and mitigation.',
 MEETING_PERMISSION:'Only the person who added these notes, the initiative owner or administration can correct them.',STALE_MEETING:'These meeting details were changed by someone else. Your correction was not saved.',
};
export async function p1Rpc<T>(ctx:WorkspaceAccess,command:string,args:Record<string,unknown>):Promise<T>{
 const {data,error}=await adminClient().rpc(command,{p_workspace_id:ctx.workspaceId,p_member_id:ctx.memberId??ctx.actor.id,...args});
 if(error){const code=Object.keys(MESSAGES).find(k=>error.message.includes(k));throw Error(code?MESSAGES[code]:'The change was refused. Check your access and try again.');}
 return data as T;
}
