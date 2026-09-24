#Requires -Version 7.0
param([string]$Port = "55432")
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$pgBin = if ($env:PRODWISE_PG_BIN) { $env:PRODWISE_PG_BIN } else { Join-Path $env:LOCALAPPDATA "ProdwiseTools\PostgreSQL\16\bin" }
if (Test-Path (Join-Path $pgBin "bin\psql.exe")) { $pgBin = Join-Path $pgBin "bin" }
$cluster = Join-Path ([IO.Path]::GetTempPath()) ("prodwise-stage22-gate-" + [guid]::NewGuid().ToString("N"))
$oldHost = $env:PRODWISE_PG_HOST
$oldPort = $env:PRODWISE_PG_PORT
$oldBin = $env:PRODWISE_PG_BIN
$started = $false
function NpmGate([string[]]$Arguments) {
  & npm.cmd @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Gate failed: npm $Arguments" }
}
Push-Location $root
try {
  $env:PRODWISE_PG_HOST = "127.0.0.1"
  $env:PRODWISE_PG_PORT = $Port
  $env:PRODWISE_PG_BIN = $pgBin
  NpmGate @("test") # Includes the exact MFF golden fingerprint assertion.
  NpmGate @("run", "test:stage2-2-local")
  & (Join-Path $pgBin "initdb.exe") -D $cluster -U postgres -A trust -E UTF8 --no-instructions
  if ($LASTEXITCODE -ne 0) { throw "Local cluster initialization failed" }
  & (Join-Path $pgBin "pg_ctl.exe") -D $cluster -o "-p $Port -h 127.0.0.1" -l (Join-Path $cluster "server.log") -w start
  if ($LASTEXITCODE -ne 0) { throw "Local cluster startup failed" }
  $started = $true
  & (Join-Path $PSScriptRoot "run-stage2-2.ps1") # Includes both decision races and rollback/reapply.
  & (Join-Path $PSScriptRoot "run.ps1") -WithStage22 # Mandatory, never an optional final-gate step.
  NpmGate @("run", "typecheck")
  NpmGate @("run", "lint")
  NpmGate @("run", "build")
  NpmGate @("run", "test:stage2-2-ui")
  Write-Host "STAGE 2.2 FINAL GATE PASSED (local only)"
} finally {
  if ($started) {
    & (Join-Path $pgBin "pg_ctl.exe") -D $cluster -m fast -w stop
    if ($LASTEXITCODE -ne 0) { throw "Could not stop local test cluster: $cluster" }
  }
  if (Test-Path -LiteralPath $cluster) {
    $resolvedCluster = (Resolve-Path -LiteralPath $cluster).Path
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (!$resolvedCluster.StartsWith($tempRoot) -or [IO.Path]::GetFileName($resolvedCluster) -notmatch '^prodwise-stage22-gate-[a-f0-9]{32}$') {
      throw "Unexpected cleanup path: $resolvedCluster"
    }
    Remove-Item -LiteralPath $resolvedCluster -Recurse -Force
  }
  $env:PRODWISE_PG_HOST = $oldHost
  $env:PRODWISE_PG_PORT = $oldPort
  $env:PRODWISE_PG_BIN = $oldBin
  Pop-Location
}
