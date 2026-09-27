$ErrorActionPreference='Stop'
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$pgBin=Join-Path $env:LOCALAPPDATA 'ProdwiseTools/PostgreSQL/16/bin'
$psql=Join-Path $pgBin 'psql.exe';$createdb=Join-Path $pgBin 'createdb.exe'
$dbName='prodwise_enrichment_'+[Guid]::NewGuid().ToString('N')
$conn=@('-h','127.0.0.1','-p','55433','-U','postgres')
function Sql([string]$sql){$sql|& $psql @conn -d $dbName -X -q -v ON_ERROR_STOP=1;if($LASTEXITCODE){throw 'Disposable local enrichment SQL failed.'}}
function File([string]$file){& $psql @conn -d $dbName -X -q -v ON_ERROR_STOP=1 -f (Join-Path $repoRoot $file);if($LASTEXITCODE){throw "Disposable enrichment failed: $file"}}
& $createdb @conn $dbName;if($LASTEXITCODE){throw 'Owned local PostgreSQL port55433 must be running.'}
File 'supabase/tests/stage2_1/00_roles.sql'
Sql 'create schema auth;create table auth.users(id uuid primary key,email text not null,email_confirmed_at timestamptz);grant usage on schema auth,public to service_role;'
foreach($migration in Get-ChildItem (Join-Path $repoRoot 'supabase/migrations') -File|Sort-Object Name){File ('supabase/migrations/'+$migration.Name);if($migration.Name -match '^0009_'){File 'supabase/seed.sql'}}
File '.data/enrichment-proof/initial.sql'
File '.data/enrichment-proof/before.sql'
File '.data/enrichment-proof/enrich.sql'
File '.data/enrichment-proof/after.sql'
[pscustomobject]@{Status='PASS';Database=$dbName;LocalOnly=$true;Preserved='Original IDs/business fields/timestamps/Final';Schema='0001–0019'}|ConvertTo-Json -Compress
