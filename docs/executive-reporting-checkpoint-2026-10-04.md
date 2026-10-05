# Executive Reporting: Local Acceptance Checkpoint

Date: 2026-10-04. No deployment, push, or hosted database migration performed.

## Implemented

- Roadmap defaults to Plan 2027, grouped by squad and workstream with monthly/quarterly axes.
- Bars use recorded Solution start through Target Live; missing start is not invented.
- Original commitment, actual/forecast live, owner, delay reason, next action, and revision history.
- Date precision supports day/month/quarter; coarse dates do not create exact delay-day claims.
- Existing delivery facts stay canonical for linked initiatives. Old delivery detail remains accessible.
- Analysis opens Business Performance, with separate PGW, Wallet, Salefny and Cash Collection views.
- CSV via csv-parse 7.0.3; PGW XLSX via ExcelJS 4.4.0, both explicitly approved.
- Import preview and approval, transaction/file deduplication, integer-cent amounts and source lineage.
- Cash-In/Payments remain independent of BP/FS. Missing BU is unassigned, never inferred.
- Wallet refunds are separated from successful receives. No combined PGW/Wallet portfolio total.
- Salefny uses source-referenced aggregate entry; no inferred monthly series or repayment rate.
- Complete-period growth requires adjacent same-source periods. Missing targets are not zero.
- Local workspace persistence and a hosted storage migration are implemented separately.
- Next.js updated from 16.3.4 to 16.3.6 with explicit user approval for the critical security fix.

## Verified

- Existing regression suite: 546 passed after the framework update.
- Executive model/import suite: 22 passed, including Excel dates, formula rejection, PII exclusion,
  duplicate/conflicting imports, permissions, original commitment preservation and stale edits.
- TypeScript check and focused ESLint check passed.
- Optimized production build (webpack) passed with Next.js 16.3.6 in the isolated preview.
- Actual Wallet February-August files: 46,090 receives, EGP 1,103,827,757.48;
  refunds EGP 1,803,235.00, no duplicate transaction references across the seven files.
- Actual Cash Collection August: 1,036 Cash-In transactions, EGP 47,710,304;
  137 runners, 3 suppliers, 70 terminals, 26 active days.
- Original PGW XLSX: 102,250 transactions, EGP 248,561,000.31, August 1-31.
- Browser acceptance: create Roadmap plan, show detail, Cash CSV and PGW XLSX preview/publication,
  desktop/mobile widths and no browser exceptions. PGW upload took approximately 34-46 seconds locally.
- All source exports remained unchanged. Preview plans are explicitly synthetic, not approved commitments.
- Preview data lives in D:/Prodwise-executive-preview, isolated from the project data and hosted app.

## Release Gates Still Open

- Jira automatic refresh/discovery is not implemented by this change.
- Hosted migration 0047 is not applied or database-tested. Hosted workspace isolation/CAS tests remain.
- Validate hosted upload transport limits and runtime memory/time before deploying real Excel ingestion.
  Raising the Next.js proxy limit does not raise a hosting provider's request limit.
- XLSX is parsed in memory after a 25 MB compressed-file check; expanded-archive limits and worker isolation
  remain necessary before opening ingestion to untrusted sources. Access is restricted to reporting approvers.
- Reporting uses a whole-workspace JSON record with a 300,000 normalized-row limit, not a scalable warehouse.
- Approval/coverage correction and transaction reclassification workflows are not yet implemented.
- Product Lead/admin/owner reporting approval is an initial access policy, not a dedicated Finance role.
- The latest npm audit has no critical findings but retains six high findings in development tooling and
  two moderate findings through ExcelJS/uuid. No force downgrade or unrelated dependency rewrite was applied.
- Real 2027 planning dates, ownership and commitments have not been populated from slide geometry.

## Local Preview

URL: http://localhost:3217

Local test credentials: D:/Prodwise-executive-preview/.data/local-access.json.
These are isolated fixture accounts, not hosted organization credentials.

## Follow-Up Verification

- Multi-file reporting import supports up to 12 files / 25 MB total, one atomic publication,
  per-file preview and idempotent skipping of already-imported files.
- Seven Wallet files published into the isolated preview; repeat selection reports zero new rows.
  Batch coverage approval is stored separately from the seven source-file records.
- Fixed global mobile button minimum height distorting small chart bars; mobile monetary values stay intact.
- Salefny source aggregate recorded locally for February 18-October 3, from the user-supplied DS screenshot.
  Reported remaining differs by EGP 1 from total issue minus collected; original values and note retained.
