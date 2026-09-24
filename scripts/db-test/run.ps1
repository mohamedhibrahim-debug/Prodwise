param([switch]$KeepDatabase, [switch]$WithStage22)
$ErrorActionPreference = "Stop"
$pgBin = if ($env:PRODWISE_PG_BIN) { $env:PRODWISE_PG_BIN } else { Join-Path $env:LOCALAPPDATA "ProdwiseTools\PostgreSQL\16" }
if (Test-Path (Join-Path $pgBin "bin\psql.exe")) { $pgBin = Join-Path $pgBin "bin" }
$hostName = if ($env:PRODWISE_PG_HOST) { $env:PRODWISE_PG_HOST } else { "127.0.0.1" }
$port = if ($env:PRODWISE_PG_PORT) { $env:PRODWISE_PG_PORT } else { "55432" }
$db = "prodwise_s21_$PID"
$psql = Join-Path $pgBin "psql.exe"
$createdb = Join-Path $pgBin "createdb.exe"
$dropdb = Join-Path $pgBin "dropdb.exe"
foreach ($exe in @($psql,$createdb,$dropdb)) { if (!(Test-Path $exe)) { throw "PostgreSQL executable not found: $exe" } }
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$tests = Join-Path $root "supabase\tests\stage2_1"
$migrations = Join-Path $root "supabase\migrations"
function Invoke-Psql([string]$database,[string]$file) {
  & $psql -X -v ON_ERROR_STOP=1 -h $hostName -p $port -U postgres -d $database -f $file
  if ($LASTEXITCODE -ne 0) { throw "psql failed: $file" }
}
try {
  & $createdb -h $hostName -p $port -U postgres $db
  if ($LASTEXITCODE -ne 0) { throw "Could not create $db" }
  Invoke-Psql $db (Join-Path $tests "00_roles.sql")
  Get-ChildItem $migrations -Filter "*.sql" | Where-Object Name -Match '^000[1-6]_' | Sort-Object Name | ForEach-Object { Invoke-Psql $db $_.FullName }
  # Current seed is intentionally 2.1-compatible. Strip only the explicit
  # origin field to create the true pre-migration baseline used for backfill.
  $preSeed = Join-Path $env:TEMP "prodwise-s21-preseed-$PID.sql"
  (Get-Content -Raw (Join-Path $root "supabase\seed.sql")).
    Replace(", origin,", ",").
    Replace(",'LEGACY',", ",") | Set-Content $preSeed
  Invoke-Psql $db $preSeed
  Remove-Item $preSeed -Force
  Invoke-Psql $db (Join-Path $tests "01_baseline.sql")
  Invoke-Psql $db (Join-Path $tests "02_apply_2_1.sql")
  if ($WithStage22) {
    Invoke-Psql $db (Join-Path $migrations "0008_stage2_2_origin_enum.sql")
    Invoke-Psql $db (Join-Path $migrations "0009_stage2_2_decision_truth.sql")
    Write-Host "Running Stage 2.1 regression on top of committed 0008/0009"
  }
  foreach ($name in @("10_backfill","20_constraints","30_verify_claim","31_verify_atomicity","40_reopen","41_reopen_atomicity","50_privileges","60_regression","80_fresh_seed")) {
    Invoke-Psql $db (Join-Path $tests "$name.sql")
  }
  & (Join-Path $PSScriptRoot "run-concurrency.ps1") -Database $db -PgBin $pgBin -HostName $hostName -Port $port
  if ($LASTEXITCODE -ne 0) { throw "Concurrency suite failed" }
  $rollbackDb = "${db}_rollback"
  & $createdb -h $hostName -p $port -U postgres $rollbackDb
  Invoke-Psql $rollbackDb (Join-Path $tests "00_roles.sql")
  Get-ChildItem $migrations -Filter "*.sql" | Where-Object Name -Match '^000[1-6]_' | Sort-Object Name | ForEach-Object { Invoke-Psql $rollbackDb $_.FullName }
  $rollbackDriver = Join-Path $env:TEMP "prodwise-s21-rollback-$PID.sql"
  @("begin;","\i '$((Join-Path $migrations "0007_stage2_1_trust_origin_activity.sql").Replace('\','/'))'","rollback;","\i '$((Join-Path $migrations "0007_stage2_1_trust_origin_activity.sql").Replace('\','/'))'","\i '$((Join-Path $tests "70_rollback_reapply.sql").Replace('\','/'))'") | Set-Content $rollbackDriver
  Invoke-Psql $rollbackDb $rollbackDriver
  Remove-Item $rollbackDriver -Force
  & $dropdb -h $hostName -p $port -U postgres $rollbackDb
  Write-Host "Stage 2.1 database harness passed: $db"
} finally {
  if (!$KeepDatabase) { & $dropdb --if-exists -h $hostName -p $port -U postgres $db }
}
