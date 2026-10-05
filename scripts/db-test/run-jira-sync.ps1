# Uses only a fresh loopback test cluster. Never reads hosted database credentials.
param([int]$Port = 55438)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$pgBin = Join-Path $env:LOCALAPPDATA 'ProdwiseTools\PostgreSQL\16\bin'
if (!(Test-Path -LiteralPath (Join-Path $pgBin 'psql.exe'))) { throw 'Existing PostgreSQL 16 tools are required.' }
$cluster = Join-Path ([IO.Path]::GetTempPath()) ('prodwise-jira-sync-' + [guid]::NewGuid().ToString('N'))
$dbName = 'prodwise_sync_' + [guid]::NewGuid().ToString('N')
$started = $false
$connection = @('-X','-w','-q','-h','127.0.0.1','-p',"$Port",'-U','postgres','-v','ON_ERROR_STOP=1')
function Sql([string]$text,[string]$database=$dbName) {
  $text | & (Join-Path $pgBin 'psql.exe') @connection -d $database
  if ($LASTEXITCODE) { throw 'Local SQL assertion failed.' }
}
function File([string]$path) {
  & (Join-Path $pgBin 'psql.exe') @connection -d $dbName -f $path
  if ($LASTEXITCODE) { throw "Local SQL failed: $path" }
}
Push-Location $root
try {
  & (Join-Path $pgBin 'initdb.exe') -D $cluster -U postgres -A trust -E UTF8 --no-instructions | Out-Null
  if ($LASTEXITCODE) { throw 'Could not initialize disposable cluster.' }
  & (Join-Path $pgBin 'pg_ctl.exe') -D $cluster -o "-p $Port -h 127.0.0.1" -l (Join-Path $cluster 'server.log') -w start
  if ($LASTEXITCODE) { throw 'Could not start disposable cluster.' }
  $started = $true
  Sql "create role anon; create role authenticated; create role service_role bypassrls;" 'postgres'
  Sql "create database $dbName;" 'postgres'
  Sql 'create schema auth; create table auth.users(id uuid primary key,email text not null,email_confirmed_at timestamptz); grant usage on schema auth,public to service_role;'
  $migrations = Get-ChildItem -LiteralPath 'supabase/migrations' -File | Sort-Object Name
  $migrations | Where-Object Name -match '^000\d_' | ForEach-Object { File $_.FullName }
  File 'supabase/seed.sql'
  $migrations | Where-Object Name -notmatch '^000\d_' | ForEach-Object { File $_.FullName }
  File 'supabase/tests/jira-sync.sql'
  Write-Output "PASS: all $($migrations.Count) migrations plus Jira sync SQL assertions. Database: $dbName"
} finally {
  if ($started) { & (Join-Path $pgBin 'pg_ctl.exe') -D $cluster -m fast -w stop; if ($LASTEXITCODE) { throw "Could not stop owned test cluster: $cluster" } }
  if (Test-Path -LiteralPath $cluster) {
    $resolved = (Resolve-Path -LiteralPath $cluster).Path
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (!$resolved.StartsWith($tempRoot) -or [IO.Path]::GetFileName($resolved) -notmatch '^prodwise-jira-sync-[a-f0-9]{32}$') { throw 'Unexpected test cleanup path.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
  Pop-Location
}
