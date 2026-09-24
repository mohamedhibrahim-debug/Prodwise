param([switch]$KeepDatabase)
$ErrorActionPreference = "Stop"
$pgBin = if ($env:PRODWISE_PG_BIN) { $env:PRODWISE_PG_BIN } else { Join-Path $env:LOCALAPPDATA "ProdwiseTools\PostgreSQL\16\bin" }
if (Test-Path (Join-Path $pgBin "bin\psql.exe")) { $pgBin = Join-Path $pgBin "bin" }
$hostName = if ($env:PRODWISE_PG_HOST) { $env:PRODWISE_PG_HOST } else { "127.0.0.1" }
$port = if ($env:PRODWISE_PG_PORT) { $env:PRODWISE_PG_PORT } else { "55432" }
$db = "prodwise_s22_$PID"
$rollbackDb = "${db}_rollback"
$raceDb = "${db}_note_race"
$psql = Join-Path $pgBin "psql.exe"
$createdb = Join-Path $pgBin "createdb.exe"
$dropdb = Join-Path $pgBin "dropdb.exe"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
function SqlFile([string]$database,[string]$file) {
  & $psql -X -v ON_ERROR_STOP=1 -h $hostName -p $port -U postgres -d $database -f $file | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "SQL failed: $file" }
}
try {
  & $createdb -h $hostName -p $port -U postgres $db
  if ($LASTEXITCODE -ne 0) { throw "Could not create $db" }
  SqlFile $db (Join-Path $root "supabase\tests\stage2_1\00_roles.sql")
  Get-ChildItem (Join-Path $root "supabase\migrations") -Filter "*.sql" |
    Sort-Object Name | ForEach-Object { SqlFile $db $_.FullName }
  SqlFile $db (Join-Path $root "supabase\seed.sql")
  $tests = Join-Path $root "supabase\tests\stage2_2"
  foreach ($name in @("00_helpers","10_choose_27","20_outcomes","30_confirmer_cycles","40_guards","50_atomicity","60_privileges")) {
    SqlFile $db (Join-Path $tests "$name.sql")
    Write-Host "Stage 2.2 $name passed"
  }
  & $createdb -h $hostName -p $port -U postgres -T $db $raceDb
  if ($LASTEXITCODE -ne 0) { throw "Could not create $raceDb" }
  & (Join-Path $PSScriptRoot "run-stage2-2-note-race.ps1") -Database $raceDb `
    -PgBin $pgBin -HostName $hostName -Port $port
  & (Join-Path $PSScriptRoot "run-stage2-2-concurrency.ps1") -Database $db `
    -PgBin $pgBin -HostName $hostName -Port $port
  if ($LASTEXITCODE -ne 0) { throw "Stage 2.2 concurrency failed" }
  & $createdb -h $hostName -p $port -U postgres $rollbackDb
  if ($LASTEXITCODE -ne 0) { throw "Could not create $rollbackDb" }
  SqlFile $rollbackDb (Join-Path $root "supabase\tests\stage2_1\00_roles.sql")
  $migrations = Join-Path $root "supabase\migrations"
  Get-ChildItem $migrations -Filter "*.sql" | Where-Object Name -Match '^000[1-7]_' |
    Sort-Object Name | ForEach-Object { SqlFile $rollbackDb $_.FullName }
  SqlFile $rollbackDb (Join-Path $root "supabase\seed.sql")
  & $psql -X -v ON_ERROR_STOP=1 -h $hostName -p $port -U postgres -d $rollbackDb `
    -c "begin; alter type public.claim_origin add value 'HUMAN_DECISION'; rollback;" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "0008 rollback failed" }
  SqlFile $rollbackDb (Join-Path $migrations "0008_stage2_2_origin_enum.sql")
  & $psql -X -v ON_ERROR_STOP=1 -h $hostName -p $port -U postgres -d $rollbackDb `
    -c "begin" -f (Join-Path $migrations "0009_stage2_2_decision_truth.sql") `
    -c "rollback" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "0009 rollback failed" }
  SqlFile $rollbackDb (Join-Path $migrations "0009_stage2_2_decision_truth.sql")
  SqlFile $rollbackDb (Join-Path $root "supabase\rollback\0009_stage2_2_decision_truth.sql")
  SqlFile $rollbackDb (Join-Path $tests "70_rollback.sql")
  SqlFile $rollbackDb (Join-Path $root "supabase\tests\stage2_1\40_reopen.sql")
  SqlFile $rollbackDb (Join-Path $migrations "0008_stage2_2_origin_enum.sql")
  SqlFile $rollbackDb (Join-Path $migrations "0009_stage2_2_decision_truth.sql")
  SqlFile $rollbackDb (Join-Path $tests "10_choose_27.sql")
  Write-Host "Stage 2.2 rollback/reapply passed"
  Write-Host "Stage 2.2 database harness passed: $db"
} finally {
  if (!$KeepDatabase) { & $dropdb --if-exists -h $hostName -p $port -U postgres $db }
  if (!$KeepDatabase) { & $dropdb --if-exists -h $hostName -p $port -U postgres $rollbackDb }
  if (!$KeepDatabase) { & $dropdb --if-exists -h $hostName -p $port -U postgres $raceDb }
}
