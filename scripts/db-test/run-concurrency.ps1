param([Parameter(Mandatory)][string]$Database,[Parameter(Mandatory)][string]$PgBin,[string]$HostName="127.0.0.1",[string]$Port="55432")
$ErrorActionPreference="Stop"
$psql=Join-Path $PgBin "psql.exe"
function Sql([string]$q) { & $psql -X -v ON_ERROR_STOP=1 -h $HostName -p $Port -U postgres -d $Database -c $q; if($LASTEXITCODE-ne 0){throw "Concurrency SQL failed"} }
Sql "update claims set status='UNVERIFIED' where id='cccc0001-0000-4000-8000-000000000008';"
$stamp=(& $psql -X -At -h $HostName -p $Port -U postgres -d $Database -c "select to_jsonb(c)->>'updated_at' from claims c where id='cccc0001-0000-4000-8000-000000000008'").Trim()
$escaped=$stamp.Replace("'","''")
$q="set lock_timeout='5s'; select (verify_claim('cccc0001-0000-4000-8000-000000000008','$escaped','DIRECT_KNOWLEDGE','Concurrent confirmation',null,'Demo mode (no signed-in user)')).id;"
$jobs=@(
  Start-Job -ScriptBlock { param($p,$h,$port,$d,$q) & $p -X -v ON_ERROR_STOP=1 -h $h -p $port -U postgres -d $d -c $q; if($LASTEXITCODE-ne 0){throw "psql failed"} } -ArgumentList $psql,$HostName,$Port,$Database,$q
  Start-Job -ScriptBlock { param($p,$h,$port,$d,$q) & $p -X -v ON_ERROR_STOP=1 -h $h -p $port -U postgres -d $d -c $q; if($LASTEXITCODE-ne 0){throw "psql failed"} } -ArgumentList $psql,$HostName,$Port,$Database,$q
)
$jobs | Wait-Job | Out-Null
$ok=0; $failed=0
foreach($job in $jobs){
  if($job.State -eq "Completed"){ $ok++ } else { $failed++ }
  Receive-Job $job -ErrorAction SilentlyContinue | Out-Host
  Remove-Job $job -Force
}
if($ok -ne 1 -or $failed -ne 1){ throw "Double verify did not serialize to exactly one success" }
Sql 'do $$ begin if (select count(*) from activity_log where event_type=''CLAIM_VERIFIED'' and entity_id=''cccc0001-0000-4000-8000-000000000008'') <> 2 then raise exception ''double verify audit count''; end if; end $$;'
Write-Host "32_verify_concurrency: double verify passed"
function Pair([string]$first,[string]$second) {
  $block={ param($p,$h,$port,$d,$q) $o=& $p -X -v ON_ERROR_STOP=1 -h $h -p $port -U postgres -d $d -c $q 2>&1; [pscustomobject]@{Code=$LASTEXITCODE;Output=($o -join [Environment]::NewLine)} }
  $a=Start-Job -ScriptBlock $block -ArgumentList $psql,$HostName,$Port,$Database,$first
  Start-Sleep -Milliseconds 200
  $b=Start-Job -ScriptBlock $block -ArgumentList $psql,$HostName,$Port,$Database,$second
  @($a,$b) | Wait-Job | Out-Null
  $result=@((Receive-Job $a),(Receive-Job $b))
  Remove-Job $a,$b -Force
  return $result
}
function VerifySql([string]$id) {
  return "set lock_timeout='5s'; select (verify_claim('$id',(select to_jsonb(c)->>'updated_at' from claims c where id='$id'),'EVIDENCE',null,null,'Demo mode (no signed-in user)')).id;"
}

$idB='dddd0001-0000-4000-8000-000000000001'
Sql "insert into claims(id,initiative_id,type,status,subject,attribute,value,domain) values('$idB','11111111-1111-4111-8111-111111111111','REQUIREMENT','DRAFT','B','A','V','PRODUCT'); insert into claim_evidence(claim_id,evidence_id) values('$idB','bbbb0001-0000-4000-8000-000000000003');"
$r=Pair "begin; $(VerifySql $idB) select pg_sleep(1); commit;" "set lock_timeout='5s'; delete from claim_evidence where claim_id='$idB';"
if($r[0].Code-ne 0-or $r[1].Code-ne 0){throw "unlink-during-verify did not serialize"}
Sql ('do $$ begin if (select jsonb_array_length(payload->''evidence'') from activity_log where entity_id=''{0}'' and event_type=''CLAIM_VERIFIED'') <> 1 then raise exception ''authorising payload changed''; end if; end $$;' -f $idB)

$idC='dddd0001-0000-4000-8000-000000000002'
Sql "insert into claims(id,initiative_id,type,status,subject,attribute,value,domain) values('$idC','11111111-1111-4111-8111-111111111111','REQUIREMENT','DRAFT','C','A','V','PRODUCT'); insert into claim_evidence(claim_id,evidence_id) values('$idC','bbbb0001-0000-4000-8000-000000000003');"
$r=Pair "begin; delete from claim_evidence where claim_id='$idC'; select pg_sleep(1); commit;" (VerifySql $idC)
if($r[0].Code-ne 0-or $r[1].Code-eq 0){throw "unlink-before-verify eligibility failed"}
Sql ('do $$ begin if (select status from claims where id=''{0}'') <> ''DRAFT'' then raise exception ''partial verify''; end if; end $$;' -f $idC)

