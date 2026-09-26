# Platform authority acceptance — 26 September 2026

Result: PASS for the isolated local integration. Branch: `prodwise/owner-authority`, based on `394374d6653ac562887a93ac482657ca8a02c655`. No deployment, remote push, production database operation or provider account provisioning occurred.

## Accepted decisions and implemented behavior

- Both approved identities are persisted PLATFORM_OWNER identities and active AMAN ORG_OWNER members. Both successfully signed in through the browser. Their emails are bootstrap inputs, never authorization conditions.
- Global identity and platform authority are independent from organization memberships and roles. Platform authority works without a membership and records the real global actor on product mutations.
- Multiple organization owners are allowed. An ACTIVE organization must retain at least one active owner. Concurrent owner removal and replacement preserve this invariant.
- AMAN owns its aman.eg / rayacorp.com domain policy and exact mohamedhassanpe@outlook.com exception. Example Bank owns an independent examplebank.com policy. Other Outlook addresses are rejected in normal organization flows.
- Platform provisioning can explicitly override policy with a required reason. The per-user, per-organization grant persists and records actor, target, organization, role, timestamp and override. It never broadens the organization's allowed domains.
- Standard User Management cannot assign owner/platform roles or modify protected owner/platform identities. Ordinary Org Owners/Admins cannot enter platform administration, including by replaying server actions.
- Platform invitations support seven-day expiry, resend invalidation and revoke through dedicated audited actions. Normal management cannot rotate platform-issued invitations.
- Role restrictions and environment write restrictions remain separate. Viewer access remains read-only. There is no organization switching UI.

## Verification

| Gate | Result | Evidence |
| --- | --- | --- |
| Full unit suite | PASS: 143 tests, zero failures | Existing domain, repository, decision, workspace, Auth and Delivery suites; includes platform actor fallback and supported AI drafting |
| PostgreSQL | PASS: 89 assertions/refusals plus concurrency checks | scripts/db-test/run-platform-preflight.ps1 and supabase/tests/platform-rbac.sql |
| Migration ordering | PASS | Fresh local replay of unchanged 0001–0011, followed by 0012_owner_roles.sql |
| Browser acceptance | PASS: 10 groups | [Browser results](ui-review/platform-rbac/results.json) |
| TypeScript and lint | PASS | Final checks after platform invitation changes |
| Production compilation | PASS using Webpack | Local compilation only; no deployment |
| Preserved product history | PASS | Browser gate checks the local Delivery/Weekly JSON is byte-identical; SQL checks frozen Final JSON and history preservation |

SQL checks use a disposable localhost PostgreSQL 16 database and fictional auth.users stand-ins. They exercise actual SQL privileges, transactions, audit binding, server actor validation, owner races and public refusal. They do not verify hosted Supabase Auth transport.

Browser checks cover both approved sign-ins, ordinary-role boundaries, Outlook refusal, forged actions, independent organization policy, foreign-organization invitation acceptance, platform access without membership, persistent audited policy override, Viewer restrictions, dedicated invitation lifecycle, and desktop/mobile overflow. Fictional test identities and organizations are visible in the captured test session; test-only memberships are deactivated during cleanup.

## Screenshots

- [Platform overview](ui-review/platform-rbac/platform-overview-1440.png)
- [Platform desktop](ui-review/platform-rbac/platform-owner-1440.png)
- [Platform mobile](ui-review/platform-rbac/platform-owner-390.png)
- [Owner User Management](ui-review/platform-rbac/users-platform-owner-1440.png)
- [Admin User Management](ui-review/platform-rbac/users-admin-1440.png)

Screenshots contain no API keys, passwords or invitation tokens.

## Safety, remaining limits and integration order

The original release HEAD and main remain `2596b72094ef6edcaf9ffd5f895d87b6043f479f`. The integration .env.local is ignored and untracked, and was not changed. Private local credentials, Auth state and diagnostic logs remain under ignored .data. The preview runs only at http://127.0.0.1:3200 from the integration root.

The default Turbopack build cannot resolve this checkout's shared dependency symlink outside its root. The Webpack production build and Webpack development preview pass. This is a local dependency-layout limitation; the application was not deployed to work around it.

Hosted identity-provider acceptance, actual invitation email delivery and hosted recovery remain unverified. Invitations are shared privately by link. The local bootstrap provisions local identities only. No product decision is pending for this scope.

Recommended order: review this combined authority change; on an explicitly approved non-production hosted environment, apply 0010 → 0011 → 0012 and run the trusted bootstrap against existing global identity IDs; verify provider sign-in/invite/recovery; then rehearse the evidence → confirmed Target Live → Roadmap → Claude Weekly Review → human-finalization demo. Production requires separate explicit approval.

The previously completed real Claude gate remains documented in [Claude acceptance](ui-review/claude-live/README.md). This authority change preserves its product facts, Target Live revision history and previous finalized baseline. Authentication remains a short supporting step in the graduation demo.
