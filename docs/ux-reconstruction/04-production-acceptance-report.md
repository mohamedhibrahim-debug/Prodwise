# Prodwise MVP — Final Production Acceptance Report

Date: 29 Sept 2026 · Stage: final production acceptance (no new scope)

## A. Release Candidate

| Item | Value |
|---|---|
| Final repository state | `d0dd2f914f5725cb28d84ebcb777659bde75d398` |
| Application code | Identical to release candidate `891eda595473b045efa68b285b12e051906419ec`. `git diff --name-only 891eda5 d0dd2f9` lists only `CLAUDE.md`. |
| Production deployment | Vercel **Production** deployment of `d0dd2f9`, created 12:52:15 UTC (GitHub deployment 6735203320, state `success`). Live response header `x-prodwise-commit: d0dd2f914f5725cb28d84ebcb777659bde75d398`. |
| Production URL | https://prodwise-flax.vercel.app |
| Deployment region | Functions in **lhr1 (London)**, next to Supabase eu-west-2. Response header `x-vercel-id: iad1::lhr1::…` means the test client enters at a US edge and the function runs in London. Previously `iad1::iad1`. |
| Demo dataset | **Demo dataset V3**: 15 synthetic initiatives, W37/W38 Final and W39 Draft. The registry key `prodwise-graduation-2026-09-v1` is intentionally stable and is never shown to users. |
| Demo metrics | Applied today: 24 definitions and 151 observations, all `SYNTHETIC_DEMO`, across 9 initiatives, in the single ACTIVE Demo workspace only (details in C). |

## B. Technical Gates (against `d0dd2f9`)

| Gate | Result |
|---|---|
| Typecheck (`tsc --noEmit`) | Pass (clean) |
| Lint (`eslint src scripts supabase`) | Pass: **0 errors**, 28 warnings (unused variables and effect dependencies) |
| Unit tests (`npm test`) | **423 / 423** pass |
| Production build (`next build`) | Pass: 0 errors, 0 warnings |
| Database: migrations and replay | Production holds migrations 0001–0044; 0044 was applied 28 Sept and verified. The last full local replay (44 migrations) passed, with 18 SQL tests, the hosted operator initial and reset proofs, Draft/Final projection parity, and the additive Demo-metrics proof. **No database-relevant file changed since that replay** (`git diff --name-only ca97b27 d0dd2f9 -- supabase scripts/db-test scripts/demo src/lib/demo` is empty), so that result stands without re-running it. |
| SQL tests | 18 / 18 pass (same replay) |
| Browser acceptance (`scripts/e2e/acceptance.mjs`, local, on `d0dd2f9`) | **23 / 23** pass: auth, RBAC (Viewer and Member), org isolation, connectors off in Demo, honest no-Claude fallback, 404, offline input preservation, archived handling, search, notifications, count consistency, and responsive layout at 390, 768 and 1440 |
| Privacy / private-value scan | Pass: 1,190 files and 74 client assets checked, 0 leaked values, private files ignored and untracked |
| Production logs since promotion (Supabase) | 0 Postgres errors. The only ≥400 responses are 2 deliberate invalid-credential sign-ins. |

## C. Production Smoke Test

**Demo metrics (step 1).**
- Applied the reviewed idempotent additive SQL in 4 batches of 6 definitions, each with the full guard and insert-or-verify logic and the Demo operator advisory lock.
- Verified against checksums computed locally from the source dataset:
  - definitions md5 `c59fd6e18e569105cefd1684298841d3`: match;
  - observations md5 `1bcdc16539871913d24f90d256710994`: match.
- The rows cover 1 workspace (the ACTIVE Demo) and 9 initiatives, none of them archived.
- 7 periods are deliberately unrecorded (Missing ≠ Zero) and 8 metrics have no approved target.
- AMAN metric rows before and after: 0.

**Critical journey (Demo reviewer, live):**

