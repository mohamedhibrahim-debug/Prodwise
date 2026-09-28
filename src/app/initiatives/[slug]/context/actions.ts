'use server';
import { safeMessage } from '@/lib/errors/safe-message';
import {revalidatePath} from 'next/cache';
import {assertFormWorkspace} from '@/lib/auth/scope';
import {requireBusinessWriteAccess} from '@/lib/auth/access';
import {getRepository} from '@/lib/data';
import {saveQuestion} from '@/lib/data/questions';
import {saveRisk} from '@/lib/data/risks';
import {RISK_STATUSES,type RiskStatus} from '@/lib/workspace/risks';
import type {QuestionOperation} from '@/lib/workspace/questions';
export interface ContextActionState {error:string|null;message:string|null;id?:string;}
const QUESTION_DONE:Record<QuestionOperation,string>={CREATE:'Question opened. It is tracked here until someone answers or withdraws it.',EDIT:'Question updated.',ANSWER:'Answer recorded. The question moves to Answered.',WITHDRAW:'Question withdrawn. It stays in history.',REOPEN:'Question reopened.'};
async function scope(form:FormData){const ctx=await requireBusinessWriteAccess();assertFormWorkspace(form,ctx);const i=await getRepository().getInitiativeBySlug(String(form.get('slug')??''));if(!i)throw Error('Initiative unavailable.');return i;}
const opt=(form:FormData,k:string)=>form.has(k)?String(form.get(k)??'')||null:undefined;
export async function questionAction(_p:ContextActionState,form:FormData):Promise<ContextActionState>{
 try{const i=await scope(form);const operation=String(form.get('operation')) as QuestionOperation;if(!['CREATE','EDIT','ANSWER','WITHDRAW','REOPEN'].includes(operation))throw Error('Unsupported question command.');
  const id=await saveQuestion(i.id,{operation,id:opt(form,'id')??undefined,requestId:String(form.get('requestId')),expectedRevision:Number(form.get('expectedRevision')??0),question:opt(form,'question')??undefined,ownerMemberId:opt(form,'ownerMemberId'),expectedConfirmerText:opt(form,'expectedConfirmerText'),dueDate:opt(form,'dueDate'),answerNote:opt(form,'answerNote'),answerClaimId:opt(form,'answerClaimId'),reason:opt(form,'reason')??undefined});
  return {error:null,message:QUESTION_DONE[operation],id};
 }catch(e){return {error:safeMessage(e, 'The question was not saved.'),message:null};}finally{revalidatePath('/','layout');}
}
export async function riskAction(_p:ContextActionState,form:FormData):Promise<ContextActionState>{
 try{const i=await scope(form);const operation=String(form.get('operation'));if(!['START','UPDATE','STATUS','CARRY'].includes(operation))throw Error('Unsupported risk command.');
  const status=form.get('status')?String(form.get('status')) as RiskStatus:undefined;if(status&&!RISK_STATUSES.includes(status))throw Error('Choose a status.');
  const id=await saveRisk(i.id,{operation:operation as 'START'|'UPDATE'|'STATUS'|'CARRY',id:opt(form,'id')??undefined,claimId:opt(form,'claimId')??undefined,requestId:String(form.get('requestId')),expectedRevision:Number(form.get('expectedRevision')??0),status,ownerMemberId:opt(form,'ownerMemberId'),mitigationText:opt(form,'mitigationText'),mitigationActionId:opt(form,'mitigationActionId'),reason:opt(form,'reason')??undefined});
  return {error:null,message:operation==='START'?'Tracking started. Status, owner and mitigation now live here.':operation==='CARRY'?'Tracking carried to the replacement entry.':operation==='STATUS'?`Status changed to ${status?.toLowerCase()}.`:'Risk updated.',id};
 }catch(e){return {error:safeMessage(e, 'The risk was not saved.'),message:null};}finally{revalidatePath('/','layout');}
}
