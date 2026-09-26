# Final candidate release gate and rollback

Production remains at `2596b72094ef6edcaf9ffd5f895d87b6043f479f`. The user authorized production deployment only after the complete integrated gate passes. **No production migration, provider provisioning, environment change, push or deployment has been performed by this mission.**

## Access blocker

The existing Chrome session opens `https://vercel.com/login?next=%2Fdashboard`; the user must sign into the existing Vercel account and open its Prodwise project. No Vercel token was found in the checked local environment/config locations. GitHub repository access, local tools, Claude CLI and the existing Supabase connector are available. No new OAuth permission, API key or paid plan is requested.

Windows Computer Use prohibits automating user authentication dialogs. After user sign-in, continue from the tested candidate rather than creating another project or changing billing. Files, command execution and browser test permissions are available within the authorized workspace; external platform action-time checks cannot be pre-approved globally.

## Deployment sequence

1. Record the clean candidate branch and SHA; retain its test and screenshot evidence. Read the remote main SHA and deployment status immediately before release. If it differs from the recorded baseline, reconcile the intervening work before deployment.
2. Inspect existing Prodwise Vercel project/runtime and production environment configuration. Report only presence/length, never values. Required server-side configuration: Supabase URL, service role and anon keys; hosted Auth mode; workspace ID; session secret; business/management write flags; Anthropic key and model. The local Auth mode must never be deployed. Preview remains write-disabled by policy.
3. Export private, timestamped backups of current application rows, IDs, table counts and migration state before any hosted migration. Store only under ignored `.data`; retain the currently working deployment and its configuration. Establish that the backup is readable and complete. Do not copy local AMAN fixtures into production.
4. Apply existing Auth/Delivery migrations **0010 → 0011 → 0012**, then Demo boundaries **0013**, then additive retirement **0014**, using the exact tested files. Fresh PostgreSQL replay preserves all nine checked business/history tables. 0012 deliberately revokes existing sessions and pending invitations as part of the organization authority migration; communicate this release effect.
5. Securely bind the two approved accounts to actual Supabase Auth identities, invoke the trusted first-platform-owner bootstrap, then persist both PLATFORM_OWNER + AMAN ORG_OWNER assignments through approved authority operations. Authorization must never compare their email addresses as a privileged shortcut. Confirm AMAN domain/exact-email policy separately.
6. Prepare/review the pinned hosted Demo operator plan. Pre-provision only its reviewer Auth identity and grant ORG_OWNER in **Prodwise Demo**, no global role or real-organization membership. Apply the reviewed transactional canonical dataset and explicit `demo_scenarios` registration. See [operator instructions](course-package/HOSTED-DEMO-OPERATOR.md). An authenticated Supabase SQL connector may execute the reviewed SQL; the standalone CLI operator additionally needs a private PostgreSQL connection. Never obtain new broader access merely to use one execution mechanism.
7. Deploy the exact tested clean SHA to the existing project. Verify Vercel **Ready / Production / Current**, URL and deployment ID. Do not identify a preview deployment as production.
8. Complete hosted provider sign-in, both approved owners, reviewer isolation, forged foreign writes, create/decision/fact operations, real Claude drafting, fallback label, baseline/finalization and runtime-log checks. Confirm no secret values in browser responses, screenshots or logs. Restore Demo to its canonical state using the reviewed non-destructive generation reset after mutation testing.
9. Record final deployed SHA and real production smoke results. Supply credentials privately; do not submit the instructor form.

## Rollback and recovery

Before promotion, production stays on the current known-good deployment. If the candidate fails after promotion, restore the previously working Vercel deployment and compatible server configuration, and disable business/management writes while inspecting compatibility. Do not drop the new tables/columns, reverse organization backfills blindly, delete Final reviews, or disable immutable-history triggers. The existing business tables and IDs are preserved by the forward migrations; data recovery requires the verified private backup and a separately reviewed operation if forward repair cannot resolve the issue.

Demo reset creates a fresh registered organization/workspace generation, reuses only the isolated reviewer identity, retires the old scope and sessions, and retains previous facts, events and Final snapshots. It must refuse any target with a platform role or real-organization membership. Reset never operates on AMAN.

## AI latency hardening

The real provider accepted the saved key (models endpoint HTTP 200) and returned a grounded `claude-sonnet-5` draft with HTTP 200. A separate draft exceeded the original 30-second deadline and correctly produced a labelled template. The candidate now allows 55 seconds for the provider within a 60-second Weekly Review route budget, retaining time for template persistence. No key or model value was modified, and no service/plan change is required. The bound follows the [Vercel duration configuration](https://vercel.com/docs/functions/configuring-functions/duration) and [Next.js route configuration](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#maxduration). Verify the existing deployment's effective duration before promotion.
