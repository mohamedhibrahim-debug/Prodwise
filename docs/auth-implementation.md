# Auth + User Management implementation

Track A is isolated on `prodwise/auth-users`, based on live `2596b72094ef6edcaf9ffd5f895d87b6043f479f`. No hosted migration, account, deployment, push or production change was made. Migration 0010 belongs to Auth; Delivery owns 0011. Shared shell changes belong to integration.

## Implemented contract

Single configured workspace; invitation-only account setup; Admin, Member and Viewer roles; explicit Product Lead capability for Admin/Member; mandatory authorization of workspace pages, APIs and every repository read/write; fresh membership checks after deactivation/role change; signed opaque HttpOnly cookie and server-side session; real actor IDs/names for decisions and activity. A Viewer is denied writes before the separate environment restriction is considered.

Invitations use 256-bit opaque bearer tokens, store SHA-256 hashes only, expire after seven days, bind email/role on the server, consume once, support revoke and resend (old token becomes invalid). Possession is sufficient as explicitly approved; no added email verification step. Copy links are available to Admins. Email transport is not configured and the interface says so.

Login, logout, first password setup and own password change work in the private fixture preview. Own password change verifies the current password, revokes prior app sessions, and is independent of business/management flags. Forgotten-password email recovery is **not implemented**; the login screen directs users to their Admin. Do not claim provider/email recovery coverage.

Users includes active/deactivated membership, role and lead capability changes, invitations and stable actor snapshots in membership history. Last Admin protection serializes changes under a workspace row lock plus a deferred database invariant. No hard-delete operation is exposed. The legacy demo actor is retained as historical/system data and cannot become a signable membership.

## Integration API

- `getRepository()` stays synchronous. Its asynchronous methods check current access, workspace ownership, role and environment before persistence.
- `requireWorkspaceAccess()` yields `{workspaceId, memberId, actor:{id,label}, role, isProductLead}`.
- `requireBusinessWriteAccess()` checks membership/role before `DEMO_WRITE_ENABLED`.
- `requireReviewFinalizeAccess()` requires Admin or designated Product Lead, then business writes enabled.
- `listWorkspaceMembers()` supplies authorized workspace membership display data for Delivery assignment.
- `contextForCookie()` supports the global Next 16 Node proxy without request-scoped Next headers.
- `AccountAccess` is the shared-shell insertion slot: signed name, explicit role (Viewer: view-only), a separate environment indicator, account, Admin Users link, sign out. Integration should hide public login/invite navigation and disable old inline mutation controls for Viewer. The proxy already redirects Viewer form routes; server guards remain authoritative.

## Private local preview

On an empty isolated checkout, run `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/auth/bootstrap-local.mjs`, then `node node_modules/next/dist/bin/next dev --webpack -p 3201`. Bootstrap generates fictional Admin/PM/Reviewer accounts and stores randomized passwords in ignored `.data/local-access.json`; `.env.local` contains a generated signing secret. Never commit either file. A repeated bootstrap refuses to overwrite existing local data.

The fixture store has persisted, salted scrypt passwords, private signed cookies and file-locked auth lifecycle transitions. It never supplies a static demo identity. Local Auth rejects production/hosted execution. Supabase mode fails closed on missing configuration and never falls back to fixture Auth. The local business store remains demonstration persistence (single-machine, not distributed). It rereads disk so page/action bundles observe successful changes.

Hosted configuration requires `AUTH_MODE` absent or `supabase`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PRODWISE_WORKSPACE_ID`, a private `AUTH_SESSION_SECRET` of at least 32 characters, and separate default-false `DEMO_WRITE_ENABLED` / `MANAGEMENT_WRITE_ENABLED`. Preview denies both business and management writes; login/logout/own credential change are independent. Provider access/refresh tokens are stored only in the private server session table. Provider users are validated server-side, never from client-supplied session claims.

## Database and deployment boundaries

0010 backfills all seven existing tenant tables into explicit workspace `10000000-0000-4000-8000-000000000001`, adds mandatory workspace columns without defaults, composite parent/child constraints, private membership/invite/session/audit tables, and scoped service-role RPCs. Existing service-role table privileges are explicit; no public or authenticated direct access is opened. Acceptance is a narrowly scoped SECURITY DEFINER with empty search path and service_role-only EXECUTE, since service_role does not ordinarily receive SELECT on auth.users. Auth schema privileges are not widened.

Provider identity creation and PostgreSQL invitation acceptance cannot be one transaction. If acceptance fails after provider creation, the identity may exist without membership; it receives no workspace access. Retries authenticate the existing identity using the original chosen password. No automatic deletion or password reset can destroy a concurrent winner. Operator recovery of that exceptional case remains an operational procedure, not a proven end-to-end provider flow.

Bootstrap of a hosted workspace needs an explicitly approved operator/provider identity and one-time Admin invitation using `bootstrap_workspace_admin`; no live identity is preprovisioned by this change. The local bootstrap is local/test only. Once real confidential data exists, reverting to the old publicly readable application is unsafe. Rollback must retain a mandatory access gate or disable the app, with explicit approval and a database backup. Do not apply a blind down migration or deploy the old public app.

## Validation and remaining evidence

The complete pure/repository suite passes **106 tests** covering signed cookie tampering, role versus environment ordering, fresh membership, session deactivation/logout/password revocation, durable invitation races, cross-workspace IDs, same-initiative source/replacement constraints and server actor override. Existing Decisions tests preserve semantics. The Stage 2.2 local adapter suite passes **2 tests** covering audit rollback and re-emergence. Typecheck and targeted lint pass. Webpack compilation is used because this checkout's dependency junction is outside Turbopack's default filesystem root.

`node scripts/auth/test-postgres.mjs` creates only a fresh disposable database at `127.0.0.1:55433` and applies 0001–0009, seed, then 0010. It verifies realistic service_role bootstrap without auth.users SELECT, activation/deferred constraints, simultaneous last-Admin demotions, duplicate acceptance, accept-versus-revoke/resend races, Viewer writes/management/lead denial, cross-workspace denial and denied public sessions/RPC. Fictional provider identities stand in for auth.users. This is real PostgreSQL concurrency evidence, **not** a test of Supabase Auth transport, token refresh, email delivery or hosted session lifecycle.

Hosted provider integration, forgotten-password recovery, rate-limit behavior, email transport, and production provisioning need environment-specific acceptance before deployment. The local preview and compile are reviewable; production readiness must not be claimed from those alone.