| Step | Result |
|---|---|
| Login | Invalid credentials → "Email or password is incorrect." in 0.9 s, with no field disclosure. Explore Demo → Home in 2.9 s. After logout, `/api/nav` answers 401. |
| Home | Pulse (14 active · 8 need attention · 3 decisions · 3 blockers · 1 past target · 7 targets in 28 days · 4 no Target Live · 7 setup incomplete) matches Initiatives, Roadmap and Analysis. The Demo opening line is derived from the live open decision. |
| Initiative | Create → lands on the Brief (2.6 s). Header, tabs and setup meter are correct. |
| Evidence / Source | Pasted evidence saved (5.3 s). It appears on Sources under a visible **"Current Scope"** group and is editable (M9 decision honoured). |
| Proposal | **FAIL: live Claude reading.** Loading feedback appears in 55 ms. Three readings on the new deployment (13:08, 13:17, 14:04 UTC) all ended `FAILED / READING_FAILED`, with no model recorded. The last successful live reading was 28 Sept 23:16 UTC (previous build, iad1, `claude-sonnet-5`, 4 grounded proposals with exact quotes). The fallback is honest: "Your text is saved. Reading did not complete. You can read again, or add your own entries." No proposal and no Knowledge were invented. |
| Confirm / Reject | The UI was verified read-only on production against the Demo's pending synthetic proposals: one consistent "1 needs your decision", a primary Accept, a secondary Reject, and a pinned source panel. The decision form and server action are byte-identical to the build on which Confirm and Reject were exercised live on 28 Sept. They could not be exercised live today because no new proposal could be generated (see Proposal). |
| Status / Roadmap | The new initiative appears in the "Not scheduled — no Target Live recorded" lane, and the timeline renders. |
| Notification | Page and bell work: 23 new in the org, 1 for me, read marks shown. |
| Search | Ctrl+K finds the new initiative; archived items are labelled. |
| Connector import | The Demo org shows "Import from" with connectors off, as designed. Live imports belong to the AMAN org (see D). |
| Logout | Account menu → "Leave demo" → `/login?signedOut=1`, and the session is revoked. |

**Latency (step 2).**
- Method: same script, 1 warm-up plus 5 samples per route, median TTFB, measured from this environment's US egress. Before = `0e25a10` in iad1; after = `d0dd2f9` in lhr1.

| Route | Before | After |
|---|---|---|
| / | 1.52 s | 2.95 s |
| /initiatives | 1.26 s | 1.76 s |
| Initiative Brief | 1.53 s | 1.95 s |
| Decisions | 1.28 s | 1.53 s |
| /roadmap | 0.96 s | 1.11 s |
| /analysis/portfolio | 0.98 s | 1.55 s |
| /weekly-review | 1.52 s | 1.48 s |
| /notifications | 2.13 s | 1.45 s |
| /api/nav | 1.39 s | 1.77 s |

- **Server side, the region move worked.**
  - Supabase logs for the same `/api/nav` chain (session → auth → session → auth → data) show consecutive database hops going from **100–325 ms apart (iad1)** to **43–105 ms (lhr1)**.
  - The whole chain went from about 0.7–1.1 s to about 0.3 s.
- **The client-measured TTFB from a US vantage point did not improve, and is worse on some routes.**
  - The client-to-function path now crosses the Atlantic.
  - The deployment was freshly promoted, and the after-run shows cold-start outliers of 7–10 s.
  - Home now does more work.
  - This is **not a like-for-like code comparison**.
- **Users in Egypt/Europe should gain, but this is unmeasured.** Being near London, they should benefit from the server-side improvement, but this could not be measured from Cairo.
- **Perceived responsiveness is unchanged and good:** click feedback in 46–88 ms, persistent shell, progress bar and destination skeletons.
- **Watch item:** 2 background RSC-prefetch requests returned 502 during the smoke run (plus 1 before promotion). None reproduced on retry, and navigation was unaffected because a failed prefetch falls back silently. Vercel runtime logs were not accessible from here.

## D. Connector Verification

