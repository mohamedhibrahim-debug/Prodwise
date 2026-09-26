param([switch]$KeepDatabase)
$ErrorActionPreference = 'Stop'

# Only the owned, disposable localhost cluster is supported. No environment
# files, configured Supabase endpoint, provider account or application data read.
$pgBin = Join-Path $env:LOCALAPPDATA 'ProdwiseTools/PostgreSQL/16/bin'
$psqlPath = Join-Path $pgBin 'psql.exe'
$createdbPath = Join-Path $pgBin 'createdb.exe'
$dropdbPath = Join-Path $pgBin 'dropdb.exe'
foreach ($tool in @($psqlPath,$createdbPath,$dropdbPath)) {
  if (-not (Test-Path -LiteralPath $tool)) { throw 'Existing local PostgreSQL 16 tools are required.' }
}
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$dbName = 'prodwise_platform_preflight_' + ([Guid]::NewGuid().ToString('N'))
if ($dbName -notmatch '^prodwise_platform_preflight_[0-9a-f]{32}$') { throw 'Unsafe test database name.' }
$connectionArgs = @('-h','127.0.0.1','-p','55433','-U','postgres')
$psqlArgs = @('-X','-v','ON_ERROR_STOP=1','-q') + $connectionArgs
$created = $false
function Invoke-PreflightSql([string]$sqlText) {
  $sqlText | & $psqlPath @psqlArgs -d $dbName
  if ($LASTEXITCODE -ne 0) { throw 'Platform preflight SQL failed in the disposable test database.' }
}
function Invoke-PreflightFile([string]$relativePath) {
  $filePath = Join-Path $repoRoot $relativePath
  if (-not (Test-Path -LiteralPath $filePath)) { throw "Required preflight file is missing: $relativePath" }
  & $psqlPath @psqlArgs -d $dbName -f $filePath
  if ($LASTEXITCODE -ne 0) { throw "Local preflight failed: $relativePath" }
}
function Invoke-PreflightPair([string]$first,[string]$second) {
  $worker = {
    param($psql,$database,$query)
    $ErrorActionPreference = 'Continue'
    $result = & $psql -X -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 55433 -U postgres -d $database -c $query 2>&1
    [pscustomobject]@{ Code=$LASTEXITCODE; Output=($result -join [Environment]::NewLine) }
  }
  $jobs = @()
  try {
    $jobs += Start-Job -ScriptBlock $worker -ArgumentList $psqlPath,$dbName,$first
    Start-Sleep -Milliseconds 200
    $jobs += Start-Job -ScriptBlock $worker -ArgumentList $psqlPath,$dbName,$second
    $jobs | Wait-Job -Timeout 25 | Out-Null
    if (@($jobs | Where-Object State -ne 'Completed').Count) { throw 'Owned local concurrency checks timed out or failed.' }
    return @($jobs | Receive-Job)
  } finally {
    $jobs | Where-Object State -eq 'Running' | Stop-Job
    $jobs | Remove-Job -Force
  }
}
try {
  & $createdbPath @connectionArgs $dbName
  if ($LASTEXITCODE -ne 0) { throw 'Start the owned localhost PostgreSQL cluster on port 55433 before running this preflight.' }
  $created = $true
  Invoke-PreflightFile 'supabase/tests/stage2_1/00_roles.sql'
  # Minimal fictional provider FK/email table, not Supabase Auth transport.
  Invoke-PreflightSql 'create schema auth; create table auth.users(id uuid primary key,email text not null); grant usage on schema auth,public to service_role;'
  $migrationPath = Join-Path $repoRoot 'supabase/migrations'
  $legacy = @(Get-ChildItem -LiteralPath $migrationPath -File | Where-Object Name -match '^000[1-9]_' | Sort-Object Name)
  if ($legacy.Count -ne 9) { throw 'Expected the complete ordered 0001–0009 migration set.' }
  foreach ($migration in $legacy) { Invoke-PreflightFile ('supabase/migrations/' + $migration.Name) }
  Invoke-PreflightFile 'supabase/seed.sql'
  Invoke-PreflightFile 'supabase/tests/workspace-backfill-preservation-before.sql'
  Invoke-PreflightFile 'supabase/migrations/0010_auth_users.sql'
  Invoke-PreflightFile 'supabase/tests/workspace-backfill-preservation-after.sql'
  Invoke-PreflightFile 'supabase/migrations/0011_delivery_weekly.sql'
  # A deliberately historical frozen record proves 0012 preserves old roles,
  # labels and hashes. It is test-only and never used as application truth.
  Invoke-PreflightSql @'
create schema if not exists preflight;
create table preflight.historical_final as
select jsonb_build_object(
 'id','91000000-0000-4000-8000-000000000001','workspaceId','10000000-0000-4000-8000-000000000001',
 'week','2026-W38','status','FINAL','revision',1,'baselineReviewId',null,
 'input',jsonb_build_object('workspaceId','10000000-0000-4000-8000-000000000001','asOf','2026-09-19T09:00:00Z','digest','historical-preserved-test-hash',
   'snapshots','[]'::jsonb,'facts','[]'::jsonb,'events','[]'::jsonb,
   'members',jsonb_build_array(jsonb_build_object('id','92000000-0000-4000-8000-000000000001','displayName','Historical fictional manager','role','Admin'))),
 'sections','[]'::jsonb,'aiDrafts','[]'::jsonb,'createdAt','2026-09-19T09:00:00Z','createdByMemberId','92000000-0000-4000-8000-000000000001',
 'finalizedAt','2026-09-19T09:30:00Z','finalizedByMemberId','92000000-0000-4000-8000-000000000001','finalizedByLabel','Historical fictional manager'
) as data;
insert into public.weekly_reviews(id,workspace_id,iso_week,status,revision,data)
select (data->>'id')::uuid,(data->>'workspaceId')::uuid,data->>'week','FINAL',1,data from preflight.historical_final;
create table preflight.business_before(table_name text primary key,rows jsonb not null);
do $$ declare table_name text; captured jsonb; begin
 foreach table_name in array array['initiatives','initiative_sources','evidence','claims','claim_evidence','finding_states','activity_log','delivery_facts','weekly_reviews'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from public.%I t',table_name) into captured;
  insert into preflight.business_before values(table_name,captured);
 end loop;
end $$;
'@
  Invoke-PreflightFile 'supabase/migrations/0012_owner_roles.sql'
  Invoke-PreflightFile 'supabase/migrations/0013_demo_workspace_boundaries.sql'
  Invoke-PreflightFile 'supabase/migrations/0014_demo_generation_retirement.sql'
  Invoke-PreflightFile 'supabase/tests/workspace-backfill-preservation-after.sql'
  Invoke-PreflightSql @'
do $$ declare snapshot record; current_rows jsonb; begin
 for snapshot in select * from preflight.business_before loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from public.%I t',snapshot.table_name) into current_rows;
  if current_rows is distinct from snapshot.rows then raise exception 'BUSINESS_ROWS_CHANGED_BY_0012_0013: %',snapshot.table_name;end if;
 end loop;
end $$;
'@
  Invoke-PreflightFile 'supabase/tests/platform-rbac.sql'
  Invoke-PreflightFile 'supabase/tests/demo-workspace-boundaries.sql'
  Invoke-PreflightFile 'supabase/tests/demo-generation-retirement.sql'
  Invoke-PreflightFile 'supabase/tests/delivery-read-transaction-before.sql'
  Invoke-PreflightFile 'supabase/migrations/0015_delivery_read_rpc_transaction.sql'
  Invoke-PreflightFile 'supabase/tests/delivery-read-transaction-after.sql'
  # Both transactions hold the same organization lock. Only one downgrade
  # may commit; the second must see the remaining owner and roll back.
  $downgradeA = @'
begin; set local statement_timeout='15s'; set local lock_timeout='10s'; set local role service_role;
select public.platform_provision_membership(preflight.id('platform'),preflight.id('org-race'),'owner@alpha.test','MEMBER',false,'Fictional concurrent downgrade A',repeat('e',64));
select pg_sleep(1); commit;
'@
  $downgradeB = @'
begin; set local statement_timeout='15s'; set local lock_timeout='10s'; set local role service_role;
select public.platform_provision_membership(preflight.id('platform'),preflight.id('org-race'),'next-owner@alpha.test','MEMBER',false,'Fictional concurrent downgrade B',repeat('f',64));
select pg_sleep(1); commit;
'@
  $results = @(Invoke-PreflightPair $downgradeA $downgradeB)
  if (@($results | Where-Object Code -eq 0).Count -ne 1 -or @($results | Where-Object { $_.Code -ne 0 -and $_.Output -match 'LAST_ORG_OWNER' }).Count -ne 1) {
    throw ('Concurrent owner downgrades must yield one commit and one LAST_ORG_OWNER refusal: ' + ($results | ConvertTo-Json -Compress))
  }
  Invoke-PreflightSql @'
select preflight.assert((select count(*)=1 from public.organization_memberships where organization_id=preflight.id('org-race') and role='ORG_OWNER' and active),'concurrent downgrades preserve one active owner');
select preflight.assert((select count(*)=1 from public.platform_events where organization_id=preflight.id('org-race') and reason in ('Fictional concurrent downgrade A','Fictional concurrent downgrade B')),'refused downgrade rolls back audit and membership together');
'@
  $replaceA = @'
begin; set local statement_timeout='15s'; set local lock_timeout='10s'; set local role service_role;
select public.platform_replace_org_owner(preflight.id('platform'),preflight.id('org-race'),preflight.id('owner-a'),'Fictional concurrent replacement A');
select pg_sleep(1); commit;
'@
  $replaceB = @'
begin; set local statement_timeout='15s'; set local lock_timeout='10s'; set local role service_role;
select public.platform_replace_org_owner(preflight.id('platform'),preflight.id('org-race'),preflight.id('next-owner'),'Fictional concurrent replacement B');
select pg_sleep(1); commit;
'@
  $results = @(Invoke-PreflightPair $replaceA $replaceB)
  if (@($results | Where-Object Code -eq 0).Count -ne 2) { throw ('Concurrent replacements must serialize and both commit: ' + ($results | ConvertTo-Json -Compress)) }
  Invoke-PreflightSql @'
select preflight.assert((select count(*)=1 from public.organization_memberships where organization_id=preflight.id('org-race') and role='ORG_OWNER' and active),'concurrent replacement leaves exactly one owner');
select preflight.assert((select count(*)=2 from public.platform_events where organization_id=preflight.id('org-race') and actor_id=preflight.id('platform') and reason in ('Fictional concurrent replacement A','Fictional concurrent replacement B')),'each serialized replacement has actual actor audit');
select preflight.assert((select data from preflight.historical_final)=(select data from public.weekly_reviews where id='91000000-0000-4000-8000-000000000001'),'historical Final survives concurrent authority changes unchanged');
'@
  Write-Output 'PASS: simultaneous owner downgrades and atomic replacements serialize safely.'
  Write-Output "PASS: ordered 0001–0015 replay and platform/organization/demo retirement/RPC transaction preflight. Disposable local database: $dbName"
  Write-Output 'Provider identities are fictional FK/email stand-ins. Real provider transport and hosted state were not tested or changed.'
} finally {
  if ($created -and -not $KeepDatabase) {
    # Target is the exact random test name created above, never a supplied name.
    & $dropdbPath @connectionArgs $dbName
    if ($LASTEXITCODE -ne 0) { Write-Warning "Disposable test database cleanup needs operator attention: $dbName" }
  } elseif ($created) { Write-Output "Kept only the disposable preflight database: $dbName" }
}
