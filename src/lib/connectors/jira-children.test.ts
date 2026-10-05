import {test} from 'node:test';
import assert from 'node:assert/strict';
import {childWorkSnapshot,issueSnapshot} from './jira.ts';
import {ConnectorError} from './types.ts';
import type {ProviderCall} from './http.ts';
const site={id:'test-site',url:'https://synthetic.atlassian.example',name:'Synthetic'};
const child=(key:string,due='2026-10-01')=>({key,fields:{summary:'Synthetic child',parent:{key:'PAY-1'},status:{name:'In progress',statusCategory:{name:'In Progress'}},duedate:due,updated:'2026-09-01'}});
test('child work pagination reads every page and stable ordering avoids false changes',async()=>{
  const tokens:unknown[]=[];
  const call:ProviderCall=async(_url,init)=>{
    const body=JSON.parse(String(init?.body)); tokens.push(body.nextPageToken);
    assert.match(body.jql,/parent = "PAY-1"/);assert.ok(body.fields.includes('duedate'));
    return body.nextPageToken?{issues:[child('PAY-3')],isLast:true}:{issues:[child('PAY-2')],isLast:false,nextPageToken:'next'};
  };
  const result=await childWorkSnapshot(call,site,'PAY-1');
  assert.deepEqual(tokens,[undefined,'next']);assert.match(result,/2 child work items/);assert.match(result,/PAY-3/);
  assert.equal(result,await childWorkSnapshot(async()=>({issues:[child('PAY-3'),child('PAY-2')],isLast:true}),site,'PAY-1'));
});
test('new children and changed due dates change evidence even when the Epic timestamp stays fixed',async()=>{
  let children=[child('PAY-2')];
  const call:ProviderCall=async url=>url.includes('/issue/')?{key:'PAY-1',fields:{summary:'Synthetic epic',issuetype:{name:'Epic'},updated:'2026-09-01'}}:{issues:children,isLast:true};
  const first=await issueSnapshot(call,site,'PAY-1');
  children=[child('PAY-2','2026-11-01')];
  const moved=await issueSnapshot(call,site,'PAY-1');
  assert.equal(first.externalUpdatedAt,moved.externalUpdatedAt);assert.notEqual(first.text,moved.text);assert.match(moved.text,/Due: 2026-11-01/);
  children.push(child('PAY-3'));assert.notEqual(moved.text,(await issueSnapshot(call,site,'PAY-1')).text);
});
test('failed or incomplete child reads do not create a replacement snapshot',async()=>{
  for(const response of [{issues:[],isLast:false},{issues:[{}],isLast:true},{}]){
    await assert.rejects(()=>childWorkSnapshot(async()=>response,site,'PAY-1'),ConnectorError);
  }
  let calls=0;
  await assert.rejects(()=>childWorkSnapshot(async()=>{calls++;return {issues:[child('PAY-2')],isLast:false,nextPageToken:'repeat'};},site,'PAY-1'),ConnectorError);
  assert.equal(calls,2);
  await assert.rejects(()=>issueSnapshot(async url=>{if(url.includes('/issue/'))return {fields:{issuetype:{name:'Epic'}}};throw new ConnectorError('NO_ACCESS');},site,'PAY-1'),ConnectorError);
});
test('changes beyond the evidence text cap still change its retained fingerprint',async()=>{
  let lastDue='2026-10-01';
  const call:ProviderCall=async url=>url.includes('/issue/')?{fields:{issuetype:{name:'Epic'}}}:{issues:Array.from({length:100},(_,i)=>{const item=child(`PAY-${i+2}`,i===99?lastDue:'2026-10-01');item.fields.summary='Synthetic lengthy source description '.repeat(5);return item;}),isLast:true};
  const before=await issueSnapshot(call,site,'PAY-1');lastDue='2026-12-01';const after=await issueSnapshot(call,site,'PAY-1');
  assert.match(before.text,/Snapshot shortened/);assert.notEqual(before.text,after.text);assert.ok(after.text.length<=20000);
});
