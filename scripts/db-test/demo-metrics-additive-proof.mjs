/** Proof for docs/ux-reconstruction/demo-metrics-additive.sql on a disposable LOCAL database.
 * Run after hosted-plan-local-proof.mjs on the same database (replay-linux.sh does this): that proof leaves one
 * ARCHIVED and one ACTIVE generation produced by the real operator SQL. Identities are fictional; no network. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { renderAdditiveSql } from '../demo/render-demo-metrics-additive.mjs';

const database = process.argv[2];
if (!/^prodwise_(platform_preflight|second)_[0-9a-f]{32}$/.test(database ?? '')) throw new Error('A disposable local preflight database is required.');
const port = process.env.PGPORT || '55433';
function run(statement) {
  const result = spawnSync('psql', ['-X', '-q', '-t', '-A', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input: statement, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return { ok: result.status === 0, out: result.stdout.trim(), err: result.stderr.trim() };
}
function sql(statement) { const r = run(statement); if (!r.ok) throw new Error('LOCAL SQL refused: ' + r.err.slice(-1500)); return r.out; }
const refused = (statement, code) => { const r = run(statement); assert.equal(r.ok, false, `expected refusal ${code}`); assert.match(r.err, new RegExp(code)); };

const { sql: additive, definitions, observations } = renderAdditiveSql();
assert.equal(readFileSync('docs/ux-reconstruction/demo-metrics-additive.sql', 'utf8'), additive, 'The committed additive SQL is stale.');

const active = JSON.parse(sql(`select jsonb_build_object('ws',w.id,'org',o.id) from public.demo_scenarios s join public.workspaces w on w.id=s.workspace_id and w.status='ACTIVE' join public.organizations o on o.id=s.organization_id and o.status='ACTIVE';`));
const archived = JSON.parse(sql(`select jsonb_build_object('ws',w.id,'org',o.id) from public.demo_scenarios s join public.workspaces w on w.id=s.workspace_id and w.status='ARCHIVED' join public.organizations o on o.id=s.organization_id limit 1;`));
const reviewer = sql(`select m.user_id from public.organization_memberships m where m.organization_id='${active.org}'::uuid and m.role='ORG_OWNER' and m.active;`);
const snapshot = () => sql(`select jsonb_build_object(
  'd',(select coalesce(jsonb_agg(to_jsonb(d)-'created_at' order by d.id),'[]') from public.metric_definitions d where d.workspace_id='${active.ws}'::uuid),
  'o',(select coalesce(jsonb_agg(to_jsonb(o) order by o.id),'[]') from public.metric_observations o where o.workspace_id='${active.ws}'::uuid))::text;`);
const counts = () => sql(`select (select count(*) from public.metric_definitions)||'/'||(select count(*) from public.metric_observations);`);

// 0. Without the entry pointer the script refuses before writing anything.
refused(additive, 'DEMO_ENTRY_CONFIG_REQUIRED');
sql(`insert into public.demo_entry_config(singleton,workspace_id,user_id,enabled) values(true,'${active.ws}'::uuid,'${reviewer}'::uuid,true);`);

// 1. A generation provisioned by the operator plan already has every row: the script is a no-op (same ids, same content).
const operatorRows = snapshot();
assert.equal(JSON.parse(operatorRows).d.length, definitions);
assert.equal(JSON.parse(operatorRows).o.length, observations);
const before = counts();
const noop = run(additive); assert.ok(noop.ok, noop.err);
assert.match(noop.err, new RegExp(`definitions inserted=0 unchanged=${definitions} observations inserted=0 unchanged=${observations}`));
assert.equal(counts(), before);

// 2. The hosted Demo as it is today (a generation without metrics): the script inserts exactly the operator's rows.
sql(`begin; delete from public.metric_observations where workspace_id='${active.ws}'::uuid; delete from public.metric_definitions where workspace_id='${active.ws}'::uuid; commit;`);
const applied = run(additive); assert.ok(applied.ok, applied.err);
assert.match(applied.err, new RegExp(`definitions inserted=${definitions} unchanged=0 observations inserted=${observations} unchanged=0`));
assert.equal(snapshot(), operatorRows, 'additive rows must equal the operator-generated rows');
assert.equal(sql(`select count(*) from public.metric_definitions where workspace_id<>'${active.ws}'::uuid and workspace_id<>'${archived.ws}'::uuid;`), '0');

// 3. Idempotent.
const again = run(additive); assert.ok(again.ok, again.err); assert.match(again.err, /definitions inserted=0/); assert.equal(snapshot(), operatorRows);

// 4. Differing content refuses the whole transaction.
sql(`update public.metric_observations set value=value+1 where workspace_id='${active.ws}'::uuid and id=(select min(id::text)::uuid from public.metric_observations where workspace_id='${active.ws}'::uuid and value is not null);`);
const tampered = snapshot();
refused(additive, 'DEMO_METRIC_CONTENT_DIFFERS');
assert.equal(snapshot(), tampered, 'a refusal writes nothing');
sql(`update public.metric_observations set value=value-1 where workspace_id='${active.ws}'::uuid and id=(select min(id::text)::uuid from public.metric_observations where workspace_id='${active.ws}'::uuid and value is not null);`);
assert.equal(snapshot(), operatorRows);

// 5. Target resolution refuses anything but exactly one ACTIVE registered Demo generation.
// Simulated state only: lifecycle triggers are bypassed in this disposable database to fake a second active generation.
sql(`set session_replication_role=replica; update public.organizations set status='ACTIVE' where id='${archived.org}'::uuid; update public.workspaces set status='ACTIVE' where id='${archived.ws}'::uuid;`);
refused(additive, 'DEMO_ACTIVE_GENERATION_NOT_UNIQUE');
sql(`set session_replication_role=replica; update public.workspaces set status='ARCHIVED' where id='${archived.ws}'::uuid; update public.organizations set status='ARCHIVED' where id='${archived.org}'::uuid;`);
sql(`update public.demo_entry_config set workspace_id='${archived.ws}'::uuid;`);
refused(additive, 'DEMO_ENTRY_NOT_REGISTERED_ACTIVE_DEMO');
sql(`update public.demo_entry_config set workspace_id='${active.ws}'::uuid; set session_replication_role=replica; update public.organizations set name='Renamed organization' where id='${active.org}'::uuid;`);
refused(additive, 'DEMO_ENTRY_NOT_REGISTERED_ACTIVE_DEMO');
sql(`set session_replication_role=replica; update public.organizations set name='Prodwise Demo' where id='${active.org}'::uuid; delete from public.demo_entry_config;`);
assert.equal(snapshot(), operatorRows);

console.log(`PASS: additive Demo metrics SQL — ${definitions} definitions / ${observations} observations equal the operator rows, idempotent, refuses differing content and any target other than the one ACTIVE registered Demo.`);
