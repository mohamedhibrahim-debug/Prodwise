# Hosted Demo provisioning and generation reset

This operator is prepared for the integration coordinator. **Preparing the files and running the offline tests does not provision or change a hosted service.** Hosted execution requires the coordinator's approved target and the tested deployment/migration candidate.

## Why hosted reset creates a generation

A finalized Weekly Review is immutable. A hosted reset therefore creates a **new organization, workspace and ORG_OWNER membership**, reuses the same global reviewer identity and Auth provider account, and registers a new `demo_scenarios` row.

In one database transaction it archives the previous registered Demo organization/workspace using the explicit **ARCHIVED** status from migration 0014, deactivates only that generation's reviewer membership, and expires only the previous Demo workspace's reviewer sessions. It does **not** delete or rewrite prior initiatives, Knowledge, sources, delivery facts, events or Final reviews. Ordinary product access to the archived generation is refused by the server authorization layer. The reviewer next signs into the sole remaining active Demo generation.

No AMAN identity, membership, session, organization policy or business record is targeted.

## Required existing infrastructure

- The intended Supabase project, with migrations **0001–0014** applied and a persisted active Platform Owner.
- The existing Supabase Auth service key.
- An existing trusted operator PostgreSQL connection, able to write the operator-only `demo_scenarios` table. The service key alone cannot register a Demo.
- The installed PostgreSQL `psql` client. No new library or paid infrastructure is installed.
- TLS certificate verification for the PostgreSQL endpoint. The operator sets `PGSSLMODE=verify-full`; use the existing trusted CA configuration if the platform requires `PGSSLROOTCERT`.

Private operator environment:

| Variable | Purpose |
|---|---|
| `PRODWISE_EXPECTED_SUPABASE_REF` | Exact 20-character expected project reference |
| `SUPABASE_URL` | Matching HTTPS project origin |
| `PRODWISE_DATABASE_URL` | Private PostgreSQL connection string |
| `SUPABASE_SERVICE_ROLE_KEY` | Existing Auth administration credential |
| `PRODWISE_PLATFORM_ACTOR_ID` | Persisted active Platform Owner's global user UUID |
| `PRODWISE_PSQL_PATH` | Optional installed `psql` executable path |

Use private environment configuration; never paste secrets into a command, chat or repository file. The database password goes to the child process environment, not command arguments. Diagnostics stay under ignored `.data/`, with configured credential values redacted.

The Supabase URL must match the pinned project exactly. A direct DB host must be `db.<project-ref>.supabase.co`. A supported Supabase pooler host must have the project-specific `postgres.<project-ref>` username. Other target combinations fail closed.

## Prepare and review

Run from the integration root using the existing TypeScript test loader:

```text
node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --conditions=react-server --import ./scripts/db-test/test-alias.mjs scripts/demo/provision-hosted.mjs --self-test
node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --conditions=react-server --import ./scripts/db-test/test-alias.mjs scripts/demo/provision-hosted.mjs --dry-run --initial
```

The dry run performs **no network or database calls**. It creates ignored private files:

- `.data/demo-hosted-plan.json`: pinned target, actor and explicit generation IDs.
- `.data/demo-hosted-plan.sql`: exact reviewable transaction bundle.

Inspect the SQL and the public target metadata before applying. The bundle contains synthetic scenario records and no password, API key or service key. The apply path regenerates the bundle and refuses if it differs from the reviewed file.

Dry run checks the planned target shape; it does not claim that the live target, schema or actor has been verified. Those checks are repeated against the actual database immediately before writes.

## Initial apply — coordinator only

```text
node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --conditions=react-server --import ./scripts/db-test/test-alias.mjs scripts/demo/provision-hosted.mjs --apply --initial
```

Execution order:

