# Approved Release: Large Upload Checkpoint

The user explicitly approved publication, then required large-file import to be fixed
before publication. The user approved direct unzipper 0.10.14 (already used by ExcelJS).
No production deployment, push, migration, raw-data upload or scheduler change has occurred.

## Integrated Candidate

Local executive/Jira implementation was committed as 07ab8cd, then the existing production
branch through add6e06 was merged as 397773a. Production's OAuth, privacy and delivery-fact
fixes were retained. The only merge conflict was proxy.ts; both the public privacy route
and secret-authenticated machine route were preserved.

## Large Files

- Hosted imports prepare owner/workspace/organization-bound upload tickets and private
  Supabase Storage signed PUT URLs. Browser-to-Storage uploads bypass the Vercel request
  body limit; only a ticket ID and reporting fields pass through the application request.
- Original filenames are metadata, never Storage paths. Paths are server-generated.
- Maximum 12 files and 25 MB declared total; downloaded actual bytes must match each
  declared size. The bucket independently limits each upload to 25 MB.
- Tickets expire after 130 minutes. Supabase signed upload URLs last two hours.
- Successful publication and cancellation close tickets and attempt immediate file removal.
  Tickets remain until expiry, so a late/replayed signed PUT is swept after URL expiration.
- Scheduled cleanup retries failed deletion and only removes ticket rows after Storage
  removal succeeds. Cleanup scheduling must be verified before REPORTING_UPLOADS_ENABLED.
- No raw export is placed in public storage. Persisted reporting rows still exclude PII.
- XLSX parsing uses a separate worker with 512 MB old-generation heap, a two-minute timeout,
  one active worker per instance, 300 MB verified actual ZIP expansion and 256 archive entries.
  ExcelJS parses streaming rows after bounded archive inspection; reporting retains only
  five PGW source columns. The pinned ExcelJS parser receives metadata before worksheet
  streams to handle both valid entry ordering and the original export's data descriptors.
- The worker and its runtime dependencies were verified in Next.js output tracing.

## Verification

- Merged application regression suite: 564 passed.
- Reporting/upload suite: 27 passed, including an oversized archive metadata regression.
- Disposable PostgreSQL replay: all 49 migrations; Jira SQL concurrency/revocation plus
  executive round-trip, tenant isolation, Viewer/revoked actor denial, stale write,
  invalid-payload rollback and service-only permissions passed.
- TypeScript, focused ESLint and the final optimized webpack build passed, including
  bounded worker concurrency and the final streaming parser.
- Original PGW report: 102,250 transactions; EGP 248,561,000.31; 2026-08-01 through
  2026-08-31, parsed in 10.147 seconds. Original file unchanged; no production publication.
- Local browser: selected July and August Wallet files together; preview reported 30,723
  existing transactions and zero new, with publication disabled. Canceled without writes.
  The same seven-month Wallet report remains available at localhost:3217.
- Hosted signed upload/CORS, actual serverless worker execution, live UI acceptance and
  cleanup execution are still release gates, not established by the local tests.

## External Blockers

### Latest continuation on 2026-10-06

### Hosted preparation after verified backup

- User explicitly authorized local backup and publication. Database password reset
  was performed by the user; no password was entered into chat or persisted by us.
- Original network timed out; after moving to the user's mobile hotspot, pg_dump
  succeeded over verify-full TLS using PostgreSQL 17 and the session pooler.
- Encrypted archive: private-backups/prodwise-20261006-135935.dump.dpapi in the
  Codex project workspace (not this Git repository), Windows DPAPI CurrentUser.
  SHA256: 342393E1062E657447B4A3BE3CD3FF23A2479DC771D4C3D205ABD3ED91885CC6.
  Archive integrity passed (1019 entries). Isolated PostgreSQL 17 UTF-8 restore
  of public and auth passed: 65 initiatives, 211 claims, 46 public tables, 6 auth
  users. Test instance stopped and its data directory removed. Archive excludes
  role passwords and Storage object bytes; DPAPI requires this Windows account.
- Hosted migrations 0047, 0048, 0049 applied successfully. RLS enabled, anon and
  authenticated table SELECT denied; reporting-imports bucket private, 25 MB cap.
  Existing initiative/claim counts remain 65/211.
