import {CLAIM_TYPES,DOMAINS} from '../domain/types.ts';
import {dateValid} from '../delivery/model.ts';
import {locateQuote} from './anchor.ts';
import type {ProposalPayload,ProposalType} from './types';
/** An existing claim offered to the reader so a changed requirement can name what it replaces. */
export interface ReadableClaim {ref:string;id:string;updatedAt:string;type:string;status:string;subject:string;attribute:string;value:string;domain:ProposalPayload['domain'];phase:string|null;}
/** Only claims that can still be superseded are offered as targets. */
export const SUPERSEDABLE=['ACTIVE','UNVERIFIED','DRAFT'];
export function filterCandidates(text:string,raw:unknown,claims:ReadableClaim[]=[]){
 if(!Array.isArray(raw)||raw.length>50)throw Error('Invalid proposal response.');
 const accepted:{type:ProposalType;payload:ProposalPayload;anchor:{start:number;end:number;quote:string}}[]=[];let discarded=0;
 for(const candidate of raw){const c=candidate as Record<string,unknown>;const p=c?.payload as Record<string,unknown>|undefined;const type=c?.type as ProposalType;
  const anchor=typeof c?.quote==='string'?locateQuote(text,c.quote,typeof c.hint==='number'?c.hint:0):null;
  if(!anchor||!p||![...CLAIM_TYPES,'DELIVERY','ACTION','OPEN_QUESTION','CHANGED_REQUIREMENT'].includes(type)||type!=='CHANGED_REQUIREMENT'&&(typeof p.subject!=='string'||!p.subject.trim()||p.subject.length>200)||typeof p.value!=='string'||!p.value.trim()||p.value.length>4000||!['CHANGED_REQUIREMENT','OPEN_QUESTION'].includes(type)&&(typeof p.attribute!=='string'||!p.attribute.trim()||p.attribute.length>200)||type!=='CHANGED_REQUIREMENT'&&!DOMAINS.includes(p.domain as typeof DOMAINS[number])||p.phase!==null&&typeof p.phase!=='string'){discarded++;continue;}
  if(type==='DELIVERY'&&((p.factKind!=='NEXT_MILESTONE'&&p.date===null)||!['TARGET_LIVE','NEXT_MILESTONE','DEV_STARTED','ACTUAL_LIVE'].includes(String(p.factKind))||p.date!==null&&(!dateValid(String(p.date))||!anchor.quote.includes(String(p.date)))||p.factKind==='ACTUAL_LIVE'&&!['PARTIAL','FULL'].includes(String(p.extent)))){discarded++;continue;}
  // Require the proposed value itself to be copied from the immutable quote.
  // Summarized or inferred meanings need an explicit human entry instead.
  if(!anchor.quote.includes(p.value)){discarded++;continue;}
  if(type==='CHANGED_REQUIREMENT'){
   // The target is resolved server-side from the claims we offered. Subject,
   // attribute, domain and phase come from that existing record, never from AI.
   const target=claims.find(c=>c.ref===c2s(p.target)&&SUPERSEDABLE.includes(c.status));
   if(!target||target.value.trim()===String(p.value).trim()){discarded++;continue;}
   accepted.push({type,payload:{subject:target.subject,attribute:target.attribute,value:p.value as string,domain:target.domain,phase:target.phase,targetClaimId:target.id,targetClaimUpdatedAt:target.updatedAt},anchor});continue;
  }
  if(type==='OPEN_QUESTION'){accepted.push({type,payload:{subject:String(p.subject).trim(),attribute:'question',value:p.value as string,domain:p.domain as ProposalPayload['domain'],phase:null},anchor});continue;}
  accepted.push({type,payload:{subject:String(p.subject).trim(),attribute:String(p.attribute).trim(),value:p.value,domain:p.domain as ProposalPayload['domain'],phase:typeof p.phase==='string'?p.phase.trim()||null:null,...(type==='DELIVERY'?{factKind:p.factKind as ProposalPayload['factKind'],date:p.date as string|null,extent:p.extent as ProposalPayload['extent']}: {})},anchor});
 }
 return {accepted,discarded};
}
const c2s=(v:unknown)=>typeof v==='string'?v.trim():'';
export function cosmeticPayload(before:ProposalPayload,after:ProposalPayload){const normalize=(s:string)=>s.trim().replace(/\s+/g,' ').toLowerCase().replace(/[.!?]+$/,'');return JSON.stringify({...before,subject:normalize(before.subject),attribute:normalize(before.attribute),value:normalize(before.value)})===JSON.stringify({...after,subject:normalize(after.subject),attribute:normalize(after.attribute),value:normalize(after.value)});}
