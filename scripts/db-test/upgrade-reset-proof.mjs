/** Deploy-path Demo reset on an upgraded disposable LOCAL database: the prior generation is
 * read from the database (as the deploy will, without the operator's private file), and the
 * current generator's reset SQL is applied over it. Identities are fictional. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { makeHostedPlan, renderHostedTransaction } from '../demo/provision-hosted.mjs';
import { DEMO_CANONICAL_VERSION } from '../../src/lib/demo/canonical.ts';

const database=process.argv[2];
if(!/^prodwise_(platform_preflight|second)_[0-9a-f]{32}$/.test(database??''))throw new Error('A disposable local database is required.');
const L=v=>"'"+String(v).replaceAll("'","''")+"'";
function sql(statement){const r=spawnSync('psql',['-X','-q','-t','-A','-h','127.0.0.1','-p','55433','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-f','-'],{input:statement,encoding:'utf8',maxBuffer:32*1024*1024});
 if(r.status!==0)throw new Error('SQL refused: '+r.stderr.trim().slice(-1500));return r.stdout.trim();}
const json=s=>JSON.parse(sql(s));
const actorId=sql(`select id from public.users where platform_role='PLATFORM_OWNER' limit 1`);
const prior=json(`select jsonb_build_object('organizationId',d.organization_id,'workspaceId',d.workspace_id,'reviewerMemberId',m.id,'reviewerUserId',u.id,'authUserId',u.auth_user_id,'version',d.canonical_version,'email',u.email,'role',m.role,'platformRole',u.platform_role)
 from public.demo_scenarios d join public.organizations o on o.id=d.organization_id and o.status='ACTIVE' join public.organization_memberships m on m.organization_id=d.organization_id and m.active and m.role='ORG_OWNER' join public.users u on u.id=m.user_id and u.email='reviewer@prodwise.demo'`);
assert.equal(prior.version,DEMO_CANONICAL_VERSION,'the registered generation must carry the version the generator resets from');
const projectRef='abcdefghijklmnopqrst';
const plan=makeHostedPlan({projectRef,actorId,prior:{...prior,projectRef}});
sql(renderHostedTransaction(plan));
const fresh=json(`select public.delivery_read_workspace(${L(plan.workspaceId)}::uuid,${L(plan.reviewerMemberId)}::uuid);`);
assert.equal(fresh.source.snapshots.length,15,'the new generation holds the fifteen V3 initiatives');
assert.ok(fresh.source.snapshots.every(s=>s.initiative.workspace_id===plan.workspaceId));
assert.equal(sql(`select status from public.organizations where id=${L(prior.organizationId)}::uuid`),'ARCHIVED','the prior generation is archived, not deleted');
sql(`do $$ begin begin perform public.delivery_read_workspace(${L(prior.workspaceId)}::uuid,${L(prior.reviewerMemberId)}::uuid);raise exception 'OLD_GENERATION_ACCESS_NOT_REFUSED';
 exception when others then if sqlerrm<>'ACCESS_DENIED' then raise;end if;end;end $$;`);
assert.equal(Number(sql(`select count(*) from public.demo_scenarios d join public.organizations o on o.id=d.organization_id where o.status='ACTIVE'`)),1,'exactly one active Demo generation');
const baseline=Number(sql(`select count(*) from public.activity_log where workspace_id=${L(plan.workspaceId)}::uuid and event_type in ('READINESS_REACHED','READINESS_LOST') and (payload->>'baseline')::boolean is not true`));
assert.equal(baseline,0,'provisioning writes no visible setup-change history');
console.log('PASS: deploy-path reset from the database-registered generation: V3 generation active, prior archived and refused, no visible setup history');
