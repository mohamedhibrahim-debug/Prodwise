# Stage 2.2B — Decision Truth UI audit

Implemented on `stage2-2-decision-truth`, based on approved Stage 2.2A commit
`d1c8954270941216f822f8832c31be05397dd021`. No review-engine, migration, repository
mutation semantics, navigation structure, or dependencies were changed.

Audit remediation is based on `c896e8c39c979d6891258c9971f2f3e1ce60cd3a`.
It changes only lane presentation, decision-form reset behavior, focused browser
coverage, and this screenshot/report package.

## Behavior

- Actionable mismatches show values, source summaries, and the current
  `ReviewFinding.confirmerLabel`. Assignment/change/clear use the existing
  confirmer orchestration and repository guards.
- Choose-existing preserves the selected value; corrected-value creates a
  confirmed Decision entry. Both require rationale and the rendered digest.
  Corrected values matching deterministic normalization are refused in the
  browser and again at the server boundary, with a choose-existing control.
- Re-emergence shows the prior value, rationale, decision time, and persisted
  `confirmedWith` snapshot separately from the current-cycle confirmer.
- Standing records are read-only in Resolved. Memory marks chosen entries and
  corrected Decision entries and links to their record. Successful actions
  revalidate the initiative layout; the server reloads persisted data and runs
  the existing engine. No optimistic engine state is stored in the client.
- Legacy notes say **Reviewed — note only** and **Knowledge was not changed**.
  They live exclusively in **Reviewed**, between Needs a decision and Resolved.
  Resolved counts only actual Decision Truth outcomes; re-emerged mismatches
  return to Needs a decision with their previous-decision disclosure.
  Their confirmer is hidden while resolved. Real decisions never expose note
  or reopen controls; repository refusals remain enforced for direct calls.
- Named refusals map to safe copy. Unknown exceptions never expose RPC/SQL text.
  The decision form cancels React's native reset, preserving decision mode,
  selected value, corrected value, domain, and rationale on refusals. Success
  still depends on persistence and revalidation. Disabled writes hide forms and
  are checked again by the server action boundary and existing repository.

## Reproducible gate

Run `npm run test:stage2-2-final` with Node, PowerShell 7, PostgreSQL 16, and an
installed Chrome/Edge browser. The command creates disposable local PostgreSQL,
demo stores, and a headless browser profile, then cleans them up.

The gate includes unit tests and MFF fingerprint, local adapter tests, Stage 2.2
SQL and concurrency, committed rollback/reapply, **Stage 2.1 SQL/concurrency on
committed 0008/0009**, typecheck, lint, production build, and browser UI tests.
No optional switch is needed to include Stage 2.1-after-2.2.

The browser harness uses built-in Node WebSocket/CDP and the installed browser;
no packages are added. It starts the production build with Supabase disabled
and synthetic data in a temporary working directory. It submits actual server
actions and inspects the resulting local store. Re-emerged and legacy scenarios
are constructed through the existing repository, with a synthetic new claim
added only in test setup. Stale rendering is simulated by submitting an old
render token; controlled input preservation is checked in the browser.

## Coverage

| Contract | Verification |
|---|---|
| B1 existing values | Browser verifies 27/30 options |
| B2 choose existing | Browser submission, persisted outcome, supersession, server-boundary unit test |
| B3 first confirmer | Actual assignment action and displayed Finance owner |
| B4 re-emerged confirmer | New owner displayed separately from First owner |
| B5 standing decision | No assignment or decision controls after persistence/reload |
| B6 corrected value | Actual submission creates one HUMAN_DECISION entry for 28 |
| B7 duplicate correction | Normalized full-width 27 with punctuation refused; choose-existing redirect; server unit test |
| B8 previous decision | Explicit browser assertions for prior value, rationale, confirmed-with snapshot, exact formatted persisted timestamp, and Values differ again; current mismatch in Needs a decision, absent from Resolved |
| B9 legacy note | Item, label, and unchanged-Knowledge explanation inside lane-reviewed; absent from lane-resolved; hidden confirmer; exact lane order |
| B10 refusals | Both modes retain all applicable inputs, including existing-value and domain selects; inactive-mode inputs survive mode changes; stale and actual server RATIONALE_REQUIRED refusals; whole store unchanged |
| B11 disabled writes | Browser has no forms; direct boundary tests refuse both mutation types; existing Preview guard regression |
| B12 persisted refresh | Open lane disappears after actual mutation; record survives reload; Memory markers and store checked |

