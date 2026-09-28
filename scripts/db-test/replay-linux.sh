#!/usr/bin/env bash
# Disposable local replay of every migration plus the fictional Demo org and
# the second-mission SQL proofs. Targets only a local throwaway cluster
# (PGHOST/PGPORT, default 127.0.0.1:55433); it refuses any other host.
# Usage: scripts/db-test/replay-linux.sh [test.sql ...]   (default: all second-mission tests)
set -euo pipefail
cd "$(dirname "$0")/../.."
HOST=${PGHOST:-127.0.0.1}; PORT=${PGPORT:-55433}
case "$HOST" in 127.0.0.1|localhost) ;; *) echo "Refusing non-local host $HOST" >&2; exit 2;; esac
DB="prodwise_second_$(head -c16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
PSQL=(psql -X -q -h "$HOST" -p "$PORT" -U postgres -v ON_ERROR_STOP=1)
"${PSQL[@]}" -d postgres -c "create database $DB;" >/dev/null
"${PSQL[@]}" -d "$DB" -c "create schema auth; create table auth.users(id uuid primary key,email text not null,email_confirmed_at timestamptz); grant usage on schema auth,public to service_role;" >/dev/null
for f in $(ls supabase/migrations | grep -E '^000[0-9]_' | sort); do "${PSQL[@]}" -d "$DB" -f "supabase/migrations/$f" >/dev/null; done
"${PSQL[@]}" -d "$DB" -f supabase/seed.sql >/dev/null
for f in $(ls supabase/migrations | grep -vE '^000[0-9]_' | sort); do "${PSQL[@]}" -d "$DB" -f "supabase/migrations/$f" >/dev/null; done
echo "PASS: fresh replay of $(ls supabase/migrations | wc -l) migrations into $DB"
node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/db-test/test-alias.mjs scripts/db-test/prepare-enrichment-proof.mjs >/dev/null
"${PSQL[@]}" -d "$DB" -f .data/enrichment-proof/initial.sql >/dev/null
echo "PASS: fictional Demo organization provisioned"
TESTS=("$@"); if [ ${#TESTS[@]} -eq 0 ]; then TESTS=(supabase/tests/second-mission-*.sql); fi
for t in "${TESTS[@]}"; do
  if out=$("${PSQL[@]}" -d "$DB" -f "$t" 2>&1); then echo "PASS: $t"; else echo "FAIL: $t"; echo "$out" | tail -5; FAILED=1; fi
done
# The generated hosted operator SQL (initial generation + reset) on its own fresh database.
if [ ${#TESTS[@]} -eq 0 ] || [ -z "${1:-}" ]; then
  PDB="prodwise_second_$(head -c16 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  "${PSQL[@]}" -d postgres -c "create database $PDB;" >/dev/null
  "${PSQL[@]}" -d "$PDB" -c "create schema auth; create table auth.users(id uuid primary key,email text not null,email_confirmed_at timestamptz); grant usage on schema auth,public to service_role;" >/dev/null
  for f in $(ls supabase/migrations | grep -E '^000[0-9]_' | sort); do "${PSQL[@]}" -d "$PDB" -f "supabase/migrations/$f" >/dev/null 2>&1; done
  "${PSQL[@]}" -d "$PDB" -f supabase/seed.sql >/dev/null
  for f in $(ls supabase/migrations | grep -vE '^000[0-9]_' | sort); do "${PSQL[@]}" -d "$PDB" -f "supabase/migrations/$f" >/dev/null 2>&1; done
  if node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=ExperimentalWarning --import ./scripts/db-test/test-alias.mjs scripts/db-test/hosted-plan-local-proof.mjs "$PDB"; then :; else echo "FAIL: hosted operator plan proof"; FAILED=1; fi
fi
echo "DB=$DB"
exit ${FAILED:-0}
