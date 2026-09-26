import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceAccess } from '../auth/core.ts';
import { workspaceClient } from './workspace-client.ts';
test('business RPCs bind a Platform Owner without membership to the authenticated global identity',async()=>{
 const calls:{name:string;args:Record<string,unknown>}[]=[];
 const base={rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,args});return {data:null,error:null};}} as unknown as SupabaseClient;
 const ctx:WorkspaceAccess={workspaceId:'target-workspace',organizationId:'target-organization',memberId:null,role:null,platformRole:'PLATFORM_OWNER',isProductLead:false,actor:{id:'authenticated-global-user',label:'Platform actor'}};
 await workspaceClient(base,ctx).rpc('verify_claim',{p_actor_id:'untrusted-input',p_workspace_id:'foreign-input'});
 assert.equal(calls[0]!.name,'auth_business_rpc');
 assert.equal(calls[0]!.args.p_member_id,ctx.actor.id);
 assert.equal(calls[0]!.args.p_workspace_id,ctx.workspaceId);
 await workspaceClient(base,{...ctx,memberId:'real-org-member',platformRole:null,role:'MEMBER'}).rpc('verify_claim',{});
 assert.equal(calls[1]!.args.p_member_id,'real-org-member');
});