## Routes and screenshots

All captures are from the actual local production build with synthetic demo data.
Desktop: 1440×1100. Mobile: 390×844. Full-page images include fixed navigation at
its viewport position; it scrolls normally in the live app. No mobile horizontal
overflow was detected.

| Screenshot | Route / state |
|---|---|
| [01 actionable](01-actionable-desktop.png) | `/initiatives/merchant-flex-finance/decisions`, existing-value form and assigned confirmer |
| [02 stale](02-stale-input-preserved.png) | Same route, rejected stale submission with input retained |
| [03 standing](03-standing-decision.png) | Same route after choosing 27 and reloading |
| [04 chosen Knowledge](04-chosen-knowledge.png) | `/initiatives/merchant-flex-finance/memory?view=claims` |
| [05 correction](05-corrected-form.png) | Decisions, corrected-value form |
| [06 corrected Knowledge](06-corrected-knowledge.png) | Memory after corrected Decision entry 28 |
| [07 re-emerged](07-reemerged-decision.png) | Decisions, previous decision disclosure and new confirmer |
| [08 mobile](08-reemerged-mobile.png) | Re-emerged decision at 390px |
| [09 legacy](09-legacy-note.png) | Decisions, reviewed note only |
| [10 read-only](10-write-disabled.png) | Decisions with `DEMO_WRITE_ENABLED=false` |
| [11 existing stale mobile](11-stale-existing-mobile.png) | Selected existing value and rationale retained after stale refusal |
| [12 Resolved mobile](12-resolved-mobile.png) | Real decision in Resolved, Reviewed empty |
| [13 corrected stale desktop](13-stale-corrected-desktop.png) | Corrected value, domain, mode and rationale retained |
| [14 corrected stale mobile](14-stale-corrected-mobile.png) | Same stale refusal on mobile |
| [15 server refusal desktop](15-server-refusal-desktop.png) | Actual domain RATIONALE_REQUIRED refusal preserves mixed-domain form |
| [16 server refusal mobile](16-server-refusal-mobile.png) | Same server refusal on mobile |
| [17 Reviewed mobile](17-reviewed-mobile.png) | Legacy note in Reviewed; absent from Resolved |

## Scope and limitations

No hosted Supabase access, migration application, deploy, merge, IA consolidation,
Stage 2.3, or Stage 2.4 work. The existing demo actor is used; authentication is
unchanged. Browser integration exercises the local adapter; the SQL gate covers
database behavior. The latest decision is displayed from persisted state, and
the existing activity log retains earlier decision cycles without a new history
storage mechanism.

## Final gate result

Passed: 94 unit tests, 2 local adapter tests, all Stage 2.2 SQL tests and both
decision races, committed rollback/reapply, Stage 2.1 SQL and concurrency on
0008/0009, browser scenarios B1–B12, typecheck, lint, and build. The golden
fingerprint remains f2f628a25ea8bcf38ef8db92896bbcc1f61b20e159c3d7635ed85c98dd84f5ca.

The remediation reruns the same complete final gate under PowerShell 7. No gate is skipped.

## Changed files in this remediation

- docs/ui-review/stage2-2/01-actionable-desktop.png
- docs/ui-review/stage2-2/02-stale-input-preserved.png
- docs/ui-review/stage2-2/03-standing-decision.png
- docs/ui-review/stage2-2/04-chosen-knowledge.png
- docs/ui-review/stage2-2/05-corrected-form.png
- docs/ui-review/stage2-2/07-reemerged-decision.png
- docs/ui-review/stage2-2/08-reemerged-mobile.png
- docs/ui-review/stage2-2/09-legacy-note.png
- docs/ui-review/stage2-2/10-write-disabled.png
- docs/ui-review/stage2-2/11-stale-existing-mobile.png
- docs/ui-review/stage2-2/12-resolved-mobile.png
- docs/ui-review/stage2-2/13-stale-corrected-desktop.png
- docs/ui-review/stage2-2/14-stale-corrected-mobile.png
- docs/ui-review/stage2-2/15-server-refusal-desktop.png
- docs/ui-review/stage2-2/16-server-refusal-mobile.png
- docs/ui-review/stage2-2/17-reviewed-mobile.png
- docs/ui-review/stage2-2/README.md
- scripts/ui-test/run.mjs
- scripts/ui-test/seed.mjs
- src/app/initiatives/[slug]/decisions/page.tsx
- src/components/initiative/DecideConflictForm.tsx
