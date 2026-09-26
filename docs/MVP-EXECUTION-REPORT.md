# Prodwise: completed local MVP execution — 26 September 2026

The three isolated tracks are implemented and assembled on `prodwise/integration-review`. The original release checkout remains clean: both `HEAD` and `main` are `2596b72094ef6edcaf9ffd5f895d87b6043f479f`. No production deployment, hosted migration, hosted account creation, push, or synced `sources/` modification occurred.

The assembled preview is running at **http://127.0.0.1:3200**. It uses fictional private fixture accounts and persisted local data. It is a review candidate; live provider acceptance remains outstanding.

## Branches and commits

| Track | Local checkout / branch | Final track commit | Result |
|---|---|---|---|
| A: Auth + Users | `execution-2026-09-26/auth` / `prodwise/auth-users` | `7baa355973d11232134ecc9ee60841945375dae5` | Signed-in actors, mandatory authorization, invite lifecycle, Users and migration 0010 |
| B: Workspace UX | `execution-2026-09-26/ux` / `prodwise/workspace-ux` | `3cdce1dc3dcb2ca668e22601a5b9bbe77b8e42e1` | Attention-first Home, initiative identity, Knowledge ledger, paired Decisions, Analysis and navigation |
| C: Delivery + Weekly | `execution-2026-09-26/delivery` / `prodwise/delivery-weekly` | `9a894507164e59065934f6b54a76a4558e43fe24` | Fact-driven Roadmap, shared weekly review and hardened migration 0011; implementation parent `2d188539bb91f0cecea07f53e004a1cc00b31bac` |
| Assembly | `execution-2026-09-26/integration` / `prodwise/integration-review` | Final Git HEAD, also recorded in the coordinator RESULTS index | All three tracks plus real Auth adapter, account shell, Viewer presentation, delivery Home feed and acceptance evidence |

These are separate local Git checkouts. Their origins point to the preserved local release; they have not been pushed. Managed worktree creation was unavailable because this ChatGPT mirror is not a Git repository, so isolated clones were used.

## Implemented behavior

**Auth.** One configured workspace, Admin/Member/Viewer, invite-only account setup, no public signup, a last-Admin guard and an independent Product Lead capability for Admin/Member. Every protected route/API and repository operation checks current access. Mutations use the actual signed-in actor and workspace ownership. Viewer denial and environment denial have separate server guards and visible explanations. Own password change checks the existing password and revokes prior app sessions.

Opaque invitations expire after seven days, accept once, can be revoked, and are replaced on resend. The link is sufficient ownership proof; there is no second email-verification step. Admin receives a full shareable link. Email sending is explicitly unconfigured. A direct fictional Viewer account is already provisioned for local review, so the reviewer can sign in without performing invitation setup.

**Workspace.** Home leads with recorded attention and includes confirmed delivery changes. The initiative name and context stay shared across Brief, Decisions, Knowledge and Delivery. Knowledge exposes current records, confirmations, provenance and replacement history. Mobile keeps 27 and 30 beside each other before the source disclosures. Roadmap, Analysis and Weekly Review replace the old Reporting navigation; Analysis accurately states its current measurement limits.

**Delivery.** Roadmap rows derive from initiative facts, with business line, lifecycle stage, explicit scope, owner, known development/definition dates, human-confirmed Target Live and confirmed Actual Live. Unknown values remain unknown; planned and actual dates are separate. Every Target Live write has revision history from the first confirmation, including before/after, reason, source/direct-knowledge basis, confirmer and recording time. Other fact provenance is inspectable in Delivery; the Roadmap column is explicitly labelled Target confirmation.

**Weekly review.** One shared portfolio review exists per workspace/week, grouped by frozen initiative owners. PMs edit their own currently assigned and frozen sections; Admin/Lead coordinate and finalize. Sections contain changed facts, attention, decisions, target dates, next milestone and next step. Comparison uses the previous finalized snapshot, including skipped-week and late-recording explanations. It covers delivery, Knowledge/value/confirmation/support, recorded decision state, stage and initiative additions. Source statements carry references without inferred health or business impact.

Each section has its own revision to accommodate different PMs. Source changes require refresh/review; refresh preserves narrative. Finalization requires every section reviewed, current inputs and the latest previous Final. The finalized snapshot and wording are immutable; later corrections belong in a subsequent review. The SQL boundary separately checks ownership, actor/audit integrity, chronology, frozen inputs and finalization rules.

**Claude.** Existing Claude product/UX sessions supplied contract critique; Codex implemented the approved scope. The server-side Messages integration selects and organizes permitted statements with same-initiative references. Unsupported dates, health assertions, foreign references and invalid output are refused. Validated original wording, model, prompt version, input digest and time are retained; humans review and finalize. AI cannot confirm delivery truth.

## Validation

