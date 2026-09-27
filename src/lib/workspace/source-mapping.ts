import {randomUUID} from 'node:crypto';
import type {WorkspaceAccess} from '../auth/core.ts';
import {canManageInitiative} from './management-policy.ts';

export const SOURCE_PROVIDERS=['JIRA','DOCUMENT','EMAIL','MEETING_NOTES','PASTED_EVIDENCE','OTHER_URL'] as const;
export const SOURCE_ROLES=['REQUIREMENTS','DELIVERY','DECISIONS','GENERAL'] as const;
export type SourceProvider=typeof SOURCE_PROVIDERS[number];
export type SourceRole=typeof SOURCE_ROLES[number];
export interface SourceContainer {id:string;workspaceId:string;provider:SourceProvider;providerWorkspace:string;reference:string;name:string;createdBy:string;createdAt:string;}
export interface SourceItem {id:string;workspaceId:string;containerId:string;reference:string;name:string;kind:string;url:string|null;createdBy:string;createdAt:string;}
export interface SourceMapping {id:string;workspaceId:string;initiativeId:string;itemId:string;role:SourceRole;revision:number;linkedBy:string;linkedAt:string;unlinkedBy:string|null;unlinkedAt:string|null;unlinkReason:string|null;}
export interface MappingEvent {id:string;workspaceId:string;initiativeId:string;mappingId:string;actorId:string;actorLabel:string;at:string;before:SourceMapping|null;after:SourceMapping;}
export interface SourceLibrary {containers:SourceContainer[];items:SourceItem[];mappings:SourceMapping[];events:MappingEvent[];}
export const EMPTY_LIBRARY:SourceLibrary={containers:[],items:[],mappings:[],events:[]};
export function normalizeReference(text:string):string{return text.trim().normalize('NFKC').toLowerCase();}
export interface SourceMapInput {initiativeId:string;provider:SourceProvider;providerWorkspace:string;containerReference:string;containerName:string;role:SourceRole;items:{reference:string;name:string;kind:string;url:string|null}[];}
function required(value:string,max:number,label:string):string{const v=value.trim();if(!v||v.length>max)throw new Error(`${label} is required (up to ${max} characters).`);return v;}

/** References are syntax-checked locally, never claimed to exist in an external system. */
export function mapSourceItems(library:SourceLibrary,ctx:WorkspaceAccess,input:SourceMapInput,now:string):SourceLibrary{
  if(!canManageInitiative(ctx,'SOURCE_LINK',null))throw new Error('Your role cannot link sources.');
  if(!SOURCE_PROVIDERS.includes(input.provider)||!SOURCE_ROLES.includes(input.role))throw new Error('Choose a source type and role.');
  const providerWorkspace=required(input.providerWorkspace,300,'Source workspace');
  const containerReference=required(input.containerReference,300,'Workspace / container reference');
  const containerName=required(input.containerName,200,'Source name');
  if(input.provider==='JIRA'&&!/^[A-Za-z][A-Za-z0-9_]*$/.test(containerReference))throw new Error('Use a valid Jira project key.');
  if(input.items.length<1||input.items.length>25)throw new Error('Map between 1 and 25 items at a time.');
  const normalized=input.items.map(item=>{
    const reference=required(item.reference,500,'Item reference');
    const name=required(item.name,200,'Item name');
    const kind=required(item.kind,50,'Item kind');
    if(input.provider==='JIRA'&&!new RegExp(`^${containerReference.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}-[1-9][0-9]*$`,'i').test(reference))throw new Error(`${reference} does not match the key format for project ${containerReference}.`);
    if(item.url){try{const url=new URL(item.url);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error();}catch{throw new Error('Use an http or https link without embedded credentials.');}}
    return {reference,name,kind,url:item.url?.trim()||null};
  });
  if(new Set(normalized.map(i=>normalizeReference(i.reference))).size!==normalized.length)throw new Error('Remove duplicate references from this selection.');
  const next=structuredClone(library);
  let container=next.containers.find(c=>c.workspaceId===ctx.workspaceId&&c.provider===input.provider&&normalizeReference(c.providerWorkspace)===normalizeReference(providerWorkspace)&&normalizeReference(c.reference)===normalizeReference(containerReference));
  if(!container){container={id:randomUUID(),workspaceId:ctx.workspaceId,provider:input.provider,providerWorkspace,reference:containerReference,name:containerName,createdBy:ctx.actor.id,createdAt:now};next.containers.push(container);}
  for(const item of normalized){
    let record=next.items.find(i=>i.workspaceId===ctx.workspaceId&&i.containerId===container!.id&&normalizeReference(i.reference)===normalizeReference(item.reference));
    if(!record){record={id:randomUUID(),workspaceId:ctx.workspaceId,containerId:container.id,...item,createdBy:ctx.actor.id,createdAt:now};next.items.push(record);}
    const existing=next.mappings.find(m=>m.workspaceId===ctx.workspaceId&&m.initiativeId===input.initiativeId&&m.itemId===record!.id);
    if(existing){if(existing.unlinkedAt)throw new Error('This source was previously unlinked. Review its history and explicitly relink it.');continue;}
    const mapping:SourceMapping={id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId:input.initiativeId,itemId:record.id,role:input.role,revision:1,linkedBy:ctx.actor.id,linkedAt:now,unlinkedBy:null,unlinkedAt:null,unlinkReason:null};
    next.mappings.push(mapping);next.events.push({id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId:input.initiativeId,mappingId:mapping.id,actorId:ctx.actor.id,actorLabel:ctx.actor.label,at:now,before:null,after:structuredClone(mapping)});
  }
  return next;
}

