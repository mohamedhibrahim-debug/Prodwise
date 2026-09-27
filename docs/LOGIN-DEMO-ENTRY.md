# Login and Demo entry

The public login uses Prodwise's navy identity panel and an accessible sign-in form. Password visibility, pending/error feedback and a separate Explore Demo form work at 390, 768, 1440 and 1920 pixels.

Explore Demo creates an app-owned two-hour session for the existing synthetic identity. It does not use a password, a Supabase anonymous identity, a magic link, a signup or an invitation. No new provider user is created.

## Boundaries

- Migration 0016 is additive. Existing identity, membership, RBAC and provider sessions are unchanged.
- The operator-only singleton configuration pins an existing user and a workspace already registered in demo_scenarios. The migration leaves it unconfigured.
- Configured organization/workspace must be ACTIVE; the user must be active, not a system identity, have a verified existing provider identity, no platform role, an active ORG_OWNER membership in Demo and no active membership in any other organization.
- The provider identity must match the stored ID/email and must not be anonymous, banned or deleted.
- Every request repeats the scope/authority checks; disabled configuration, retirement, revocation, expiry or changed authority refuses access.
- The opaque cookie's demo subtype is covered by the existing HMAC. HttpOnly, Secure and SameSite=Lax apply in production. Only token hashes are persisted; no provider credentials/tokens are used for guest entry.
- The client cannot choose an identity, organization, workspace or redirect. Normal login keeps its existing server-authorized selection and safe return path.
- Existing scoped repository/RPC and environment-write guards apply. Platform actions remain unavailable. Guest sessions cannot change global passwords, including through direct Server Action invocation.
- Logout revokes rather than deletes guest rows, preserving the ten-per-address-hash/minute and 200-global/minute entry budgets. Address hashes are abuse controls, never access controls. Next Server Actions retain their same-origin protection.
- Session tables and RPCs are denied to public/anon/authenticated. Runtime service cannot configure/retarget public Demo entry.

## Operator configuration and lifecycle

Enable only an explicitly approved registered synthetic workspace and its existing dedicated reviewer identity using the trusted operator database path. Do not infer a Demo from an email domain or organization display name. A reset that archives the workspace immediately invalidates its guest sessions; the operator must deliberately repoint the configuration after verifying the replacement generation. There is no normal User Management control for this pointer.

The Demo is shared: visitors use the same synthetic actor and see shared edits. This does not provide individual guest attribution. Expired/revoked hash rows are retained; a future bounded retention job may remove old session metadata outside the rate window. No scheduled cleanup or business deletion was introduced.

## Verification

- 180 unit tests passed, including signed subtype tampering and provider identity/authority validation.
- Ordered local PostgreSQL migration replay 0001–0016 and security/concurrency suite passed. New tests include public ACL denial, retirement, configuration disable, identity deactivation, authority changes, foreign membership, cross-organization RPC/parent access, expiry, revocation and ten create/logout cycles followed by a refused eleventh entry.
- Typecheck, full ESLint and production webpack build passed.
- Local production-build browser gate passed: both real owner accounts, invalid credentials, Show/Hide, keyboard use, pending feedback, passwordless Demo, pinned context, public signup OFF, anonymous sign-in OFF, guest password-action refusal, logout, full Demo routes, API/header/form tampering, foreign claim deep link and responsive screenshots.
- No business records were changed by browser acceptance; enabled operational controls and the existing server write permission guard were verified.
- Production results and screenshots are recorded in the release report after deployment; local validation alone is not described as production evidence.

