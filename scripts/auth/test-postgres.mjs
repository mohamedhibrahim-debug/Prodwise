import { spawnSync, spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
// This harness can only target the disposable local cluster, never hosted DBs.
const psql=join(process.env.LOCALAPPDATA,'ProdwiseTools/PostgreSQL/16/bin/psql.exe');
const db=`prodwise_auth_test_${Date.now()}`;
const args=['-X','-h','127.0.0.1','-p','55433','-U','postgres','-v','ON_ERROR_STOP=1'];
function query(sql,database=db){const result=spawnSync(psql,[...args,'-d',database,'-A','-t'],{input:sql,encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr||result.error?.message);return result.stdout.trim();}
function concurrent(sql){return new Promise(resolveResult=>{const child=spawn(psql,[...args,'-d',db,'-A','-t'],{stdio:['pipe','pipe','pipe']});let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);child.on('error',error=>resolveResult({status:1,output:error.message}));child.on('close',status=>resolveResult({status,output}));child.stdin.end(sql);});}
const w='10000000-0000-4000-8000-000000000001';
query(`create database ${db};`,'postgres');
try {
  query(`create schema auth; create table auth.users(id uuid primary key,email text not null);
    grant usage on schema auth to service_role;`);
  const migrations=readdirSync(resolve('supabase/migrations')).filter(x=>/^000\d_/.test(x)).sort();
  for(const file of migrations)query(readFileSync(resolve('supabase/migrations',file),'utf8'));
  query(readFileSync(resolve('supabase/seed.sql'),'utf8'));
  query(readFileSync(resolve('supabase/migrations/0010_auth_users.sql'),'utf8'));
  assert.equal(query("select has_table_privilege('service_role','auth.users','SELECT');"),'f');
  query(`insert into auth.users values('20000000-0000-4000-8000-000000000001','admin1@prodwise.test'),('20000000-0000-4000-8000-000000000002','admin2@prodwise.test');
    begin;set local role service_role;
    select public.bootstrap_workspace_admin('${w}','admin1@prodwise.test',repeat('a',64));
    select public.accept_workspace_invitation('${w}',repeat('a',64),'20000000-0000-4000-8000-000000000001','Admin One');
    set constraints all immediate;commit;`);
  const a1=query(`select id from public.memberships where workspace_id='${w}' and role='Admin';`);
  query(`set role service_role;select public.manage_workspace_invitation('${w}','${a1}','INVITE',null,'admin2@prodwise.test','Admin',repeat('b',64));
    select public.accept_workspace_invitation('${w}',repeat('b',64),'20000000-0000-4000-8000-000000000002','Admin Two');`);
  const a2=query(`select m.id from public.memberships m join public.users u on u.id=m.user_id where u.email='admin2@prodwise.test';`);
  const demotions=await Promise.all([concurrent(`begin;set local role service_role;select public.change_workspace_membership('${w}','${a1}','${a1}','Member',true,false);select pg_sleep(.2);commit;`),
    concurrent(`begin;set local role service_role;select public.change_workspace_membership('${w}','${a2}','${a2}','Member',true,false);commit;`)]);
  assert.equal(demotions.filter(x=>x.status===0).length,1);assert.ok(demotions.some(x=>x.output.includes('LAST_ADMIN')));
  assert.equal(query(`select count(*) from public.memberships where workspace_id='${w}' and role='Admin' and active;`),'1');
  const admin=query(`select id from public.memberships where workspace_id='${w}' and role='Admin' and active;`);
  query(`insert into auth.users values('20000000-0000-4000-8000-000000000003','race@prodwise.test');set role service_role;
    select public.manage_workspace_invitation('${w}','${admin}','INVITE',null,'race@prodwise.test','Viewer',repeat('c',64));`);
  const accepts=await Promise.all([concurrent(`set role service_role;select public.accept_workspace_invitation('${w}',repeat('c',64),'20000000-0000-4000-8000-000000000003','Race One');`),
    concurrent(`set role service_role;select public.accept_workspace_invitation('${w}',repeat('c',64),'20000000-0000-4000-8000-000000000003','Race Two');`)]);
  assert.equal(accepts.filter(x=>x.status===0).length,1);assert.ok(accepts.some(x=>x.output.includes('INVITE_INVALID')));
  const viewer=query(`select m.id from public.memberships m join public.users u on u.id=m.user_id where u.email='race@prodwise.test';`);
  query(`set role service_role;do $$ begin
    begin perform public.change_workspace_membership('${w}','${viewer}','${admin}','Viewer',true,false);raise exception 'VIEWER_MANAGEMENT_ALLOWED';exception when others then if sqlerrm<>'ADMIN_REQUIRED' then raise;end if;end;
    begin perform public.require_workspace_member('${w}','${viewer}',false,true);raise exception 'VIEWER_WRITE_ALLOWED';exception when others then if sqlerrm<>'VIEW_ONLY' then raise;end if;end;
    begin perform public.require_workspace_member('10000000-0000-4000-8000-000000000099','${admin}',false,false);raise exception 'CROSS_WORKSPACE_ALLOWED';exception when others then if sqlerrm<>'ACCESS_DENIED' then raise;end if;end;
    begin perform public.change_workspace_membership('${w}','${admin}','${viewer}','Viewer',true,true);raise exception 'VIEWER_LEAD_ALLOWED';exception when others then if sqlerrm<>'VIEWER_CANNOT_LEAD' then raise;end if;end;
  end $$;`);
  // The first transaction holds the workspace lock. Acceptance runs concurrently
  // and must observe the committed revoke/resend state before consuming a token.
  for(const [kind,char,nextChar,idSuffix] of [['REVOKE','d','e','4'],['RESEND','f','g','5']]){
    const email=`${kind.toLowerCase()}@prodwise.test`,identity=`20000000-0000-4000-8000-00000000000${idSuffix}`;
    query(`insert into auth.users values('${identity}','${email}');set role service_role;
      select public.manage_workspace_invitation('${w}','${admin}','INVITE',null,'${email}','Member',repeat('${char}',64));`);
    const iid=query(`select id from public.workspace_invitations where email='${email}';`);
    const rotate=concurrent(`begin;set local role service_role;select public.manage_workspace_invitation('${w}','${admin}','${kind}','${iid}',null,null,repeat('${nextChar}',64));select pg_sleep(.4);commit;`);
    await new Promise(r=>setTimeout(r,100));
    const accept=concurrent(`set role service_role;select public.accept_workspace_invitation('${w}',repeat('${char}',64),'${identity}','Race Member');`);
    const results=await Promise.all([rotate,accept]);assert.equal(results[0].status,0,results[0].output);assert.notEqual(results[1].status,0);assert.ok(results[1].output.includes('INVITE_INVALID'));
    assert.equal(query(`select count(*) from public.users where email='${email}';`),'0');
    if(kind==='RESEND')query(`set role service_role;select public.accept_workspace_invitation('${w}',repeat('${nextChar}',64),'${identity}','Resent Member');`);
  }
  query(`set role authenticated;do $$ begin
    begin perform public.accept_workspace_invitation('${w}',repeat('x',64),'20000000-0000-4000-8000-000000000001','Intruder');raise exception 'PUBLIC_ACCEPT_ALLOWED';exception when insufficient_privilege then null;end;
    begin perform count(*) from public.workspace_sessions;raise exception 'PUBLIC_SESSIONS_ALLOWED';exception when insufficient_privilege then null;end;
  end $$;`);
  console.log('PASS: migrations 0001–0010 + seeded backfill; restricted service_role bootstrap; concurrent last Admin demotions; duplicate acceptance; accept/revoke and accept/resend races; Viewer management/write/lead denial; cross-workspace denial; public session/RPC denial.');
  console.log(`Disposable local PostgreSQL database retained for inspection: ${db}`);
}catch(error){console.error(`FAILED (local database retained): ${db}`);throw error;}
