import {randomUUID} from 'node:crypto';
import {BUSINESS_LINES,STAGES,type BusinessLine,type Stage,type Initiative} from '../domain/types.ts';
import type {WorkspaceAccess} from '../auth/core.ts';
import type {DeliveryMember,DeliveryFact,DeliveryEvent} from '../delivery/types.ts';
import {validateInitialOwner} from './management-policy.ts';
import type {InitiativeContext} from './readiness.ts';
export interface InitiativeCreation {requestId:string;name:string;businessLine:BusinessLine;stage:Stage;ownerMemberId:string;description:string;contextLabel:string;}
export function prepareInitiativeCreation(input:InitiativeCreation,ctx:WorkspaceAccess,members:DeliveryMember[],existing:Initiative[],at:string){
 validateInitialOwner(ctx,input.ownerMemberId,members);
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(input.requestId))throw new Error('Reload the creation form before saving.');
 const name=input.name.trim(),description=input.description.trim(),label=input.contextLabel.trim();
 if(!name||name.length>160||description.length>4000||label.length>160)throw new Error('Enter a name up to 160 characters, an objective up to 4,000 and a scope label up to 160.');
 if(!BUSINESS_LINES.includes(input.businessLine))throw new Error('Choose a business line.');
 if(!STAGES.includes(input.stage))throw new Error('Choose a lifecycle stage.');
 if(existing.some(i=>i.workspaceId===ctx.workspaceId&&i.name.trim().normalize('NFKC').toLowerCase()===name.normalize('NFKC').toLowerCase()))throw new Error('An initiative with this name already exists in this organization. Open it from Initiatives or use a distinct name.');
 const id=randomUUID(),contextId=label?randomUUID():null;
 const initiative:Initiative={id,workspaceId:ctx.workspaceId,slug:`${name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'initiative'}-${id.slice(0,8)}`,name,businessLine:input.businessLine,stage:input.stage,description:description||null,knownReferences:null,overallState:'UNKNOWN',stateSummary:null,isDemo:false,createdAt:at,updatedAt:at,createdBy:ctx.actor.id,currentContextId:contextId,archivedAt:null,archivedBy:null,archiveReason:null};
 const owner:DeliveryFact={id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId:id,kind:'OWNER',revision:1,value:{date:null,text:null,memberId:input.ownerMemberId,extent:null},state:'SET',basis:'DIRECT_KNOWLEDGE',note:'Initial owner selected during initiative creation',evidenceId:null,locator:null,supportDigest:null,confirmedByMemberId:ctx.memberId,confirmedByUserId:ctx.actor.id,confirmedByLabel:ctx.actor.label,updatedAt:at};
 const ownerEvent:DeliveryEvent={id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId:id,occurredAt:at,actor:ctx.actor,before:null,after:owner};
 const context:InitiativeContext|null=contextId?{id:contextId,workspaceId:ctx.workspaceId,initiativeId:id,label,note:null,revision:1,createdAt:at,updatedAt:at,retiredAt:null}:null;
 return {initiative,owner,ownerEvent,context};
}
