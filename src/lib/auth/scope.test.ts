import { test } from "node:test";
import assert from "node:assert/strict";
import { assertFormWorkspace } from "./scope.ts";
import type { WorkspaceAccess } from "./core.ts";
const ctx:WorkspaceAccess={workspaceId:"rendered",organizationId:"o",memberId:"m",actor:{id:"u",label:"Fictional user"},role:"MEMBER",platformRole:null,isProductLead:false};
test("old-tab and missing form scope are refused even for objectless actions",()=>{
 const form=new FormData();
 assert.throws(()=>assertFormWorkspace(form,ctx),{code:"SCOPE_CHANGED"});
 form.set("scopeWorkspaceId","rendered");assert.doesNotThrow(()=>assertFormWorkspace(form,ctx));
 assert.throws(()=>assertFormWorkspace(form,{...ctx,workspaceId:"new-scope"}),{code:"SCOPE_CHANGED"});
});