| Evidence | Result |
|---|---|
| Combined existing/Auth/Delivery unit suite | **131 passed**, zero failures; includes the synchronous guarded-repository regression found during assembly |
| Existing local decision persistence adapters | **2 passed**: audit rollback and decision re-emergence |
| TypeScript / lint / Webpack production build | **Passed** on the final assembled code |
| Integrated signed-in browser checks | **11 groups passed**, including 12 desktop/mobile route captures, real actor history, PM ownership, Lead finalization and a forged Viewer write refusal with unchanged data |
| Actual invitation/logout browser lifecycle | **4 groups passed**: Last Admin refusal, seven-day acceptance without extra verification, replacement/revoke and logout |
| Independent environment restriction browser checks | **3 groups passed**: Admin controls disabled, Viewer and environment explained separately, facts unchanged |
| Isolated UX evidence | 95 regression tests, mature Decisions browser workflow and **56 responsive route/width checks** passed |
| Real disposable PostgreSQL | Ordered 0001–0009 → seed → 0010 → 0011 replay and service-role bootstrap passed; direct `auth.users` SELECT and public Delivery RPC access remain denied |
| Auth database races | Concurrent last-Admin changes, duplicate acceptance and accept-versus-resend/revoke passed |
| Delivery SQL and independent re-probe | Invalid/fabricated Finals, another PM's review markers, forged finalizer, unreviewed Final, altered audit and stale baseline/source refused; legitimate draft/refresh/edit/final flows passed |

The SQL tests use a minimal fictional `auth.users` stand-in. They prove actual PostgreSQL grants, constraints and transactions; they do not prove Supabase Auth transport. All test changes remain in disposable local databases/files. Unit mocks do not count as a live Claude response.

Captured evidence is under `docs/validation/` and `docs/ui-review/mvp-integration/`. Independent coordinator reviews and SQL probes are also preserved one directory above the integration checkout. The early Webpack local-store refresh problem is retained in the isolated UX logs; the Auth store reread fix and integrated browser checks passed afterward. Webpack avoids the existing dependency-junction Turbopack root limitation; dependencies were not changed.

## Screenshots

See [screenshot index](ui-review/mvp-integration/README.md). It includes login, Users, Home, Knowledge, mobile paired Decisions, Roadmap, shared draft, finalized review, Target history, Viewer restrictions and the independently disabled environment.

## Local access and Claude configuration

Private fictional credentials are in ignored `integration/.data/local-access.json`. The direct reviewer email is `reviewer@prodwise.test`; its randomized password is in that private file. No password, signing secret or provider key is committed or reproduced in this report.

The ignored `integration/.env.local` now has non-empty key/model fields saved by the user, with a new workspace-scoped key. After restarting from the integration root, the actual Weekly Review successfully called `claude-sonnet-5`: HTTP 200, accepted Claude mode, six exact grounded statements with preserved source references and human-review requirements. The earlier workspace-header rejection is resolved by the replacement key. The key was not changed by the agent or requested again.

The current UI displays the accepted **Claude** result. Eight acceptance checks passed, including previous-final baseline, seven-day Target movement in the actual Claude wording, unknown dates, unchanged delivery truth and immutable Final. Fault-injected missing configuration/provider failures/invented wording continue to return templates. The request now explicitly bounds output to eight prioritized lines per section (prompt V2); the existing twelve-line validator and grounding rules remain intact. Relevant AI/domain tests (23), typecheck and targeted lint passed after this fix. See [current live-provider result](ui-review/claude-live/README.md).

The main combined test command is `npm test`; `test:mvp-db` replays into a fresh database on the owned localhost cluster. The browser scripts use the existing local Playwright/Chromium runtime. Fixture bootstrapping refuses to overwrite an existing checkout. Local Auth intentionally refuses production/hosted execution; use Next development mode for this private preview.

## Remaining acceptance and decisions

There are no further product decisions blocking this approved local implementation. The following acceptance work remains before a hosted release:

- Rehearse the accepted real Claude draft, its source references and PM/Lead human-review flow for the graduation video. The local real-provider gate has passed with the user's workspace-scoped key.
- Verify real Supabase identity creation, invitation acceptance, session/refresh/revocation and closed public-registration configuration on an approved non-production environment. Provision actual Admin and reviewer identities there only with authorization.
- Choose whether manual invitation sharing is sufficient for the graduation MVP. Automated invitation email and forgotten-password email recovery are not implemented; own password change is implemented.
- Validate provider error/rate-limit behavior and operator recovery after partial provider creation. PostgreSQL acceptance is atomic; provider creation and database acceptance cannot share one transaction.

The private local multi-file stores are a demonstration boundary. They retain a narrow membership/source-check-to-file-rename race and cannot provide a distributed snapshot. The hosted SQL transaction is the durable boundary. Support-change warnings are conservative; a warning requests human review and never automatically erases confirmed delivery truth. Analytics, Jira/meeting connectors, multiple release entities and scheduled publication remain future scope.

## Integration order and graduation story

Recommended integration order is **Auth/0010 → corrected shared shell → Delivery/0011 and Auth adapter → real-provider acceptance → final demo rehearsal → explicit production approval**. The assembled branch already covers the first three steps locally. Ship the reviewed assembly as one coherent candidate after provider acceptance; do not deploy a shell with disconnected links or a Delivery feature without Auth.

The demo should start with the PM problem: scattered records disagree and weekly updates require manual reconstruction. Show the shared initiative identity and paired 27/30 source comparison, a human-confirmed target revision feeding Roadmap, then a single portfolio review comparing the last Final. With the configured provider, show Claude organizing referenced facts, a PM reviewing their section and the Lead finalizing. Keep login brief; authentication supports access to the product, while evidence-to-review work is the central story.

The seeded portfolio, dates and selected-week comparison are synthetic local acceptance fixtures. Snapshot cutoffs are actual recording times; the selected week is a meeting label, not a fabricated historical cutoff. No synthetic health, actual launch, or AI production result is claimed.
