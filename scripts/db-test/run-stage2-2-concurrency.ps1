param([Parameter(Mandatory)][string]$Database,[Parameter(Mandatory)][string]$PgBin,
  [string]$HostName="127.0.0.1",[string]$Port="55432")
$ErrorActionPreference="Stop"
$psql=Join-Path $PgBin "psql.exe"
$chosen="'cccc0001-0000-4000-8000-000000000003'"
$first="set lock_timeout='5s'; begin; select public.resolve_conflict(public.stage22_test_plan('CHOSE_EXISTING',$chosen,null)); select pg_sleep(1); commit;"
$second="set lock_timeout='5s'; select public.resolve_conflict(public.stage22_test_plan('CHOSE_EXISTING',$chosen,null));"
$block={ param($p,$h,$port,$db,$sql)
  $output=& $p -X -v ON_ERROR_STOP=1 -h $h -p $port -U postgres -d $db -c $sql 2>&1
  [pscustomobject]@{ Code=$LASTEXITCODE; Output=($output -join [Environment]::NewLine) }
}
$a=Start-Job -ScriptBlock $block -ArgumentList $psql,$HostName,$Port,$Database,$first
Start-Sleep -Milliseconds 150
$b=Start-Job -ScriptBlock $block -ArgumentList $psql,$HostName,$Port,$Database,$second
@($a,$b) | Wait-Job | Out-Null
$results=@((Receive-Job $a),(Receive-Job $b))
Remove-Job $a,$b -Force
if($results[0].Code -ne 0 -or $results[1].Code -eq 0){
  throw "Double decision did not serialize: $($results | ConvertTo-Json -Compress)"
}
$audit=(& $psql -X -At -h $HostName -p $Port -U postgres -d $Database -c `
  "select count(*) from public.activity_log where event_type='FINDING_DECIDED';").Trim()
if($audit -ne '1'){throw "Double decision wrote $audit audit events"}
Write-Host "Stage 2.2 concurrent double decision passed"
