# Jira Background Sync: Pre-Deployment Checkpoint

## Delivered

Local and hosted storage adapters now implement explicit, per-source background grants.
The hosted adapter uses migration 0048, not the local JSON store. A grant belongs to
one person, organization, initiative, source and connection generation.

Each completed check schedules another check 15 minutes later. This is a due time,
not a strict wall-clock SLA: provider latency, throttling and scheduler backlog can delay it.
Transient failures back off from 15 minutes to six hours. Permission, source or connection
loss requires explicit attention and re-enablement.

The worker imports evidence only. It does not confirm Knowledge, launch dates, target dates,
release scope or readiness. Jira child due-date changes are evidence, not Roadmap commitments.
Snapshots contain only direct children visible to the connected account. Incomplete reads
fail closed; the current adapter is bounded to ten child pages.

## Safety

- Both per-job and per-connection database leases last five minutes. Competing workers use
  row locks and skip locked connections. Expired leases can be recovered after a crash.
- A paused or superseded lease cannot publish, including after a reconnect.
- User identity is verified against the auth provider; current application membership,
  policy, organization/workspace state, source mapping and connection are checked again.
- Successful completion holds database locks on the relevant authorization/source/connection
  records and commits the saved snapshot and job result atomically.
- If manual Refresh finished during the fetch, the background result is discarded and retried.
- Token refresh uses compare-and-set: disconnect/reconnect and newer stored tokens win.
- Registered shared Demo workspaces reject real background connector grants.
- Machine endpoint responses contain aggregate outcomes, never source bodies, credentials or IDs.
- Tables/functions remain deny-all for anonymous and authenticated browser roles; only the
  server service role can execute the guarded worker operations.

## Enable Only After Deployment Approval

1. Back up and apply the reviewed migration chain through 0048 to the approved environment.
   Verify the hosted schema, roles and service-role execution; the local replay is not a hosted test.
2. Keep `JIRA_AUTO_SYNC_ENABLED` unset/false until that environment has a working real Jira OAuth
   connection, approved read scopes and the existing environment write gate enabled.
3. Generate a strong random `CRON_SECRET` of at least 32 characters in the hosting secret store.
   Never put it in source control, a browser, a URL or logs. Hosted GET and POST use this secret.
4. Provision an authorized scheduler to call `/api/internal/jira-sync` with
   `Authorization: Bearer <CRON_SECRET>`. Vercel Cron supplies that header automatically.
   An example one-minute schedule is in `jira-sync-vercel.example.json`; it has deliberately NOT
   been added to the live deployment configuration. Confirm the hosting plan supports this
   frequency and a 300-second function timeout before choosing it. Do not assume Hobby supports it.
5. Set `JIRA_AUTO_SYNC_ENABLED=true`, enable one explicitly selected source in Sources, and verify
   an unchanged check, a changed child date, a newly added direct child and a disconnected account.
   Keep browser UI acceptance and real OAuth acceptance separate from mocked-provider tests.
6. Check the job's last attempt, last success, next run and last error. Alert operationally if
   the queue remains overdue; a secret and feature flag alone do not prove scheduler health.

GET drains up to ten jobs per invocation, starting new work only within the first 30 seconds.
POST processes one job for an external/local runner. The route allows up to 300 seconds;
actual hosting limits must be checked. Retry a failed invocation through the scheduler: atomic
completion and leases prevent a repeated invocation from duplicating evidence.

For local development only, `JIRA_SYNC_SECRET` is used instead of `CRON_SECRET`, and
`node --env-file=.env.local scripts/jira-sync-worker.mjs` calls the loopback server.
The local adapter is single-process and is not a serverless fallback.

## Pause / Recovery

- Pause one source using its Sources toggle. Its existing snapshots remain available.
- Disable `JIRA_AUTO_SYNC_ENABLED` and the scheduler to stop further worker invocations globally.
  Jobs remain stored. Re-enabling the feature can resume active grants; it does not create new ones.
- A disconnected or reconnected account does not silently resume an earlier grant. Re-enable
  that source with the intended account after reviewing the failure.
- A request killed before completion leaves a lease that expires; never manually mark it successful.

## Verified Locally

- Fresh PostgreSQL 16 replay of all 48 migrations, including executive storage 0047.
  This checks migration compatibility, not the full reporting RPC behavioral contract.
- Real SQL tests: tenant scope, Viewer denial, stale settings, duplicate claims, unchanged/changed
  snapshots, rollback on invalid content, stale completion, manual-refresh conflict, pause,
  disconnect, membership revocation, unlink, archive, backoff, crash recovery and Demo refusal.
- Two simultaneous PostgreSQL sessions cannot claim two jobs on the same connection.
- Connector tests include local token compare-and-set and a worker that forbids browser cookies.
- Full application regression suite and optimized Next.js build passed.

Run `scripts/db-test/run-jira-sync.ps1` to repeat database checks. It creates a fresh cluster
on loopback port 55438 and removes only its own temporary cluster after stopping it.

## Still Not Performed

No hosted migration, deployment, real Jira sign-in, production scheduler provisioning or real
provider acceptance was performed. The current preview still has no real Jira OAuth configuration.
No new dependency, hosting plan purchase or production secret copy was made.

Scheduler references: [Vercel cron authentication and management](https://vercel.com/docs/cron-jobs/manage-cron-jobs),
[cron frequency limits](https://vercel.com/docs/cron-jobs/usage-and-pricing),
[GET invocation behavior](https://vercel.com/docs/cron-jobs).
