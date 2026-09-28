/** Generated operator SQL proof on a previously prepared disposable LOCAL DB.
 * No provider/network/configuration files are read. Identities are fictional. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { makeHostedPlan, renderHostedTransaction } from '../demo/provision-hosted.mjs';
import { canonical, freezeInput } from '../../src/lib/delivery/model.ts';

const database=process.argv[2];
if (!/^prodwise_(platform_preflight|second)_[0-9a-f]{32}$/.test(database??'')) throw new Error('A disposable local preflight database is required.');
const psql=process.env.LOCALAPPDATA?join(process.env.LOCALAPPDATA,'ProdwiseTools','PostgreSQL','16','bin','psql.exe'):'psql';
const sqlLiteral=value=>"'"+String(value).replaceAll("'","''")+"'";
function sql(statement) {
 const result=spawnSync(psql,['-X','-q','-t','-A','-h','127.0.0.1','-p','55433','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-f','-'],{input:statement,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});
 if(result.error&&!(result.error.code==='EPIPE'&&result.status))throw result.error;
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
const operatorAuth='a0000000-0000-4000-8000-000000000002';
sql(`alter table auth.users add column if not exists email_confirmed_at timestamptz;
insert into auth.users(id,email,email_confirmed_at) values(${sqlLiteral(plan.authUserId)}::uuid,'reviewer@prodwise.demo',now());
insert into auth.users(id,email,email_confirmed_at) select ${sqlLiteral(operatorAuth)}::uuid,'operator@fictional.test',now() where not exists(select 1 from public.users where platform_role='PLATFORM_OWNER');
insert into public.users(id,email,display_name,auth_user_id,active,is_system) select ${sqlLiteral(actorId)}::uuid,'operator@fictional.test','Fictional local operator',${sqlLiteral(operatorAuth)}::uuid,true,false where not exists(select 1 from public.users where platform_role='PLATFORM_OWNER');
select public.bootstrap_platform_owner(${sqlLiteral(actorId)}::uuid) where not exists(select 1 from public.users where platform_role='PLATFORM_OWNER');`);
sql(renderHostedTransaction(plan));
const read=()=>jsonSql(`select public.delivery_read_workspace(${sqlLiteral(plan.workspaceId)}::uuid,${sqlLiteral(plan.reviewerMemberId)}::uuid);`);
const initial=read();
assert.equal(initial.source.snapshots.length,15);
assert.deepEqual(initial.state.reviews.map(r=>r.week+':'+r.status).sort(),['2026-W37:FINAL','2026-W38:FINAL','2026-W39:DRAFT']);
let digestFailure=null;
// As the app reads it: the RPC projection plus the workspace's scopes.
const source={...camel(initial.source),contexts:camel(jsonSql(`select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.initiative_contexts c where workspace_id=${sqlLiteral(plan.workspaceId)}::uuid;`))};
for(const review of initial.state.reviews){
 // The open Draft must match today's records; a Final is history and must match only its own frozen records.
 const basis=review.status==='DRAFT'?source:{...review.input,contexts:source.contexts};
 const actual=freezeInput(basis,{schema:1,facts:review.input.facts,events:review.input.events,reviews:[]},plan.workspaceId,review.input.asOf);
 if(actual.digest!==review.input.digest)digestFailure=review.week+' '+(firstDifferentPath(review.input.snapshots,actual.snapshots,'snapshots')??firstDifferentPath(review.input.members,actual.members,'members')??'digest');
}
const reset=makeHostedPlan({projectRef:plan.projectRef,actorId,prior:plan});
sql(renderHostedTransaction(reset));
const retained=jsonSql(`select public.delivery_state(${sqlLiteral(plan.workspaceId)}::uuid);`);
assert.equal(canonical(retained),canonical(initial.state),'reset must preserve all old delivery facts, events, original AI and Final review snapshots');
const fresh=jsonSql(`select public.delivery_read_workspace(${sqlLiteral(reset.workspaceId)}::uuid,${sqlLiteral(reset.reviewerMemberId)}::uuid);`);
assert.equal(fresh.source.snapshots.length,15);
assert.equal(Number(sql(`select count(*) from public.organization_memberships m join public.users u on u.id=m.user_id where m.organization_id=${sqlLiteral(reset.organizationId)}::uuid and u.email like '%@example.demo' and m.active`)),7,'personas rejoin the fresh generation');
assert.ok(fresh.source.snapshots.every(snapshot=>snapshot.initiative.workspace_id===reset.workspaceId));
assert.ok(fresh.state.reviews.every(review=>review.workspaceId===reset.workspaceId));
assert.equal(jsonSql(`select jsonb_build_object('oldOrg',o.status,'oldWorkspace',w.status,'oldMemberActive',m.active,'globalRole',u.platform_role) from public.organizations o join public.workspaces w on w.organization_id=o.id join public.organization_memberships m on m.organization_id=o.id join public.users u on u.id=m.user_id where o.id=${sqlLiteral(plan.organizationId)}::uuid and m.id=${sqlLiteral(plan.reviewerMemberId)}::uuid;`).oldOrg,'ARCHIVED');
sql(`do $$ begin
 begin perform public.delivery_read_workspace(${sqlLiteral(plan.workspaceId)}::uuid,${sqlLiteral(plan.reviewerMemberId)}::uuid);raise exception 'OLD_GENERATION_ACCESS_NOT_REFUSED';
 exception when others then if sqlerrm<>'ACCESS_DENIED' then raise;end if;end;
end $$;`);
console.log('PASS: actual generated initial/reset SQL applies, reused reviewer identity, fifteen isolated initiatives per generation, personas reused, old state retained and old business access refused.');
if(digestFailure)throw new Error('GENERATED_INPUT_DIGEST_MISMATCH: first differing path '+digestFailure+'; SQL execution/reset passed but initial reviewer refresh/finalization is not equivalent to persisted source.');
console.log('PASS: the Draft matches the live database projection and each Final matches its own frozen records.');
