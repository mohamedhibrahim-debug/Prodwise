import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadFiles, assertUploadOwner, boundedUploadBytes } from './upload-model.ts';
test('upload manifests bound aggregate bytes/count and never use filenames as storage paths',()=>{
  assert.equal(uploadFiles([{name:'../../original.csv',size:6231359}],'w','id')[0]!.path,'w/id/0');
  for(const value of [[],Array(13).fill({name:'a.csv',size:1}),[{name:'a.xlsx',size:25000001}],[{name:'x.exe',size:1}],[{name:'a.csv',size:1.1}],[{name:'a.csv',size:0}]])
    assert.throws(()=>uploadFiles(value,'w','id'));
  assert.throws(()=>uploadFiles([{name:'a.csv',size:13000000},{name:'b.csv',size:13000000}],'w','id'));
});
test('upload tickets bind user, workspace, organization, expiry and closed state',()=>{
  const scope={workspaceId:'w',organizationId:'o',actor:{id:'u'}};
  const ticket={workspace_id:'w',organization_id:'o',user_id:'u',closed:false,expires_at:'2027-01-01'};
  assert.doesNotThrow(()=>assertUploadOwner(ticket,scope,0));
  for(const change of [{workspace_id:'other'},{organization_id:'other'},{user_id:'other'},{closed:true},{expires_at:'invalid'},{expires_at:'1969-01-01'}])
    assert.throws(()=>assertUploadOwner({...ticket,...change},scope,0));
  assert.throws(()=>assertUploadOwner(null,scope));
});
test('download verifies actual streamed bytes, not just content length',async()=>{
  assert.deepEqual(await boundedUploadBytes(new Response(new Uint8Array([1,2,3])),3),new Uint8Array([1,2,3]));
  await assert.rejects(()=>boundedUploadBytes(new Response('longer',{headers:{'content-length':'1'}}),1),/size/);
  await assert.rejects(()=>boundedUploadBytes(new Response('x'),3),/incomplete/);
  await assert.rejects(()=>boundedUploadBytes(new Response(null,{status:404}),3),/unavailable/);
});
