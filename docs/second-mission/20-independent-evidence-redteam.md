# Independent Anchored Evidence red-team

## Scoped verdict: PASS

No blocker or major finding was identified in the executed Anchored Evidence checks. This is a local, scoped browser verdict after Claude's round-4 rendered approval, not final Second Mission or production acceptance.

## Executed trust and authorization checks

- Created new synthetic evidence through the browser in Independent Review Lab. Real Claude generated pending proposals; no canonical results existed before human confirmation. Every persisted anchor's offset slice exactly matched the immutable saved text.
- Viewer workbench exposed no read/confirm/batch write controls. A direct STOP API call returned **403**. Replaying a genuine confirmation server action under the Viewer session produced an access refusal.
- Material wording changing divisor 27 to 30 was refused as a cosmetic edit, while the proposed text stayed in the form.
- Explicit human replacement was recorded as `SUPERSEDED_BY_HUMAN_ENTRY`; its Knowledge result had neither an AI anchor nor a claim-evidence association.
- A genuine two-tab race rejected one selected proposal before the first tab submitted its batch. The batch reported **1 confirmed / 1 not confirmed**, identifying the stale proposal separately. The accepted item had its own result link.
- Replaying the identical batch request created **one receipt per accepted proposal**, with no duplicate canonical result.
- Existing Demo account could not open a Lab evidence deep link and could not STOP a Lab attempt by identifier (**403**). No Lab evidence body was displayed.
- STOP during a real reading attempt preserved the original text, recorded STOPPED, and prevented proposal persistence. Retry used the same submission, created a second attempt, and returned an honest **No supported proposals found** result for placeholder-only evidence.

## Interaction / rendered checks

- 390 / 768 / 1024 / 1440: no horizontal overflow; axe WCAG 2 A/AA + 2.1 AA returned **zero violations** at every width.
- Last pending card's confirmation button was scrolled into view, focused, and verified by center-point hit testing at all four widths. The sticky batch toolbar did not obscure it.
- Mobile Highlight in original evidence moved focus to the exact quote. Back to proposal restored focus to the originating card.

The evidence comprises **27 successful substantive checks/observations** across the initial trust run, completed browser interactions, partial-batch/idempotency run, isolation/STOP run, and toolbar check. This is not a replacement for the repository's final unit/E2E count.

## Evidence and fixture boundary

Private QA results/scripts:

- `.data/second-mission/independent-evidence-redteam.json` and corresponding initial/resume scripts
- `.data/second-mission/independent-evidence-extra.json`
- `.data/second-mission/independent-evidence-stop-isolation.json`
- `.data/second-mission/independent-evidence-toolbar.json`
- `.data/second-mission/redteam-evidence-{390,768,1024,1440}.png`

Own synthetic submissions: `cdf7620c-de10-468a-a3ee-e080c21159a4`, `7f9dd6d4-a0ee-4956-855a-007524bb1c13`, and STOP/empty `f38c2e38-dac5-43a7-b9e5-77acc5c2994c`. All under the existing synthetic progressive setup initiative in Independent Review Lab. The rendered-review fixtures were not mutated.

No app code, schema, AMAN record, production configuration, deployment, or commit was changed. Credentials stayed private; screenshots mask email addresses. The browser blocked non-local requests; local server-side Claude calls contained only synthetic test text.

## Harness corrections and limits

Confirmed results move into collapsed handled history. Early harness runs waited for a visible result link and timed out; subsequent checks used saved state / the appropriate collapsed-history inspection. One individual-confirmation assertion read a pre-completion receipt count and reported false; after completion the stored result had exactly one receipt and one canonical commitment. The independently awaited batch-replay test conclusively passed idempotency. The earlier false assertion is retained in raw output for transparency and is not a product defect.

Explore Demo did not complete in this local test configuration. Isolation was instead tested using the already-provisioned private Demo account. No guest-entry configuration was altered; guest login itself is outside this scoped evidence review.

This review proves the stated browser/server-action paths locally. It does not independently establish hosted database RLS, every role combination, performance baselines, production AI configuration, or the later whole-mission operating loop. Those remain final integration gates.
