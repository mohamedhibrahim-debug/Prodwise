# P0 stable checkpoint

P0-A baseline: 202856aa6bb6d7bcdbe549fbdf8b0818f928c35b. This checkpoint adds anchored Evidence Ingestion, Queue Completeness and Minimum Context. P1 implementation has not started. No push, deployment or production migration was performed.

## Implemented

- Saved immutable pasted evidence before Claude reading; exact UTF-16 quotes/hash; explicit independent confirmations; unverified Knowledge, delivery revision checks and Actions; cosmetic-only editing; human replacements without AI provenance; stop/retry and idempotent receipts.
- Open / Deferred / Dismissed / Resolved / History queue with append-only reasons, date/next-Final deferrals, immutable withdrawal, evidence-digest reopening, concurrency guards, shared attention counts and frozen Weekly disposition summaries.
- Controlled initiative contexts and date-only applicability on Knowledge, delivery and proposal confirmation; conservative comparison; informational not-compared projection; context-aware SQL/TypeScript fingerprint and digest; human applicability revisions supersede old Knowledge atomically and require verification. Existing null baselines and old Finals retained.

## Validation

- Full unit suite: 275/275 pass.
- Fresh webpack production build: pass. Typecheck: pass.
- Disposable fresh migration replay 0001–0033: pass. Existing setup/source/archive/commitment/Evidence proofs pass, original business fields/IDs/timestamps/Final retained.
- Queue SQL: retry, stale digest/latest, immutable dispositions, authorization, next-Final expiration, archived-write denial and shared source projection pass.
- Minimum Context SQL: scoped comparisons, confirmer assignment, real human decision, safe supersession, stale retry and direct applicability-mutation denial pass.
- 20 TS/Postgres digest fixtures pass, including emoji, null/null and date-only timezone checks.
- Context browser: 5/5 pass, including current-context prefill, date preservation, unverified supersession, cleared context and mobile overflow.
- Evidence: real Claude grounding and independent browser red-team PASS, no blocker/major. Four widths have zero axe violations/overflow. Rendered Claude round4 APPROVE covers visible Evidence states before the subsequent applicability row; the combined P0 rendered acceptance remains pending.
- Queue browser: lifecycle/counts,390px sheets, Viewer controls and stale reason/actor-time retention pass. See the companion Queue checkpoint report; interrupted HMR harness attempts are retained transparently.

Private logs and fixture artifacts remain ignored under .data/second-mission. .env.local remains ignored; no key or private credential was committed.

## Remaining acceptance work

This is a stable local implementation checkpoint, not production approval. Queue and Minimum Context still require rendered Claude UX acceptance and independent complete interaction/a11y review; full P0 operating-loop/performance/Demo acceptance and broad regression gates remain. Hosted end-to-end verification has not been run. Historic decisions/Finals are protected by additive migrations and preservation tests; no production data was accessed.

P1 must not start until the user resumes it. Do not deploy this checkpoint.