- Jira Epic snapshots now read paginated direct children including due dates, status, assignee and release dates.
  A fingerprint captures changes even beyond the text cap; no automatic launch or target-date decisions.
- Incomplete/failed child reads reject the new snapshot instead of replacing the previous evidence.
  Maximum ten child pages; repeated/missing continuation tokens fail closed. Only account-visible children.
- Connector tests: 40 passed, including four new child-pagination/change-detection cases. TypeScript and
  focused ESLint passed. Executive tests: 23 passed after the batch-publication regression test.
- This is not unattended Jira auto-sync. A background runner, durable subscription/retry controls and
  live connector acceptance remain unimplemented. The isolated preview has no real Jira OAuth configuration.
  No production secrets were copied and no hosted changes were made.

Jira API reference: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/

## October 5: Local Unattended Jira Sync

This supersedes the earlier statement that no background runner exists. It does NOT
mean that real Jira or the hosted installation has been enabled.

- Added explicit per-source opt-in, pinned to the enabling person's stored Jira connection.
- Local jobs persist alongside source snapshots in `.data/prodwise.json`. One atomic commit
  saves both a successful snapshot and job completion. A five-minute lease plus revision
  prevents concurrent or stale workers from publishing. Pausing invalidates an in-flight lease.
- Each successful check schedules the next for 15 minutes later. Transient failures retry
  with exponential backoff capped at six hours. Revoked identity, permissions, connection,
  archived/unlinked source or inaccessible source stops the job for explicit attention.
- Fresh authorization and the pinned connection are checked again before publication.
  Existing snapshots, canonical delivery dates and Knowledge remain untouched on failure.
- Machine-only POST `/api/internal/jira-sync` requires a timing-safe bearer secret check.
  No browser session is needed; no source body or token is returned by the runner.
- UI exposes enable/pause, connection owner, last successful check, errors and overdue checks.
- Local launch: set `JIRA_AUTO_SYNC_ENABLED=true` and a randomly generated
  `JIRA_SYNC_SECRET` of at least 32 characters in the isolated local environment, then run
  `node --env-file=.env.local scripts/jira-sync-worker.mjs` from that installation.
  `PRODWISE_LOCAL_SYNC_URL` defaults to `http://localhost:3217`; only loopback HTTP is accepted.
  The Next server and runner must both remain running; laptop sleep delays checks.
- The preview remains unconfigured for real Jira; no real connector credentials were copied,
  no real sync grants were created, and no production writes/deployment were performed.
- Hosted automatic sync intentionally fails closed. A durable database-backed job/lease
  implementation, atomic hosted snapshot completion, scheduler provisioning and hosted
  concurrency/revocation tests are STILL REQUIRED before production enablement.
  The local JSON runner is not a serverless or multi-instance implementation.

Verification: 558 existing/new regression tests plus 23 executive tests passed. Eight new
sync tests cover durable leases, concurrent claims, crash recovery, pause, backoff, permanent
errors and bearer authentication. The isolated worker integration test uses explicitly
synthetic Jira data, forbids browser cookie/header access, detects a child due-date change,
preserves older evidence and rejects disconnected, unlinked and deactivated grants.
TypeScript, focused ESLint and the optimized production build passed. Live Jira OAuth
acceptance remains open. Browser Sources verification confirms that this preview correctly
reports Jira as not configured; active-connection toggle acceptance still needs a test setup.

## October 5: Hosted Sync Adapter and SQL Proof

The hosted storage implementation is now written and tested against a disposable local
PostgreSQL 16 instance. This supersedes the earlier requirement to implement hosted jobs,
leases and atomic completion; actual hosted installation and real-provider acceptance remain open.

- Migration 0048 adds durable jobs, connection leases, guarded opt-in/claim/completion functions.
- Completion locks/rechecks permissions, source mapping and connection generation and commits
  evidence with job state atomically. Newer manual refreshes and stale workers cannot overwrite it.
- Token compare-and-set prevents an in-flight refresh from resurrecting a disconnected account
  or replacing credentials saved by a newer refresh/reconnection.
- GET supports a bounded scheduler drain; POST preserves single-job local/external invocation.
- All 48 migrations replayed successfully; SQL assertions passed including real simultaneous
  sessions. No hosted database was contacted. Full regression suite: 558 passed.
- TypeScript, focused ESLint and the optimized production build passed.
- `docs/jira-background-sync-runbook.md` contains activation/rollback gates and a Vercel schedule
  example. The example is not enabled in `vercel.json`; no deployment or plan purchase occurred.
- Live Jira OAuth, active-toggle browser acceptance and deployment-specific scheduler/runtime
  verification remain required. Reporting release gates listed earlier remain unless superseded.