| Connector | Status in production (AMAN org, connected by the owner) | Verified in this stage |
|---|---|---|
| **Jira** | CONNECTED; scopes `read:jira-work read:jira-user offline_access`; no error | OAuth consent and callback succeeded live (28 Sept). Forged or unauthenticated callbacks refused on `d0dd2f9`. Import endpoint refusals: 401 without a session, 403 for a foreign origin, 403 without org scope. |
| **Gmail** | CONNECTED; `openid email gmail.readonly`; no error | 2 threads imported live. Snapshots saved, freshness CURRENT, **0 proposals and 0 Knowledge**: evidence only, as designed. |
| **Google Drive** | CONNECTED; `openid email drive.readonly`; no error | OAuth consent and callback succeeded live; no imports yet. |
| **Figma** | **Not connected** | The code requests exactly `current_user:read file_content:read file_comments:read` (pinned by a unit test). The earlier live attempt returned "Invalid scopes for app". The new build shows a specific message if Figma refuses the scopes again. **Live OAuth on the new build not yet performed** (needs the owner's session). |

**OAuth status overall:**
- State and forgery protection verified on production for all four providers.
- Tokens are stored sealed (`v1.` AES-256-GCM, no raw token markers).
- Connectors stay off in the Demo org.

**External configuration dependency (Figma).**
- If Connect → Figma still shows "Invalid scopes for app", the fix is in the Figma app:
  1. Go to figma.com/developers/apps → the Prodwise app → **OAuth scopes**.
  2. Enable exactly **current_user:read**, **file_content:read** and **file_comments:read**, and no others.
  3. Confirm the callback URL `https://prodwise-flax.vercel.app/api/connectors/figma/callback`.
  4. Save, then retry Connect.
- No code change is needed.

**Still to be exercised live by the owner (needs the AMAN session):** Jira search/import/refresh, Drive import, Figma connect/import on the new build.

## E. UX/UI Final Acceptance

Full review: `03-final-ux-acceptance.md`. It is an independent reviewer on live production. It was re-briefed mid-run with the owner's visual-richness correction and assessed that in its own section, I.

| Area | Result |
|---|---|
| Login page | **Production-quality.** Cosmetic only: the error outlines only the Email field (A-1); the signup stepper widens the column by 19 px (A-2). |
| Logo / branding | Intentional and consistent. The 16 px mark reads like a loading spinner (B-1, Minor, accepted). The sidebar tile contrast is low (B-2, cosmetic). |
| Application shell | Accepted. Collapse persists, the account menu fits a 680 px viewport, the palette works, and all menus close on Escape and outside click with focus returned. Help is missing the outside-click close and its open/closed state (D-1/D-2, cosmetic). |
| Overall visual identity | Consistent and credible, but **too monochrome for the stated "command centre" positioning** (I-1, Major). The **orange secondary accent is rendered nowhere** (I-2, Minor). Status colour is missing where status exists in Weekly Review and Notifications (I-3, Minor). |
| Core-screen UX | Roadmap, Analysis and Decisions have distinct, job-specific, visually rich compositions. **Home and the Initiative Brief** are 93–94% white/neutral stacked text cards that do not visualise schedule, lifecycle or attention-mix data they already hold (I-1). Sources, Weekly Review and Notifications lean toward a document or portal feel (Minor). |
| Interaction quality | **F-1 (Major):** filter menus show no visible checked state; the selection is only in `aria-checked`. Tab inside an open menu jumps to the top of the page (F-2, Minor). Multi-select stays open and single-select closes, as intended. |
| Responsive behaviour | No horizontal overflow or clipped control across 13 pages at 1440, 1366, 1024, 768 and 390. The register breaks words mid-word at 1024 (G-1, Minor). One unstyled render at 1366 did not reproduce in 17 retries (G-3, watch). |

**Remaining UX issues by severity.**
- **Major (requires action):** F-1, I-1.
- **Minor (requires action):** I-2, I-3, E-1, E-2, E-4, E-5, E-6, C-2, F-2, G-1, G-3.
- **Minor (accepted):** B-1, C-1, E-3.
- **Cosmetic (accepted):** A-1, A-2, A-3, B-2, B-3, C-3, C-4, C-5, D-1, D-2, D-3, G-2, and the Account/404 offsets.

**UX/UI production blocker:** **No**, per the Blocker definition (breaks a core task, violates a truth or status rule, clips a critical control, or looks broken).

**UX/UI verdict: UX/UI Accepted with Non-Blocking Issues.**
- **The owner's direction is not yet met on the daily surfaces.** The product is consistent and truthful, but it does not yet read as a modern AI product-management command centre where users land daily. Home and the Initiative Brief are the main gap: Major I-1, plus Minor I-2 and I-3.
- **Recorded as findings requiring action, not accepted as "consistent".**
- **This is the item that would hold the release** if the owner treats the command-centre look as a release condition. That call is the owner's.

## F. Known Accepted Decisions

- **Pasted evidence defaults to Current Scope** (M9). No per-paste boundary prompt. The boundary is visible as the Sources group heading and editable from the source's edit page. Verified live.
- **8-character URL suffix retained** (M10). The slug remains the stable identifier; the suffix is fixed at creation.
- **Gmail and Figma are reflected as in scope in CLAUDE.md** (commit `d0dd2f9`). Both are read-only and evidence-only until a person confirms.

## G. Final Verdict

**Production Blocked**

Exact blocker:
1. **Live Claude evidence reading fails on the promoted deployment.**
   - 3 of 3 attempts on `d0dd2f9` failed: `READING_FAILED`, no model recorded.
   - The same, unchanged code path succeeded live on 28 Sept on the previous deployment.
   - Nothing false is shown to users, but the core evidence → proposal → confirm flow cannot produce proposals in production.
   - The code discards the provider's HTTP status, so the cause is not visible from here. It is one of:
     - (a) the Anthropic account behind the production key: credit balance, spend or rate limit, or key revoked or rotated;
     - (b) the Production `ANTHROPIC_MODEL` / `ANTHROPIC_API_KEY` values in the promoted deployment;
     - (c) a region-specific effect of the move to lhr1.

**Minimum action to resolve:**
1. **Test the production key and model directly.** From a trusted machine, send one test request with them:

   ```sh
   curl -s https://api.anthropic.com/v1/messages \
     -H "x-api-key: $ANTHROPIC_API_KEY" \
     -H "anthropic-version: 2023-06-01" \
     -H "content-type: application/json" \
     -d '{"model":"<the Production ANTHROPIC_MODEL value>","max_tokens":16,"messages":[{"role":"user","content":"ping"}]}'
   ```

   - An error type such as `credit_balance_too_low`, `rate_limit_error`, `authentication_error` or `not_found_error` identifies the cause.
   - Fix it in the Anthropic Console or in the Vercel Production environment variables, then redeploy.
2. **If that request succeeds,** the cause is deployment-side. Approve one diagnostic-only change: record the provider HTTP status and error type in the server log (no content, no secrets). Deploy, retest, and if it is region-related, set the region back and retest.
3. **Re-run the Proposal → Confirm → Reject steps** of the smoke test on production.

Everything else accepted: the gates, Demo metrics, the rest of the critical journey, connector security, Jira/Gmail/Drive connections and UX/UI (non-blocking).
- The Figma scopes are an owner-side app setting, documented in D.
- UX items F-1 and I-1 (Major) remain open actions but do not block.

Once the Claude blocker is resolved and re-verified, the expected verdict is **Production Accepted with Non-Blocking Issues**.

---

### Production data changes made during this stage

- Demo metrics inserted, as above.
- Three clearly labelled synthetic test initiatives were created in the Demo and **archived**:
  - "Smoke check — synthetic (production verification)" (28 Sept);
  - "Production acceptance smoke — synthetic";
  - "Claude recheck smoke — synthetic".
- Archived initiatives are read-only and absent from Home, Notifications, Roadmap and Analysis lists. A Demo generation reset removes them.
- No AMAN data was read beyond connector status, and none was written.

---

## Addendum (29 Sept) — Blocker resolved, verdict updated

- **Root cause.** A diagnostic build (`e1c4639`) recorded `READING_FAILED:OUTPUT_NOT_JSON:4003ms`. The provider answered HTTP 200 with a complete response. Prodwise's `JSON.parse(raw)` rejected Claude's JSON because it was wrapped (fenced or with surrounding prose). Authentication, model availability, account limits, environment variables and the London region were all ruled out.
- **Fix.** Commit `9ad8496` (`src/lib/evidence/extract.ts`) adds `modelJson()`, which reads a bare, fenced or prose-wrapped JSON object. Candidates are still anchored to exact quotes, and non-JSON still fails honestly. The content-free diagnostic remains, marked temporary.
- **Live production re-test on `9ad8496`** (synthetic "Claude fix verification — synthetic", archived afterwards):
  - Evidence saved.
  - Reading completed: "Read by Claude (claude-sonnet-5)" in ~35 s.
  - 3 grounded proposals were generated.
  - Confirm → a Knowledge entry, UNVERIFIED / HUMAN_ENTRY, linked to its evidence.
  - Reject → REJECTED.
  - The count went 3 → 2 → 1 consistently.
- **Regression checks:**
  - Typecheck clean.
  - Lint clean.
  - Unit tests 425/425.
  - Build clean.
  - Browser acceptance 23/23.
  - Privacy scan clean.
- **Updated verdict: Production Accepted with Non-Blocking Issues.**
