# Weekly lifecycle and additive Demo implementation

Candidate work only; no production data, schema, provider account or deployment changed by this stream. The functional gate mutated only disposable local **Interface Lab**, leaving the actual local registered Demo intact.

## Delivered behavior

- Weekly Review shows an owner-grouped index and one selected initiative section. Its frozen cutoff record, meeting commentary, and confirmed initiative updates are separate. The full meeting document is read-only.
- Commentary saves and marks a section reviewed. Claude drafting remains secondary, with existing supported-reference validation and human review. Commentary never updates canonical facts.
- A separate confirmation dialog shows current → proposed values, actual basis/source/reason, and consequences before applying stage, a general Knowledge decision, target, actual, milestone, blocker withdrawal or next step. Stage and Knowledge use existing repositories. Delivery fact changes plus Draft refresh share one delivery transaction. Product writes can precede that transaction; partial results are reported and persisted commentary is preserved.
- New decisions create an UNVERIFIED Knowledge entry, link current-scope evidence if selected, re-read its revision, confirm through the existing path, and verify persisted ACTIVE trust before reporting success. A confirmation failure keeps the created record available for recovery; it is not silently recreated or reported complete.
- Every mutation carries a rendered workspace scope and rechecks it against fresh server authority at commit. Finalization has an explicit eight-part checklist, real actor/time/cutoff/baseline receipt, immutable historical snapshot, since-Final comparison, and real-calendar next-week gate. Preparing next week opens its Draft and uses the preceding Final.
- Delivery uses a ledger and one selected editor instead of nine expanded forms. Planned and actual dates remain distinct; milestones can have unknown dates. Scope, assignment, provenance, target revision history and withdrawal remain explicit. The Brief / Delivery relationship and safe return links are visible.

## Synthetic model

`canonicalDemoData` remains the historical V1 factory. `canonicalDemoDataV2` adds four fictional initiatives without altering the first four product rows, existing fact/event prefixes or W38 Final bytes. W39 refresh retains edited commentary and explicitly shows new scope and late-recorded earlier dates.

The active eight-row scenario covers five business lines, seven lifecycle stages, two recorded value differences, two existing blockers, one +7-day target movement, an unassigned discovery initiative, unknown dates, one actual full rollout, and clean records under current checks. Nothing retracts an existing blocker or invents a resolution.

Two persisted synthetic metric definitions have two observations each: median onboarding time with a recorded target and partial-period context, and first transaction within seven days with an unknown target and a NULL observation while the window is incomplete. These are fixture records, not UI defaults or live business results; two points do not justify a trend chart.

## Operator boundaries

`scripts/demo/enrich-demo.mjs` is **plan only**, with no environment, network, provider or DB access and no apply command. It exports:

```text
planDemoEnrichment({identity, storage:'LOCAL'|'POSTGRES',
  registration:{workspaceId,organizationId,canonicalVersion:V1,scenarioAt:cutoff},
  productStore,deliveryState})
renderDemoEnrichmentSql(plan,persistedPlatformActorId)
```

POSTGRES projection matches the original hosted seed, including original frozen scope and source ordering. The plan refuses altered registration, original business/fact/history drift, a changed W38, a finalized W39, or incompatible current input. Actual Draft commentary/AI stays intact.

The reviewed transaction locks only the selected organization/workspace and scoped rows; checks existing typed row values including timestamps, live reviewer binding, W38 JSON, Draft revision/data and absence of metrics; appends new records; refreshes only W39 DRAFT; changes the registration version; and records the real operator audit. It contains no deletion, trigger bypass or Final update. Root owns exact-target verification, capture, review and application.

## Evidence

- New model, Decision and canonical/operator tests pass, covering atomic fact refresh, optimistic rejection, final prerequisites, future/week-year handling, next-Final baseline, post-confirmation persistence, synthetic isolation, exact W38 preservation, NULL metrics and drift refusal.
- Fresh disposable PostgreSQL **0001–0019** replay plus the original hosted V1 seed and additive transaction passed. Every original ID/business field/timestamp and W38 JSON remained unchanged, except the intended W39 Draft refresh. Result: eight initiatives, two definitions, four observations, W38 Final four sections and W39 Draft eight sections. Fresh DB source matched the stored Draft input digest and all eight section digests.
- Local browser gate: nine groups pass, zero page errors. It exercised commentary-only save, explicit five-field confirmation including an EVIDENCE Decision, immediate Brief/Roadmap/Home propagation, eight reviewed sections, actual finalizer attribution, immutable prior/current Finals, next-week refusal before Monday, a post-Final fact correction, since-Final comparison and read-only full document. Receipt and fact editor fit both 1440px and 390px.
- Full TypeScript check and scoped ESLint pass. Root owns the integrated build, broader accessibility/AI gates and any release.

Private evidence: `.data/enrichment-proof/replay.log`, `digest-proof.json`; `.data/product-quality/c-weekly/resume-report.json` and desktop/mobile screenshots. Early harness failures are retained separately: exact label lookup/date spelling errors, and the genuine local nested-read persistence defect subsequently fixed and regression-tested by Root.

## Remaining integration limits

Stage/Knowledge product writes and delivery writes cannot share one cross-repository transaction. The explicit partial-failure and recovery path is therefore required. The SQL enrichment plan must be constructed from a fresh captured V1 target and replayed/reviewed against that target; it is not a general reset or an immutable-Final bypass. Local browser proof does not establish hosted runtime behavior. No existing Demo Final should be finalized or rewritten during pre-release QA.

## Claude rendered corrections (local only)

M1/M2/M5 and the Weekly non-blocking findings are corrected: the page uses Home's gutter/max width, the week state sits alongside its control, and the frozen record has the same bordered treatment and section spacing as commentary and updates. The desktop index no longer has a hidden 70vh boundary; all eight rows, including Unassigned, render. Pending checklist names are visibly underlined links. On tablet/mobile an explicitly selected section collapses the native index while retaining its count and current initiative; desktop remains expanded. Current-input refresh is hidden, and the synthetic Final receipt includes “by”.

Known system template fragments display stage labels and human dates; arbitrary human notes and Knowledge values retain their wording. This rendering never writes archived JSON or changes delivery facts. An explicit Save still records the commentary the reviewer sees. Confirmation renders both current/proposed dates consistently, with singular “Review 1 update” / “Apply 1 update”.

Read-only local browser checks passed at **1440, 768 and 390**: eight index links, collapsed selection where appropriate, readable template/confirmation dates, Final receipt, zero overflow and zero runtime errors. All non-login business requests were blocked by the capture harness; none was attempted. The whole registered Demo delivery file had the same SHA-256 before/after. The initial capture harness attempted interaction before hydration and timed out; the rerun waited for the input handler and passed. No business write occurred on either pass.

**53 targeted unit tests**, typecheck and scoped ESLint passed. The two new display tests prove exact Draft/Final data preservation and unchanged arbitrary human/Knowledge text. Revised screenshots are `docs/ui-review/product-quality/revised-weekly-{draft,confirm,final}-{1440,768,390}.png`; private test details remain in `.data/product-quality/c-weekly-revise/report.json`. These results concern the local candidate, not production.
