#!/usr/bin/env bash
# Production upgrade rehearsal on a disposable LOCAL database (Linux).
#  1. Build the database exactly as the production branch (origin/main) does:
#     its migrations, its seed, and its generated hosted Demo (initial + one reset,
#     leaving an archived and an active generation, as production has).
#  2. Apply this branch's pending migrations on top of that data.
#  3. Run this branch's hosted Demo reset against the registered generation, as
#     the deploy will, and prove nothing outside the Demo changed.
# No provider, network or production data is used; every identity is fictional.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
HOST=127.0.0.1; PORT=55433; BASE="${BASE_REF:-origin/main}"
PSQL=(psql -X -q -h "$HOST" -p "$PORT" -U postgres -v ON_ERROR_STOP=1)
DB="prodwise_platform_preflight_$(head -c16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
WT="$(mktemp -d /tmp/prodwise-upgrade-XXXXXX)"
cleanup(){ git worktree remove --force "$WT" >/dev/null 2>&1 || true; }
trap cleanup EXIT
git worktree add --detach "$WT" "$BASE" >/dev/null 2>&1
ln -s "$ROOT/node_modules" "$WT/node_modules"
"${PSQL[@]}" -d postgres -c "create database $DB;" >/dev/null
"${PSQL[@]}" -d "$DB" -c "create schema auth; create table auth.users(id uuid primary key,email text not null,email_confirmed_at timestamptz); grant usage on schema auth,public to service_role;" >/dev/null
BASE_MIGRATIONS=$(ls "$WT/supabase/migrations" | sort)
for f in $(echo "$BASE_MIGRATIONS" | grep -E '^000[0-9]_'); do "${PSQL[@]}" -d "$DB" -f "$WT/supabase/migrations/$f" >/dev/null; done
"${PSQL[@]}" -d "$DB" -f "$WT/supabase/seed.sql" >/dev/null
for f in $(echo "$BASE_MIGRATIONS" | grep -vE '^000[0-9]_'); do "${PSQL[@]}" -d "$DB" -f "$WT/supabase/migrations/$f" >/dev/null; done
echo "PASS: $BASE schema ($(echo "$BASE_MIGRATIONS" | wc -l) migrations) and seed"
# The base proof assumes a platform owner exists (its Windows runner never created one); add the same fictional operator the current proof uses.
"${PSQL[@]}" -d "$DB" -c "insert into auth.users(id,email) values('a0000000-0000-4000-8000-000000000002','operator@fictional.test');
insert into public.users(id,email,display_name,auth_user_id,active,is_system) values('a0000000-0000-4000-8000-000000000001','operator@fictional.test','Fictional local operator','a0000000-0000-4000-8000-000000000002',true,false);
select public.bootstrap_platform_owner('a0000000-0000-4000-8000-000000000001'::uuid);" >/dev/null
# The base proof is Windows-oriented; point it at Linux psql inside the throwaway worktree only.
sed -i "s#^const psql=.*#const psql='psql';#" "$WT/scripts/db-test/hosted-plan-local-proof.mjs"
( cd "$WT" && node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=ExperimentalWarning --import ./scripts/db-test/test-alias.mjs scripts/db-test/hosted-plan-local-proof.mjs "$DB" ) | sed 's/^/  base: /'
echo "PASS: $BASE hosted Demo provisioned (archived + active generation)"
# Every non-Demo product row as it exists before the upgrade (the data production actually holds).
"${PSQL[@]}" -d "$DB" -c "create schema rehearsal; create table rehearsal.before as
 select 'initiatives' t, x.id, to_jsonb(x) j from public.initiatives x where not exists(select 1 from public.demo_scenarios d where d.workspace_id=x.workspace_id)
 union all select 'claims', x.id, to_jsonb(x) from public.claims x where not exists(select 1 from public.demo_scenarios d where d.workspace_id=x.workspace_id)
 union all select 'evidence', x.id, to_jsonb(x) from public.evidence x where not exists(select 1 from public.demo_scenarios d where d.workspace_id=x.workspace_id)
 union all select 'delivery_facts', x.id, to_jsonb(x) from public.delivery_facts x where not exists(select 1 from public.demo_scenarios d where d.workspace_id=x.workspace_id)
 union all select 'activity_log', x.id, to_jsonb(x) from public.activity_log x where not exists(select 1 from public.demo_scenarios d where d.workspace_id=x.workspace_id)
 union all select 'users', x.id, to_jsonb(x) from public.users x where not exists(select 1 from public.organization_memberships m join public.demo_scenarios d on d.organization_id=m.organization_id where m.user_id=x.id)
 union all select 'organization_memberships', x.id, to_jsonb(x) from public.organization_memberships x where not exists(select 1 from public.demo_scenarios d where d.organization_id=x.organization_id);" >/dev/null
PENDING=$(comm -13 <(echo "$BASE_MIGRATIONS") <(ls supabase/migrations | sort))
for f in $PENDING; do "${PSQL[@]}" -d "$DB" -f "supabase/migrations/$f" >/dev/null; done
echo "PASS: applied $(echo "$PENDING" | wc -l) pending migrations over existing data: $(echo $PENDING | tr ' ' ',' | cut -c1-80)…"
node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=ExperimentalWarning --import ./scripts/db-test/test-alias.mjs scripts/db-test/upgrade-reset-proof.mjs "$DB"
CHANGED=$("${PSQL[@]}" -d "$DB" -At -c "select count(*) from rehearsal.before b where not exists(select 1 from (
 select 'initiatives' t,id,to_jsonb(x) j from public.initiatives x union all select 'claims',id,to_jsonb(x) from public.claims x union all select 'evidence',id,to_jsonb(x) from public.evidence x
 union all select 'delivery_facts',id,to_jsonb(x) from public.delivery_facts x union all select 'activity_log',id,to_jsonb(x) from public.activity_log x union all select 'users',id,to_jsonb(x) from public.users x
 union all select 'organization_memberships',id,to_jsonb(x) from public.organization_memberships x) a where a.t=b.t and a.id=b.id and b.j <@ a.j)")
TOTAL=$("${PSQL[@]}" -d "$DB" -At -c "select count(*)||' rows in '||count(distinct t)||' tables' from rehearsal.before")
if [ "$CHANGED" != "0" ]; then echo "FAIL: $CHANGED pre-existing rows changed or vanished across upgrade + Demo reset"; "${PSQL[@]}" -d "$DB" -At -c "select t, count(*) from rehearsal.before b group by t"; exit 1; fi
echo "PASS: all $TOTAL existing before the upgrade are intact afterwards (every old field unchanged; only new columns added)"
echo "DB=$DB"
