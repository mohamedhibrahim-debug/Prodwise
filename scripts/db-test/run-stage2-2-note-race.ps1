param([Parameter(Mandatory)][string]$Database,[Parameter(Mandatory)][string]$PgBin,
  [string]$HostName="127.0.0.1",[string]$Port="55432")
$ErrorActionPreference="Stop"
$psql=Join-Path $PgBin "psql.exe"
function Query([string]$sql) {
  $result=& $psql -X -At -v ON_ERROR_STOP=1 -h $HostName -p $Port -U postgres -d $Database -c $sql
  if ($LASTEXITCODE -ne 0) { throw "Race assertion query failed" }
  return ($result -join "`n").Trim()
}
function AwaitState([string]$predicate) {
  $deadline=(Get-Date).AddSeconds(15)
  do {
    if ((Query "select exists(select 1 from pg_stat_activity where datname=current_database() and $predicate);") -eq 't') { return }
    Start-Sleep -Milliseconds 50
  } while ((Get-Date) -lt $deadline)
  throw "Race did not reach required synchronization point: $predicate"
}
$null=Query 'create table public.note_race_snapshot(decision jsonb, knowledge jsonb);'
$first=@'
set application_name='s22_note_decision';
set statement_timeout='25s';
begin;
select public.resolve_conflict(public.stage22_test_plan('CHOSE_EXISTING','cccc0001-0000-4000-8000-000000000003',null));
insert into public.note_race_snapshot
select to_jsonb(f), (select jsonb_agg(to_jsonb(c) order by c.id) from public.claims c)
from public.finding_states f where fingerprint='f2f628a25ea8bcf38ef8db92896bbcc1f61b20e159c3d7635ed85c98dd84f5ca';
select pg_sleep(10);
commit;
'@
$second=@'
set application_name='s22_note_writer';
set statement_timeout='20s';
select public.set_finding_note('11111111-1111-4111-8111-111111111111',
 'f2f628a25ea8bcf38ef8db92896bbcc1f61b20e159c3d7635ed85c98dd84f5ca',
 '{"ruleId":"CONFLICT_SAME_ATTRIBUTE_V1","contentDigest":"stale-note-digest","subject":"Overwritten subject","attribute":"Overwritten attribute","phase":"Overwritten phase","valuesRecorded":"Overwritten values","resolution":"Overwritten rationale"}'::jsonb);
'@
$block={param($p,$h,$port,$db,$sql)
  $output=& $p -X -v ON_ERROR_STOP=1 -h $h -p $port -U postgres -d $db -c $sql 2>&1
  [pscustomobject]@{Code=$LASTEXITCODE;Output=($output -join [Environment]::NewLine)}
}
$jobs=@()
try {
  $a=Start-Job -ScriptBlock $block -ArgumentList $psql,$HostName,$Port,$Database,$first
  $jobs+=$a
  AwaitState "application_name='s22_note_decision' and wait_event='PgSleep'"
  $b=Start-Job -ScriptBlock $block -ArgumentList $psql,$HostName,$Port,$Database,$second
  $jobs+=$b
  # B's lookup misses A's uncommitted row and its upsert waits on A's transaction.
  AwaitState "application_name='s22_note_writer' and wait_event_type='Lock'"
  $jobs | Wait-Job -Timeout 30 | Out-Null
  $results=@((Receive-Job $a),(Receive-Job $b))
  if ($results[0].Code -ne 0 -or $results[1].Code -eq 0 -or
      $results[1].Output -notmatch 'ERROR:\s+DECISION_IMMUTABLE(?:\r?\n|$)') {
    throw "Note race failed: $($results | ConvertTo-Json -Compress)"
  }
  $assert=@'
select (select count(*) from public.note_race_snapshot)=1
 and (select to_jsonb(f) from public.finding_states f
      where fingerprint='f2f628a25ea8bcf38ef8db92896bbcc1f61b20e159c3d7635ed85c98dd84f5ca')
     = (select decision from public.note_race_snapshot)
 and (select jsonb_agg(to_jsonb(c) order by c.id) from public.claims c)
     = (select knowledge from public.note_race_snapshot)
 and (select count(*) from public.activity_log where event_type='FINDING_DECIDED')=1
 and (select count(*) from public.activity_log where event_type='FINDING_RESOLVED')=0;
'@
  if ((Query $assert) -ne 't') { throw 'Refused note changed decision, Knowledge, or audit' }
  Write-Host 'Stage 2.2 note/decision race passed: DECISION_IMMUTABLE; decision and Knowledge identical; audit 1/0'
} finally {
  $jobs | Stop-Job
  $jobs | Remove-Job -Force
}
