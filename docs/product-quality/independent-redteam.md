# Independent browser redteam — current mission

Reviewed 27 September 2026. Verdict: **PASS with one nonblocking minor usability finding.** No blocker or major defect was reproduced in the tested journeys. The Second Mission was not started.

The reviewer did not design or implement these features. This conclusion comes from independent browser navigation, form interaction, saved local records, keyboard use and visual inspection. Other agents' acceptance reports, unit results and screenshots were not used to infer that a journey passed. Existing harness files were consulted for browser startup, hydration and safe fixture conventions.

## Scope and evidence

- Latest local application: `http://localhost:3216`.
- Actual credential-free **Explore Demo** (server-side guest session, not Supabase anonymous sign-in): local hosted-data candidate `http://localhost:3215`; no production browsing or hosted business submissions.
- Registered synthetic Demo, existing local Owner/PM/Viewer accounts, and four new isolated identities in **Independent Review Lab**. **Independent Empty Lab** supplied an empty second organization for context isolation.
- **49 baseline page/viewport observations**: 13 registered-Demo desktop routes, eight routes at each of 390/768/1024 pixels, and 12 role/administration views. All 49 reported no horizontal document overflow and no browser page errors. Additional interactive captures include mobile metric lower sections and sensitive policy previews at 390/768/1024/1440 pixels.
- **109 private screenshots** were retained, including intermediate diagnostic captures; this is an evidence inventory, not a claim of 109 distinct acceptance tests. The representative screenshots cited below were visually inspected. Raw evidence is in `.data/product-quality/independent/` and must remain private rather than being published with credentials or fixture data.
- Navigation waits included a rendered heading, the application hydration marker and two animation frames. Final verification also waited for the exact destination or server response where client navigation initially caused premature assertions.

## Confirmed finding

### IR-01 — Minor: returning to the initiative register loses the selected filters

**Task:** A CEO or Product Lead narrows attention items to one business line, inspects its initiative, and returns to continue the same review.

**Reproduction:** In registered Demo, open Home's “3 need attention (5 reasons)” link. In Initiatives select business line **MF**, retain **Any reason**, and apply. The register shows **1 of 8 initiatives**. Open **Merchant Flex Finance**, then use the **Initiatives** breadcrumb.

**Observed:** The breadcrumb targets `/initiatives`; the returned register contains all eight initiatives. The attention and business-line filters are lost. This was reproduced after waiting for the return navigation to complete.

**Expected:** The in-product return link should preserve the register context so the reviewer can continue the filtered task. Browser Back is an available workaround, so this is nonblocking.

**Evidence:** `.data/product-quality/independent/journey-filtered-brief.png`; `interactions.json`, check “Register combined filter and return” (recorded destination `/initiatives`). This was the only initial failed assertion retained as a product finding.

## Journey results

