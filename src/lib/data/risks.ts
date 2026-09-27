import 'server-only';
import {randomUUID} from 'node:crypto';
import {cache} from 'react';
import {requireWorkspaceAccess,requireBusinessWriteAccess} from '@/lib/auth/access';
import {isLocalAuth} from '@/lib/auth/service';
import {withRepositoryContext} from '@/lib/auth/repository-context';
import {withLocalOwnerLock,readDeliveryFresh} from '@/lib/delivery/repository';
import {ownerFor} from '@/lib/delivery/model';
import {reviseRisk,type RiskCommand,type RiskEvent,type RiskTracking} from '@/lib/workspace/risks';
import {readStore,writeStoreAtomic} from './store';
import {p1Rpc} from './p1-rpc';

export interface RiskRead {tracking:RiskTracking[];events:RiskEvent[];}
export const readRisks=cache(async():Promise<RiskRead>=>{
 const ctx=await requireWorkspaceAccess();
 if(isLocalAuth())return withRepositoryContext(ctx,async()=>{const s=readStore();return {tracking:s.riskTracking??[],events:s.riskEvents??[]};});
 return p1Rpc<RiskRead>(ctx,'read_risk_tracking',{});
});
export async function saveRisk(initiativeId:string,cmd:RiskCommand):Promise<string>{
 const ctx=await requireBusinessWriteAccess();
 if(!isLocalAuth())return p1Rpc<string>(ctx,'save_risk_tracking',{p_initiative_id:initiativeId,p_input:cmd});
 const d=await readDeliveryFresh();
 return withRepositoryContext(ctx,async()=>withLocalOwnerLock(ctx,delivery=>writeStoreAtomic(s=>{
  const initiative=s.initiatives.find(i=>i.id===initiativeId&&i.workspaceId===ctx.workspaceId);if(!initiative)throw Error('Initiative unavailable.');
  const r=reviseRisk(s.riskTracking??[],s.riskEvents??[],cmd,ctx,initiative,ownerFor(delivery.facts,initiative.id),d.source.members,s.claims,(s.commitments??[]).filter(a=>a.initiativeId===initiative.id).map(a=>a.id),new Date().toISOString());
  if(!r.event)return r.tracking.id;
  const list=(s.riskTracking??=[]);const at=list.findIndex(x=>x.id===r.tracking.id);if(at>=0)list[at]=r.tracking;else list.push(r.tracking);
  (s.riskEvents??=[]).push(r.event);
  s.activity.push({id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId,eventType:`RISK_${r.event.type}`,summary:`Risk ${r.event.type==='STARTED'?'tracking started':r.event.type==='STATUS'?`marked ${r.tracking.status.toLowerCase()}`:r.event.type==='CARRIED'?'tracking carried forward':'updated'}: ${r.event.statement}`,occurredAt:r.event.at,entityType:'RISK',entityId:r.tracking.id,actorLabel:ctx.actor.label,payload:{trackingId:r.tracking.id,claimId:r.tracking.claimId}});
  return r.tracking.id;
 })));
}
