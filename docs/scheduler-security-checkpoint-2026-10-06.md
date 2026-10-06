# Scheduler security checkpoint (2026-10-06)

- User explicitly approved atomic pg_net recreation after verifying empty queues
  and inactive jobs. Migration prodwise_scheduler_extension_schema succeeded.
- Verified pg_net extension metadata now belongs to extensions, not public.
- Both prodwise-reporting-cleanup and prodwise-jira-sync remain inactive.
- IMPORTANT: REVOKE commands did not remove effective privileges. Catalog checks
  show net objects owned by supabase_admin, with PUBLIC grants still effective.
  anon/authenticated have schema USAGE, function EXECUTE, and SELECT on both
  net.http_request_queue and net._http_response. Previous claims that browser
  role privileges were closed were incorrect; do not rely on command success.
- anon/authenticated cannot SELECT vault.decrypted_secrets. No scheduled HTTP
  request has been dispatched and no Vault secret has been placed in the queue.
- Do not activate these jobs until supported privilege hardening or a reviewed
  alternative is available. Do not elevate roles, alter managed security hooks,
  expose net through the Data API, or print credentials to bypass this blocker.
- Vercel Preview 9hZy7w1uuWDmMEj2VWL6skFfTrkj is Ready for commit 1980d92.
  Production alias has not been promoted. Large hosted upload, cleanup and Jira
  runtime verification remain outstanding.
- Encrypted local backup integrity and isolated public/auth restore passed.

Reference: https://supabase.com/docs/guides/database/postgres/roles-superuser

## Follow-up: supported API isolation verified

The initial privilege finding alone does not demonstrate client exposure. The
official pg_net Permissions section documents PUBLIC grants, isolation from the
Data API, and NOLOGIN client roles as the managed-platform security boundary:
https://supabase.com/docs/guides/database/extensions/pg_net#permissions

Read-only checks on this project confirmed:
- anon and authenticated both have rolcanlogin=false.
- No public function is executable by either client role. The only callable
  function across public/graphql_public is the platform-owned invoker graphql.
- No public/graphql_public view definition references net, vault or cron.
- Requests using the existing publishable key and Accept-Profile net, vault,
  and cron each returned HTTP 406 / PGRST106 (Invalid schema).
- GraphQL returned no query fields and reported pg_graphql is not enabled.

No permissions, API exposure settings, credentials or platform hooks were
weakened to obtain these results. Retain this isolation; audit it before future
RPC/schema changes. The jobs remain inactive pending hosted endpoint tests.
The earlier blanket scheduler blocker is superseded by this verified isolation
assessment, not by a claim that the platform-owned grants were revoked.

## Staged deployment

- User approved temporarily disabling Vercel Auto-assign Custom Production
  Domains; setting was saved Disabled. Restore after successful promotion.
- Production-environment redeploy CEhkBA8zq1uL9zehtJTJ6BLeLpUM is Ready/Staged,
  commit 1980d92, URL https://prodwise-nnpgk0ina-e-payments.vercel.app.
  Dashboard explicitly reports Assigning Custom Domains Skipped.
- Supabase pg_net cleanup probe request 1 received Vercel login HTML after the
  deployment-protection redirect. HTTP 200 was NOT application success. Vault
  and Vercel CRON_SECRET equality remains unverified.
- Requested user login to the staged application and approval for a temporary
  Vercel Automation Bypass credential. Do not disable deployment protection.
- Upload enable flag and recurring jobs are still off; no raw exports uploaded.
- Latest Security Advisor no longer reports pg_net installed in public. Existing
  leaked-password-protection warning remains unrelated and unchanged.

## Hosted import verification continuation

- User created the temporary bypass and saved prodwise_vercel_bypass_temp in
  Vault. Probe 2 reached application cleanup: HTTP 200 application/json, removed 0.
- Cleanup job is active every 15 minutes against the staged nnpgk0ina URL using
  Vault references only. The 12:00 UTC scheduled invocation succeeded; response 3
  was HTTP 200 JSON. Jira job remains inactive.
- REPORTING_UPLOADS_ENABLED=true was saved for Production. Rebuild
  G7RhEGReNMbiKxDaEYLEE8H6HzWy is Ready/Staged (1980d92), immutable URL
  https://prodwise-8iqejgomp-e-payments.vercel.app. Main alias unchanged.
- On this rebuild, cleanup probe 4 without CRON_SECRET returned 401. Probe 5
  with the secret returned 200 JSON. Bypass alone does not authenticate the app.
- Seven Wallet files uploaded and parsed on Vercel: 46,333 rows, 581 excluded,
  gross EGP 1,103,827,757.48, refunds EGP 1,803,235.
- First bulk commit failed: postgres_logs identified SQLSTATE 57014 for the
  commit_executive_workspace call. February alone then committed successfully.
- Applied 0050_reporting_commit_timeout: only this service-only RPC receives a
  bounded 60-second timeout (PostgREST function setting); all other limits and
  permissions retained. API-role EXECUTE remained false; service_role true.
- Remaining six months then committed. Verified database revision 2, 46,333
  rows; UI shows seven source files, February through August 2026. August gross
  EGP 610,644,466.48, 17,193 successful payments, refunds EGP 1,346,102.
- Coverage deliberately PARTIAL pending confirmation; no invented unit mapping
  or target. Old tickets closed and their source objects removed; ticket rows
  remain until signed URLs expire as designed.
- Large PGW workbook preview is in progress. Hosted dedup, PGW result, final
  alias promotion, scheduler repointing and temporary bypass revocation remain.
