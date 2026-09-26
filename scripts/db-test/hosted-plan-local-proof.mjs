/** Generated operator SQL proof on a previously prepared disposable LOCAL DB.
 * No provider/network/configuration files are read. Identities are fictional. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { makeHostedPlan, renderHostedTransaction } from '../demo/provision-hosted.mjs';
import { canonical, freezeInput } from '../../src/lib/delivery/model.ts';

const database=process.argv[2];
if (!/^prodwise_platform_preflight_[0-9a-f]{32}$/.test(database??'')) throw new Error('A disposable local preflight database is required.');
const psql=join(process.env.LOCALAPPDATA,'ProdwiseTools','PostgreSQL','16','bin','psql.exe');
const sqlLiteral=value=>"'"+String(value).replaceAll("'","''")+"'";
function sql(statement) {
 const result=spawnSync(psql,['-X','-q','-t','-A','-h','127.0.0.1','-p','55433','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-f','-'],{input:statement,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error('Generated LOCAL SQL refused: '+result.stderr.trim().slice(-1800));
 return result.stdout.trim();
}
function jsonSql(statement){return JSON.parse(sql(statement));}
function camel(value){if(Array.isArray(value))return value.map(camel);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key.replace(/_([a-z])/g,(_,letter)=>letter.toUpperCase()),camel(item)]));return value;}
function firstDifferentPath(left,right,path='input') {
 if(canonical(left)===canonical(right))return null;
 if(left&&right&&typeof left==='object'&&typeof right==='object') {
  for(const key of [...new Set([...Object.keys(left),...Object.keys(right)])].sort()){const found=firstDifferentPath(left[key],right[key],path+'.'+key);if(found)return found;}
 }
 return path;
}
const actorId='a0000000-0000-4000-8000-000000000001';
const plan=makeHostedPlan({projectRef:'abcdefghijklmnopqrst',actorId});
sql(`alter table auth.users add column if not exists email_confirmed_at timestamptz;
insert into auth.users(id,email,email_confirmed_at) values(${sqlLiteral(plan.authUserId)}::uuid,'reviewer@prodwise.demo',now());`);
sql(renderHostedTransaction(plan));
const read=()=>jsonSql(`select public.delivery_read_workspace(${sqlLiteral(plan.workspaceId)}::uuid,${sqlLiteral(plan.reviewerMemberId)}::uuid);`);
const initial=read();
assert.equal(initial.source.snapshots.length,4);
assert.equal(initial.state.reviews.length,2);
let digestFailure=null;
const source=camel(initial.source);
for(const review of initial.state.reviews){
 const actual=freezeInput(source,{schema:1,facts:review.input.facts,events:review.input.events,reviews:[]},plan.workspaceId,review.input.asOf);
 if(actual.digest!==review.input.digest)digestFailure=firstDifferentPath(review.input.snapshots,actual.snapshots,'snapshots')??firstDifferentPath(review.input.members,actual.members,'members')??'digest';
}
const reset=makeHostedPlan({projectRef:plan.projectRef,actorId,prior:plan});
sql(renderHostedTransaction(reset));
const retained=jsonSql(`select public.delivery_state(${sqlLiteral(plan.workspaceId)}::uuid);`);
assert.equal(canonical(retained),canonical(initial.state),'reset must preserve all old delivery facts, events, original AI and Final review snapshots');
const fresh=jsonSql(`select public.delivery_read_workspace(${sqlLiteral(reset.workspaceId)}::uuid,${sqlLiteral(reset.reviewerMemberId)}::uuid);`);
assert.equal(fresh.source.snapshots.length,4);
assert.ok(fresh.source.snapshots.every(snapshot=>snapshot.initiative.workspace_id===reset.workspaceId));
assert.ok(fresh.state.reviews.every(review=>review.workspaceId===reset.workspaceId));
assert.equal(jsonSql(`select jsonb_build_object('oldOrg',o.status,'oldWorkspace',w.status,'oldMemberActive',m.active,'globalRole',u.platform_role) from public.organizations o join public.workspaces w on w.organization_id=o.id join public.organization_memberships m on m.organization_id=o.id join public.users u on u.id=m.user_id where o.id=${sqlLiteral(plan.organizationId)}::uuid;`).oldOrg,'ARCHIVED');
sql(`do $$ begin
 begin perform public.delivery_read_workspace(${sqlLiteral(plan.workspaceId)}::uuid,${sqlLiteral(plan.reviewerMemberId)}::uuid);raise exception 'OLD_GENERATION_ACCESS_NOT_REFUSED';
 exception when others then if sqlerrm<>'ACCESS_DENIED' then raise;end if;end;
end $$;`);
console.log('PASS: actual generated initial/reset SQL applies, reused reviewer identity, four isolated initiatives per generation, old state retained and old business access refused.');
if(digestFailure)throw new Error('GENERATED_INPUT_DIGEST_MISMATCH: first differing path '+digestFailure+'; SQL execution/reset passed but initial reviewer refresh/finalization is not equivalent to persisted source.');
console.log('PASS: both frozen Weekly inputs match the actual database source projection digest.');