$idD='dddd0001-0000-4000-8000-000000000003'
Sql "insert into evidence(id,initiative_id,title,source_type,boundary,captured_at) values('eeee0001-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','Concurrency evidence','DOCUMENT','CURRENT_SCOPE',now()); insert into claims(id,initiative_id,type,status,subject,attribute,value,domain) values('$idD','11111111-1111-4111-8111-111111111111','REQUIREMENT','DRAFT','D','A','V','PRODUCT'); insert into claim_evidence(claim_id,evidence_id) values('$idD','eeee0001-0000-4000-8000-000000000001');"
$r=Pair "begin; update evidence set boundary='RELATED' where id='eeee0001-0000-4000-8000-000000000001'; select pg_sleep(1); commit;" (VerifySql $idD)
if($r[0].Code-ne 0-or $r[1].Code-eq 0){throw "boundary-before-verify eligibility failed"}

$idE='dddd0001-0000-4000-8000-000000000004'
Sql "insert into claims(id,initiative_id,type,status,subject,attribute,value,domain) values('$idE','11111111-1111-4111-8111-111111111111','REQUIREMENT','DRAFT','E','A','V','PRODUCT'); insert into claim_evidence(claim_id,evidence_id) values('$idE','bbbb0001-0000-4000-8000-000000000003');"
$r=Pair "begin; $(VerifySql $idE) select pg_sleep(1); commit;" "set lock_timeout='5s'; insert into claim_evidence(claim_id,evidence_id) values('$idE','bbbb0001-0000-4000-8000-000000000002');"
if($r[0].Code-ne 0-or $r[1].Code-ne 0){throw "link-during-verify did not serialize"}
Sql ('do $$ begin if (select jsonb_array_length(payload->''evidence'') from activity_log where entity_id=''{0}'' and event_type=''CLAIM_VERIFIED'') <> 1 then raise exception ''late link entered payload''; end if; end $$;' -f $idE)

$idF='dddd0001-0000-4000-8000-000000000005'
Sql "insert into claims(id,initiative_id,type,status,subject,attribute,value,domain) values('$idF','11111111-1111-4111-8111-111111111111','REQUIREMENT','DRAFT','F','A','V','PRODUCT'); insert into claim_evidence(claim_id,evidence_id) values('$idF','bbbb0001-0000-4000-8000-000000000003');"
$r=Pair "begin; delete from claim_evidence where claim_id='$idF'; insert into claim_evidence(claim_id,evidence_id) values('$idF','bbbb0001-0000-4000-8000-000000000002'); select pg_sleep(1); commit;" (VerifySql $idF)
if(($r[0].Code-ne 0 -and $r[0].Output -notmatch '40P01') -or ($r[1].Code-ne 0 -and $r[1].Output -notmatch '40P01')){throw "relink produced an unacceptable failure"}
Sql ('do $$ begin if exists(select 1 from claims where id=''{0}'' and status=''ACTIVE'') and (select payload->''evidence''->0->>''id'' from activity_log where entity_id=''{0}'' and event_type=''CLAIM_VERIFIED'') <> ''bbbb0001-0000-4000-8000-000000000002'' then raise exception ''relink payload mismatch''; end if; end $$;' -f $idF)

$idG='dddd0001-0000-4000-8000-000000000006'
Sql "insert into claims(id,initiative_id,type,status,subject,attribute,value,domain) values('$idG','11111111-1111-4111-8111-111111111111','REQUIREMENT','DRAFT','G','A','V','PRODUCT'); insert into claim_evidence(claim_id,evidence_id) values('$idG','bbbb0001-0000-4000-8000-000000000003');"
$r=Pair "begin; set local lock_timeout='5s'; delete from claim_evidence where claim_id='$idG'; select pg_sleep(1); insert into claim_evidence(claim_id,evidence_id) values('$idG','bbbb0001-0000-4000-8000-000000000002'); commit;" (VerifySql $idG)
if($r[0].Code-ne 0 -and $r[0].Output -notmatch 'deadlock detected'){throw "deadlock-shaped relink failed unexpectedly"}
if($r[1].Code-ne 0 -and $r[1].Output -notmatch 'deadlock detected'){throw "deadlock-shaped verify failed unexpectedly"}
Sql ('do $$ begin if (select count(*) from claim_evidence where claim_id=''{0}'') <> 1 then raise exception ''half-applied relink''; end if; if exists(select 1 from claims where id=''{0}'' and status=''ACTIVE'') and (select payload->''evidence''->0->>''id'' from activity_log where entity_id=''{0}'' and event_type=''CLAIM_VERIFIED'') <> (select evidence_id::text from claim_evidence where claim_id=''{0}'') then raise exception ''deadlock payload mismatch''; end if; end $$;' -f $idG)
Write-Host "33_verify_membership_concurrency: unlink, boundary, link and relink cases passed"
