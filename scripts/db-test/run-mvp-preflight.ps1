$ErrorActionPreference = 'Stop'
$dbName = 'prodwise_mvp_final_' + (Get-Date -Format 'yyyyMMddHHmmss')
$psqlPath = Join-Path $env:LOCALAPPDATA 'ProdwiseTools/PostgreSQL/16/bin/psql.exe'
if (-not (Test-Path -LiteralPath $psqlPath)) { throw 'Existing local PostgreSQL tools are required.' }
$baseArgs = @('-X','-h','127.0.0.1','-p','55433','-U','postgres','-v','ON_ERROR_STOP=1')
function Invoke-LocalSql([string]$sqlText,[string]$database=$dbName) {
  $sqlText | & $psqlPath @baseArgs -d $database
  if ($LASTEXITCODE -ne 0) { throw "Local preflight failed in $database" }
}
function Invoke-LocalFile([string]$filePath) {
  & $psqlPath @baseArgs -d $dbName -f $filePath
  if ($LASTEXITCODE -ne 0) { throw "Local migration failed: $filePath" }
}
Invoke-LocalSql "create database $dbName;" 'postgres'
# Minimal fictional provider table tests SQL permissions/FKs, not provider transport.
Invoke-LocalSql 'create schema auth; create table auth.users(id uuid primary key,email text not null); grant usage on schema auth,public to service_role; alter default privileges in schema public grant all on tables to service_role;'
Get-ChildItem -LiteralPath 'supabase/migrations' -File | Where-Object Name -match '^000\d_' | Sort-Object Name | ForEach-Object { Invoke-LocalFile $_.FullName }
Invoke-LocalFile 'supabase/seed.sql'
Invoke-LocalFile 'supabase/migrations/0010_auth_users.sql'
Invoke-LocalFile 'supabase/migrations/0011_delivery_weekly.sql'
Invoke-LocalFile 'scripts/db-test/mvp-bootstrap-preflight.sql'
Invoke-LocalSql "select has_table_privilege('service_role','auth.users','SELECT') as direct_identity_read, has_function_privilege('authenticated','public.delivery_read_workspace(uuid,uuid)','EXECUTE') as public_delivery_access;"
Write-Output "PASS: 0001–0011 ordered replay, seeded Auth backfill and service-role Admin bootstrap/activation with immediate constraints. Local test database: $dbName"
