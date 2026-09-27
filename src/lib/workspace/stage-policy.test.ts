import { test } from "node:test";
import assert from "node:assert/strict";
import { validateStageUpdate, type StageUpdate } from "./stage-policy.ts";
import type { WorkspaceAccess } from "../auth/core.ts";
const ctx:WorkspaceAccess={workspaceId:"w",organizationId:"o",memberId:"m",actor:{id:"u",label:"Fictional PM"},role:"MEMBER",platformRole:null,isProductLead:false};
const row={workspaceId:"w",updatedAt:"2026-09-27T10:00:00Z"};
const input:StageUpdate={initiativeId:"i",stage:"VALIDATION",scopeWorkspaceId:"w",expectedUpdatedAt:row.updatedAt,reason:"Human confirmed the UAT start."};
test("canonical stage requires assigned PM or real administration, never review-coordinator privilege alone",()=>{
  assert.doesNotThrow(()=>validateStageUpdate(ctx,input,row,"m"));
  assert.throws(()=>validateStageUpdate({...ctx,isProductLead:true},input,row,"other"),{code:"STAGE_ACCESS"});
  assert.throws(()=>validateStageUpdate({...ctx,role:"VIEWER"},input,row,"m"),{code:"STAGE_ACCESS"});
  assert.doesNotThrow(()=>validateStageUpdate({...ctx,role:"ADMIN"},input,row,null));
  assert.doesNotThrow(()=>validateStageUpdate({...ctx,role:null,memberId:null,platformRole:"PLATFORM_OWNER"},input,row,null));
});
test("stage rejects stale scope, missing confirmation and stale truth",()=>{
  assert.throws(()=>validateStageUpdate(ctx,{...input,scopeWorkspaceId:"other"},row,"m"),{code:"SCOPE_CHANGED"});
  assert.throws(()=>validateStageUpdate(ctx,input,{...row,workspaceId:"other"},"m"),{code:"SCOPE_CHANGED"});
  assert.throws(()=>validateStageUpdate(ctx,{...input,reason:"  "},row,"m"),{code:"STAGE_REASON"});
  assert.throws(()=>validateStageUpdate(ctx,{...input,expectedUpdatedAt:"old"},row,"m"),{code:"STALE_INITIATIVE"});
});