| Goal and perspective | Observed result | Evidence in the private evidence directory |
|---|---|---|
| CEO: identify what needs attention | Home distinguishes three initiatives from five reasons. Its attention link returns exactly three matching initiatives. Explanations distinguish recorded blockers, differing values and dates that need an update. | `demo-home-1440.png`, `attention-drilldown.png`, `focused.json` |
| Product Lead: narrow the register | Combined filters work; the zero-count Monitoring drilldown gives a clear empty result and Clear filters. Returning from Brief loses the register filters (IR-01). | `zero-stage-results.png`, `journey-filtered-brief.png` |
| PM: understand an initiative | Brief exposes current scope, owner, next step, delivery facts and named attention reasons. Mobile Brief preserves these distinctions without page overflow. | `demo-brief-390.png` |
| Lead: compare a decision and inspect evidence | Expanded 27/30 source panels expose the two references, source dates and provenance. “Why raised” explains a recorded-value difference without claiming a proven business contradiction. History clearly shows the replaced financing value separately from active work. | `decision-comparison-expanded.png`, `decision-history.png` |
| PM: traverse Sources and Knowledge | Opened the Daily Repayment Requirement source detail and followed its linked Knowledge entry. The resulting URL retained the exact `#claim-…` anchor. Earlier attempts to click its collapsed, invisible link were harness mistakes. | `source-detail-expanded.png`, `source-knowledge-completed.png`, `remaining.json` |
| CEO: inspect roadmap uncertainty | “No Target Live” returns Agent Cash-In Network and Merchant KYC Refresh. Unknown dates remain unknown; no failed-launch conclusion is imposed. | `roadmap-unknown.png` |
| Lead: distinguish portfolio counts from project measurement | Portfolio definitions and stage drilldowns work. Configured measurement filters to Tap-to-Pay, whose detail exposes definition, evidence, target approval, period and freshness. The missing observation reads “Not observed”; its unapproved target reads “No target approved.” Source navigation and return preserve the measurement filter. | `portfolio-method.png`, `metric-lower-390.png`, `metric-evidence-390.png`, `focused.json` |
| Assigned PM: save commentary separately from facts | Saved new commentary without changing canonical facts. A two-field update preview could be cancelled without saving; confirming it changed only the chosen target/next-step records, preserved commentary and required re-check. Brief, Home and Roadmap reflected the confirmed date. An unassigned PM correctly lacked section/fact authority. | `pm-update-preview.png`, `pm-update-applied.png`, `pm-updated-roadmap.png`; persisted disposable fixture and `weekly-close.json` |
| Product Lead: finish the weekly lifecycle | All eight sections were saved/reviewed. A Member with Product Lead capability finalized only the new disposable W39. The Final records the actor and previous W38 baseline, presents no commentary editors, and offers a separate read-only full document. W40 preparation is disabled with the real start date, 28 September. | `lead-account-verified.png`, `full-document-verified.png`, `final-receipt-verified.png`, `weekly-close.json` |
| PM/Lead: correct a record after Final | Saved a new current next step after Final. The since-Final view showed the exact change and explicitly said “not a review.” The saved W39 continued to show the earlier next step; both W38 and W39 remained byte-equivalent as serialized review objects. | `post-final-real-change.png`, `final-after-current-correction.png`, `final-verification.json` |
| Viewer: read without editing | Viewer can read Final and account context, with no review/record mutation controls in the tested Final view. | `viewer-final-verified.png`, `viewer-account-verified.png` |
| Platform Owner: find people and control scope | Organization search, organization/Member filtering and person detail work. Product Lead capability is separate from platform authority. “Open this organization” changes Home's context; the empty organization contains none of the other scope's initiatives. | `admin-organizations-filter-verified.png`, `admin-people-filter-verified.png`, `admin-lead-person-verified.png`, `admin-correct-context.png`, `admin-empty-home.png` |
| Platform Owner: review sensitive changes | Policy and replacement-owner previews identify the organization, previous/proposed values and affected people. Policy preview receives focus. Keep editing retains inputs, and revisiting policy confirms no preview was saved. Replacement-owner preview was cancelled without submission. Mobile policy preview is readable and scrollable. | `policy-review-visible-390.png`, `owner-replacement-preview.png`, `admin.json`, `remaining.json` |
| First-time guest: enter Demo and understand account limits | Actual Explore Demo enters the existing four-initiative hosted Demo. Account describes a shared synthetic session and omits password editing. Administration routes show access restriction; no organization chooser is exposed. Forged AMAN organization/workspace query values return the same four-item Demo navigation and leave the UI in Prodwise Demo. | `guest-account.png`, `guest-platform-denied.png`, `guest-forged-aman-scope.png`, `guest-isolation.json` |
| Keyboard and orientation | First Tab exposes Skip to main content, and Enter focuses main. Mobile Filters opens with focus, retains native dialog containment on reverse Tab, closes with Escape and restores the Filters button. Help opens and closes with Escape. Home gives a concrete synthetic starting scenario. | `report.json`, `mobile-filter-open.png`, `help-open.png`, `finish-navigation.json` |

## Preservation and limits

All browser business writes were confined to the newly created **Independent Review Lab**. They consisted of commentary, two explicit fact confirmations, reviewing its eight sections, its new W39 Final, and one later current-record correction. Fixture preparation established its assigned PM/Product Lead separately. Existing Interface Lab Finals were not reset or edited. Foreign delivery files were hash-checked unchanged through finalization and the later correction; the new fixture's prior W38 Final was also preserved.

The final critical verification files contain **nine passing checks** in total: six in `weekly-close.json`, two in `final-verification.json`, and one in `guest-isolation.json`, with no browser page errors. This count excludes exploratory harness checks and does not replace the journey detail above.

Earlier raw scripts contain false negatives from premature client-render reads, ambiguous accessible-label selectors, collapsed source details, a native `<dialog>` incorrectly checked only as `[role=dialog]`, and a fixture initially assigned to the other reviewer. These were resolved with explicit navigation/form completion waits, actual detail expansion, correct native-dialog inspection and scoped fixture preparation. In particular, a transient disabled Final assertion was **not** reproduced after a complete render: all prerequisites were Met, and actual finalization succeeded. Those raw failures are not product defects.

Guest business forms are intentionally operational inside Demo. The test's read-only guard was a data-protection constraint, not a product requirement; enabled guest Save/Claude controls are **not** findings. No hosted business mutation, AI generation, password change, invitation send, policy commit or owner replacement was exercised. The hosted candidate has four existing Demo initiatives and an older installed schema; the richer eight-initiative measurement and saved-lifecycle journeys were evaluated locally. This review does not establish a hosted migration or production-deployment pass.

The broad read-only request guard blocked one organization-chooser server-action request during an early account check. No business change resulted. Completed context switching was verified through the actual “Open this organization” action; a full chooser selection journey is not claimed.

No application source was modified by this reviewer. All browser scripts have stopped; no review write or submission is pending.
