import 'server-only';
import {cache} from 'react';
import {requireWorkspaceAccess} from '@/lib/auth/access';
import {adminClient,isLocalAuth} from '@/lib/auth/service';
import {withRepositoryContext} from '@/lib/auth/repository-context';
import type {InitiativeContext} from '@/lib/workspace/readiness';
import type {SourceContainer,SourceItem,SourceMapping} from '@/lib/workspace/source-mapping';
import {readStore} from './store';
export interface ManagementRead {contexts:InitiativeContext[];containers:SourceContainer[];items:SourceItem[];mappings:SourceMapping[];}
function camel(value:unknown):unknown{if(Array.isArray(value))return value.map(camel);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k.replace(/_([a-z])/g,(_,c:string)=>c.toUpperCase()),camel(v)]));return value;}
export const readManagement=cache(async():Promise<ManagementRead>=>{
 const ctx=await requireWorkspaceAccess();
 if(isLocalAuth())return withRepositoryContext(ctx,async()=>{const s=readStore();return {contexts:s.contexts??[],containers:s.sourceContainers??[],items:s.sourceItems??[],mappings:s.sourceMappings??[]};});
 const {data,error}=await adminClient().rpc('read_initiative_management',{p_workspace_id:ctx.workspaceId,p_member_id:ctx.memberId??ctx.actor.id});
 if(error)throw new Error('Initiative management storage is unavailable. The local candidate migrations must be installed before this surface is tested.');
 return camel(data) as ManagementRead;
});
