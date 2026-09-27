import 'server-only';
import {randomUUID} from 'node:crypto';
import {cache} from 'react';
import {requireWorkspaceAccess,requireBusinessWriteAccess} from '@/lib/auth/access';
import {isLocalAuth} from '@/lib/auth/service';
import {withRepositoryContext} from '@/lib/auth/repository-context';
import {withLocalOwnerLock,readDeliveryFresh} from '@/lib/delivery/repository';
import {ownerFor} from '@/lib/delivery/model';
import {reviseQuestion,type OpenQuestion,type QuestionCommand,type QuestionEvent} from '@/lib/workspace/questions';
import {readStore,writeStoreAtomic} from './store';
import {p1Rpc} from './p1-rpc';

export interface QuestionRead {questions:OpenQuestion[];events:QuestionEvent[];}
export const readQuestions=cache(async():Promise<QuestionRead>=>{
 const ctx=await requireWorkspaceAccess();
 if(isLocalAuth())return withRepositoryContext(ctx,async()=>{const s=readStore();return {questions:s.openQuestions??[],events:s.questionEvents??[]};});
 return p1Rpc<QuestionRead>(ctx,'read_open_questions',{});
});

/** Human commands only. Non-human origins are created inside proposal / Weekly confirmation. */
export async function saveQuestion(initiativeId:string,cmd:QuestionCommand):Promise<string>{
 const ctx=await requireBusinessWriteAccess();
 if(cmd.origin&&cmd.origin!=='HUMAN_ENTRY')throw Error('Questions from meetings or reviews are opened by confirming them there.');
 if(!isLocalAuth())return p1Rpc<string>(ctx,'save_open_question',{p_initiative_id:initiativeId,p_input:cmd});
 const d=await readDeliveryFresh();
 return withRepositoryContext(ctx,async()=>withLocalOwnerLock(ctx,delivery=>writeStoreAtomic(s=>{
  const initiative=s.initiatives.find(i=>i.id===initiativeId&&i.workspaceId===ctx.workspaceId);if(!initiative)throw Error('Initiative unavailable.');
  const r=reviseQuestion(s.openQuestions??[],s.questionEvents??[],cmd,ctx,initiative,ownerFor(delivery.facts,initiative.id),d.source.members,s.claims,new Date().toISOString());
  if(!r.event)return r.question.id;
  const list=(s.openQuestions??=[]);const at=list.findIndex(q=>q.id===r.question.id);if(at>=0)list[at]=r.question;else list.push(r.question);
  (s.questionEvents??=[]).push(r.event);
  s.activity.push({id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId,eventType:`QUESTION_${r.event.type}`,summary:`Open question ${r.event.type.toLowerCase()}: ${r.question.question}`,occurredAt:r.event.at,entityType:'QUESTION',entityId:r.question.id,actorLabel:ctx.actor.label,payload:{questionId:r.question.id,type:r.event.type}});
  return r.question.id;
 })));
}
