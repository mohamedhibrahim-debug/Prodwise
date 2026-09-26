# Final local gates — 2026-09-26

All gates below passed on the frozen local integration candidate. No deployment,
hosted migration, production business write or real provider account operation
was performed by these gates. Runtime: Node 24.20.0, npm 11.19.0.

| Gate | Exact command | Result |
| --- | --- | --- |
| Complete unit suite, including canonical Demo and provider timeout | `npm test` | 177 passed; 0 failed, skipped or cancelled |
| Scoped AI timeout/extractive suite | `node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --conditions=react-server --import ./scripts/db-test/test-alias.mjs --test src/lib/delivery/ai.test.ts` | 4 passed; mocked provider only; no network invocation |
| TypeScript | `npm run typecheck` | Exit 0; no diagnostics |
| Complete ESLint | `npm run lint` | Exit 0; no diagnostics; repeated after timeout, pending-state and final browser-script changes |
| Local Stage 2.2 decision adapter | `npm run test:stage2-2-local` | 2 passed; 0 failed, skipped or cancelled |
| Production webpack build | `npm run build -- --webpack` | Latest repeat after the provider timeout/route-budget change: exit 0; 33 app route entries compiled; static assets generated |
| Fresh PostgreSQL replay and boundaries | `./scripts/db-test/run-platform-preflight.ps1 -KeepDatabase` | Ordered 0001–0014 plus seed passed; 145 SQL assertion/refusal calls, 5 further concurrency assertions, and 2 concurrent-pair outcome checks passed |
| Actual generated Demo initial/reset SQL | `node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --conditions=react-server --import ./scripts/db-test/test-alias.mjs scripts/db-test/hosted-plan-local-proof.mjs prodwise_platform_preflight_215ec24ae39d436a84f56485a563e7b6` | Both generated transactions applied; 4 initiatives in each isolated generation; retired state retained; W38/W39 input digests match persisted source |

The `npm test` script now includes `src/lib/demo/*.test.ts`. The first sandboxed
Node test invocation was blocked at worker creation with `spawn EPERM`, before
assertions ran. The authorized local rerun with process spawning enabled passed.
The production build likewise ran with compiler workers enabled.

The latest unit/type gates follow the provider deadline change to 55 seconds and
the Weekly route's 60-second budget. A mocked deadline abort proves that timeout
returns a clearly labelled factual template containing only supported references
from the same initiative, accepts no AI wording, and preserves the frozen review
and human edits. Vercel supports the App Router `maxDuration` export; 60 seconds
is within the documented current Fluid Hobby limit. This is a configuration
check, not a hosted runtime validation. [Official Vercel duration documentation](https://vercel.com/docs/functions/configuring-functions/duration).

## Database evidence

The SQL suites contain 89 platform/organization checks, 35 Demo workspace
checks, and 21 retirement checks. Additional whole-table snapshot loops compare
all rows in nine business/history tables before and after migration and Demo
retirement; these are outside the assertion-call count above.

The proof covers real global actor binding with nullable membership IDs,
organization-scoped policy and roles, public denial, owner concurrency, same
initiative slug in separate workspaces, cross-workspace source/claim/fact FKs,
operator-only scenario registration, scoped previous Final and AI input history,
and explicit archived generation access/session retirement. Archived invitation
links cannot reactivate the retired organization. Active organizations still
require an active organization owner. New generations reuse the global reviewer
identity and retain old business rows and immutable Final snapshots.

Generated operator transactions were exercised against the actual 0014 schema,
then their persisted `delivery_source` was converted through the same camel-case
projection and `freezeInput` logic used by Delivery. Both frozen review digests
matched. This verifies SQL mapping and source equivalence, not a provider call.

All provider rows/tokens were fictional FK/email stand-ins in the owned
PostgreSQL 16 cluster at `127.0.0.1:55433`. Provider transport, live hosted schema
and real hosted identities were not checked here. Browser and live Claude
evidence are maintained separately by the integration owner.

## Logs and retained local fixtures

Bounded gate summaries and full non-secret logs are in the sibling
`execution-2026-09-26/final-local-gates/` directory: `unit.log`, `typecheck.log`,
`lint.log`, `stage2-local.log`, `build.log`, `postgres-preflight.log`, and
`generated-demo-sql.log`; `ai-timeout.log` records the new scoped regression.

The final disposable database is
`prodwise_platform_preflight_215ec24ae39d436a84f56485a563e7b6`; it was deliberately
kept. An earlier default cleanup hit Windows PostgreSQL checkpoint signaling
permissions, so the final replay used `-KeepDatabase` explicitly. No filesystem
deletion or production cleanup workaround was attempted. To repeat generated
initial/reset proof, create a fresh preflight database and pass its returned name
to the proof helper; the existing test database already contains that scenario.

Applying 0013/0014 changes no business rows and performs no retirement. A trusted
operator must review and explicitly execute a registered Demo generation plan.
0012's authorization backfill, pending invitation revocation and session
revocation remain distinct from business data; full business rows/IDs and prior
Final JSON were preserved in this fresh replay.