1. Verify target binding, schema/ARCHIVED support, persisted Platform Owner, unused new generation IDs, and absence of a conflicting global/provider reviewer identity.
2. Save the private plan/transaction backup and recovery registration.
3. Pre-create the provider account with a random private password and confirmed email. This is the approved direct reviewer access path, not public signup. Existing credentials are never changed.
4. Execute one transaction to insert the global identity mapping, organization, workspace, ORG_OWNER membership, exact-email policy, Demo registration, synthetic product records, delivery history and W38/W39 reviews.
5. Store the private active registration at `.data/demo-hosted-access.json`. Output only public operation status.

The reviewer is `reviewer@prodwise.demo`, has **no PLATFORM_OWNER** role and has no real-organization membership. Policy is `domains: []` with only that exact email allowed.

## Hosted reset — coordinator only

```text
node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --conditions=react-server --import ./scripts/db-test/test-alias.mjs scripts/demo/provision-hosted.mjs --dry-run --reset
node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --conditions=react-server --import ./scripts/db-test/test-alias.mjs scripts/demo/provision-hosted.mjs --apply --reset
```

The active private registration is mandatory. The database must still contain the matching `demo_scenarios` registration, canonical version and scenario date. The reviewer must still be the active ORG_OWNER with null global role and no policy override. The registered generation must have exactly its expected workspace and reviewer membership; unexpected members or workspaces are refused.

A reviewer may have inactive memberships in **previous archived, registered Demo generations only**. Any membership in AMAN, another real organization, or another active generation causes refusal. No ordinary organization is archived based on its name or reviewer email.

Reset reuses the provider identity and password. The fresh generation restores the canonical 27-versus-30 scenario, explicit supersession, 1→8 October target movement, frozen W38 prepared baseline and unreviewed W39 Draft. All old generations remain stored.

## Recovery and verification limits

Auth provider creation and the PostgreSQL transaction are different systems. If provider creation succeeds and the database transaction fails, the operator retains `.data/demo-hosted-pending.json` and the private backup. It does not delete the provider user or reset its password. Retry the same unchanged plan after correcting the database issue. If the database commit succeeds but writing the local completion registration fails, reconcile the persisted generated IDs with the private pending plan before any further apply; do not create a replacement identity.

A pending apply blocks preparation of another plan. Preserve these private recovery files. Provider and database errors do not print secret values.

After apply, the integration coordinator must verify actual reviewer sign-in, active Demo selection, foreign-organization denial, canonical source/delivery projection, real Claude drafting and finalization on the hosted candidate. Until those checks pass, operator preparation alone is not evidence that production is ready.

## Offline validation

`--self-test` runs five gate groups without contacting a provider or database:

1. Exact HTTPS/database project binding, including wrong target and pooler-user refusals.
2. Initial generation shape, operator-only registration and fixture provenance.
3. Reset retains the global identity while requiring fresh organization/workspace/membership IDs.
4. Generated reset SQL contains no business deletion, truncation or updates to prior product/Final tables; only access retirement and new generation inserts.
5. Platform-role, mismatched-project, reused-generation and modified-role plan refusals.

Database replay and provider execution are separate acceptance gates and must be reported separately.

## Local SQL replay result

**PASS:** the exact generated initial and reset transactions were replayed against a disposable localhost PostgreSQL database with migrations 0001–0014 and fictional Auth-provider stand-ins. Each generation contains four isolated initiatives. Reset reused the global reviewer, denied ordinary access to the archived generation, and retained the entire previous delivery facts/events/review JSON state unchanged.

Both W38 and W39 frozen input digests match the actual SQL `delivery_source` projection after camel-case normalization and the application's `freezeInput` calculation. This checks the operator's database field mapping and avoids inventing a compatible source shape.

Reproducible local proof: `scripts/db-test/hosted-plan-local-proof.mjs`, maintained by the database test track. This was **not** hosted execution and did not exercise the real Supabase Auth provider. Production target binding, provider account creation, hosted reviewer login and live Claude remain integration-coordinator gates.