- Approved pg_cron and pg_net enabled under prodwise_scheduler_extensions.
  net schema usage/function execution revoked from PUBLIC, anon, authenticated.
- Two 15-minute jobs created but INACTIVE: prodwise-reporting-cleanup and
  prodwise-jira-sync. Each calls its fixed prodwise-flax.vercel.app internal URL
  using prodwise_cron_secret from Vault (no inline secret), timeout 120 seconds.
- Hosted upload/runtime and scheduler HTTP response tests remain outstanding.
  Vercel Production tracks main; the working branch is a Preview branch.

- Subsequent secret handoff completed: user confirmed Vercel CRON_SECRET saved,
  then saved prodwise_cron_secret in Supabase Vault. A metadata-only query on
  vault.secrets verified that exact name (created 2026-10-06 10:21:05 UTC).
  Secret contents were not read; equality/authentication is still unverified.
- Supabase Backups page confirms the E-Payment organization is Free and project
  backups are not included. No hosted recovery point is available in that UI.
  User was asked whether a recent restorable backup exists or to approve an
  encrypted local backup first. No new hosted DDL or scheduler activation yet.

- User resumed the main release work after receiving light-mode screenshots.
- User explicitly approved Supabase Cron and pg_net on the existing project at a
  15-minute cadence, without purchasing a plan. No extension or job is enabled yet.
- Supabase access is restored: exact project identity/status, migrations through
  0046, and extension metadata were read successfully. pg_cron and pg_net are
  available but not installed; supabase_vault is installed.
- User confirmed CRON_SECRET is not saved. Vercel's Add Environment Variable form
  is open with CRON_SECRET, Secret type, Production environment, and no entered
  value. User must enter and save it, then retain the same value for Vault.
- Current UI refinement passed optimized webpack build, TypeScript, focused
  ESLint and all 29 executive tests. The roadmap now shows row-level dates/owner
  and independently counts recorded delays even when a plan is on hold.
- The older connection and scheduler-approval blockers below are historical;
  backup/recovery verification, secret provisioning, hosted migrations, candidate
  deployment, real hosted upload tests and cleanup proof remain outstanding.

### Previous checkpoint

- Vercel project e-payments/prodwise is Hobby. Native cron cannot supply the requested
  15-minute Jira cadence. Approval was requested for Supabase Cron and pg_net, without
  purchasing a plan. No extension or schedule has been enabled.
- CRON_SECRET is absent. User was handed the Vercel Production secret form; only the
  key name was filled, not a credential. User must enter/save a strong random value and
  retain it for Supabase Vault if that scheduler is approved. Do not print it in chat.
- Supabase connector initially worked and confirmed migrations through 0046, then returned
  FGA Unauthorized on a count-only read. Reconnection is required before hosted changes.
- An optional whole-table fingerprint query was rejected by the security reviewer; it was
  not executed or retried through another path. Do not claim content-preservation hashes.
- Existing production totals observed before any change: 65 initiatives and 211 claims;
  one connected Jira account. This is count evidence, not a full backup.
- Intended read-only Jira test source: https://amanpmo.atlassian.net/browse/ANDROID25-165.
  Do not mutate this Epic or infer a destination initiative from its key.

## Activation Order

1. Restore authorized Supabase access and verify the exact target qhtlbjtbjidflsquvbbg.
2. Complete backup/recovery and additive migration review; apply 0047, 0048, 0049 and
   verify deny-all browser permissions and private bucket settings.
3. Configure the selected scheduler and its secret through secure host/Vault controls.
   Never copy existing production credentials into the local fixture preview.
4. Deploy a candidate; test scoped upload, large Wallet/PGW preview, publication, dedup,
   denied cross-account access and scheduled deletion. Prefer synthetic upload first.
5. Only enable REPORTING_UPLOADS_ENABLED once cleanup is operational. Keep
   JIRA_AUTO_SYNC_ENABLED off until live authorization and scheduler proof are complete.
6. Promote the exact verified candidate and smoke-test the public alias. Preserve
   the previous add6e06 deployment for rollback; do not remove user data or old histories.

Known storage limit: reporting still uses a whole-workspace JSON value capped at 300,000
normalized rows; this is not a warehouse or an unlimited production analytics backend.