export interface SourceRevisionInput {mappingId:string;initiativeId:string;expectedRevision:number;action:'UNLINK'|'RELINK'|'ROLE';role?:SourceRole;reason:string}
export function reviseSourceMapping(library:SourceLibrary,ctx:WorkspaceAccess,input:SourceRevisionInput,ownerMemberId:string|null,now:string):SourceLibrary{
  if(!['UNLINK','RELINK','ROLE'].includes(input.action))throw new Error('Choose a supported mapping change.');
  const before=library.mappings.find(m=>m.id===input.mappingId&&m.workspaceId===ctx.workspaceId&&m.initiativeId===input.initiativeId);
  if(!before)throw new Error('This mapping is unavailable in your organization.');
  if(!canManageInitiative(ctx,input.action==='UNLINK'?'SOURCE_UNLINK':'SOURCE_LINK',ownerMemberId,before.linkedBy))throw new Error('Your role cannot change this mapping.');
  if(before.revision!==input.expectedRevision)throw new Error('This source mapping changed. Reload and review before saving.');
  const reason=required(input.reason,2000,'Reason');
  if(input.action==='ROLE'&&(!input.role||!SOURCE_ROLES.includes(input.role)))throw new Error('Choose a source role.');
  if(input.action!=='RELINK'&&before.unlinkedAt)throw new Error('This source is already unlinked.');
  if(input.action==='RELINK'&&!before.unlinkedAt)throw new Error('This source is already linked.');
  const after:SourceMapping={...before,revision:before.revision+1,...(input.action==='UNLINK'?{unlinkedAt:now,unlinkedBy:ctx.actor.id,unlinkReason:reason}:input.action==='RELINK'?{linkedAt:now,linkedBy:ctx.actor.id,unlinkedAt:null,unlinkedBy:null,unlinkReason:null}:{role:input.role!})};
  return {...library,mappings:library.mappings.map(m=>m.id===before.id?after:m),events:[...library.events,{id:randomUUID(),workspaceId:ctx.workspaceId,initiativeId:input.initiativeId,mappingId:before.id,actorId:ctx.actor.id,actorLabel:ctx.actor.label,at:now,before:structuredClone(before),after:structuredClone(after)}]};
}
