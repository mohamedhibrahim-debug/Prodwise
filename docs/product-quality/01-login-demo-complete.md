# Login and Explore Demo — completed first

Verified production candidate: `79875f8fe61c799eb5f240b2bc2b2bd0f7854b34`.

Production URL: https://prodwise-flax.vercel.app

Vercel deployment: `dpl_54PfZJQNqobRAVfu1T1urNQQ9CCv`; GitHub production deployment `6690213587`. Vercel reports successful completion. The public alias returns this exact commit in the authenticated navigation response. The protected unique deployment URL remains protected; no settings were weakened to inspect it.

Build, typecheck, lint, 180 unit tests, ordered database migration/security tests, and isolated local and production browser gates passed. Both approved Platform Owners sign in with their existing identities and AMAN memberships. Explore Demo establishes an opaque, two-hour server session for the pinned synthetic organization and user. Forged scope/redirect inputs, foreign deep links, platform access and direct guest password actions are denied or ignored. Public signup and provider anonymous sign-in remain off.

Browser gates covered login errors/loading/password visibility/keyboard, product and administration routes, 390/768/1440/1920 widths, sign-out revocation, and public asset/console secret scans. Zero page/console errors, HTTP 5xx or secret matches in these gates. Evidence and desktop/mobile screenshots are stored privately under `.data/login-demo/`.

Migration 0016 and its pinned demo entry configuration are applied. No pre-existing identity, membership, initiative, fact, review or audit record was changed by this release. A concurrently recorded AMAN W39 draft was retained untouched; its origin is recorded against the existing AMAN owner and is not attributed to the gate.

The following mission continues on `prodwise/product-comprehension`, from this production baseline. Login completion is a milestone, not the final mission verdict.

Bounded Supabase log inspection, 08:56–09:03 UTC: 1,718 edge records and four PostgreSQL records had no error-like messages; scanned sources had no API-key/Bearer secret-pattern matches. Five auth error-like records included one invalid-credentials result and two missing/expired-session results, consistent with the negative/sign-out gate; two did not match those categories and are not represented as a clean zero-error auth log. Browser success/negative assertions remain the functional evidence. This pattern scan is not a guarantee about uninspected log systems.
