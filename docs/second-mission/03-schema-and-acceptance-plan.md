# Second Mission schema risks and acceptance plan

Research only; no schema or application changes implemented. Setup addendum is now received in the canonical scope. Await the complete Claude contract before assigning migration contents/numbers.

## Conflicts to resolve before implementation

1. **Owner duplication:** `delivery.facts` already contains canonical OWNER facts, including provenance and revision events. New Setup/Ownership surfaces must call this model. A new `initiatives.owner_id` would silently diverge from Weekly and filters.
2. **Setup versus lifecycle:** current `deriveSetup` measures evidence/knowledge/confirmation coverage; `initiatives.stage` is a separately confirmed lifecycle value. An initiative may legitimately be in Delivery with incomplete evidence coverage. The approved Ready for Intelligence state describes setup coverage, never delivery readiness, release approval or health. Known versus explicitly Unknown target/milestone must remain different from unanswered.
3. **Creation permissions:** creation currently uses business-write permission; stage changes require assigned PM or organization administration. A resumable Setup flow needs an explicit authority policy for a newly created, unassigned initiative, without granting arbitrary edit rights across all initiatives. Resolve this in the UX/data contract.
4. **Source connections:** MANUAL source records are real; CONNECTED is not proof of a working connector. No connector credentials or network access belong in this mission. Preserve known references as hints until a person maps actual evidence. The received addendum explicitly requires many-to-many structured source mapping and an initiative/source-centric round trip. Existing initiative-owned evidence cannot simply be reassigned; retain historical anchors and introduce shared source identity with scoped mappings.
5. **Decision state compatibility:** `applyFindingStates` currently recognizes only RESOLVED, with a separate real-decision re-emergence path. Extending the union alone would falsely render DEFERRED/DISMISSED as OPEN. Update state merge, queue counts, tabs, immutable history, repositories and database constraints together; preserve note-only versus Knowledge-changing outcomes.
6. **Digest parity:** SQL `decision_hash(text[])` hashes an ordered length-prefixed UTF-16LE sequence. The `resolve_conflict` SQL function constructs the digest array independently of TypeScript `contentDigestOf`. Effective date/context changes require both matching comparison gates and identical serialization, including nulls, Unicode and evidence member order. Do not merely change the hash primitive.
7. **Old decisions and Finals:** introduce explicit compatibility for legacy missing context/digests. Do not bulk rewrite prior finalized snapshots or silently restate previously accepted decisions under a different comparison scope.
8. **Confirmation transaction:** Knowledge lives in the product repository; delivery and Weekly use a separate aggregate. A proposal must not be marked confirmed while its canonical write failed, or create duplicates on retry. Use server transaction/idempotency appropriate to each canonical target and reject stale evidence, target revision, membership or organization context.
9. **Local/hosted parity:** local JSON persistence is not serverless-safe. Any new operational record needs durable hosted schema plus the same local behavior and test contract. No successful deployment claim from local-only persistence.
10. **Risk/dependency overlap:** existing Knowledge claim types include RISK/DEPENDENCY. Structured risks, questions and initiative links require explicit canonical routing and provenance references; do not publish one confirmed proposal into two disconnected truth stores.

## Planned migration verification

- Append migrations after the accepted 0019 baseline; never edit applied history.
- One integration owner for migration ordering. Enum additions must be committed before use if PostgreSQL requires it.
- Test fresh replay and additive upgrade from accepted schema on disposable local PostgreSQL.
- Verify original initiative IDs/slugs, memberships, claims, source links, delivery revisions and Final object hashes before/after.
- Deny direct anon/authenticated table access under existing model; service-role functions must validate scoped actor/target and fresh write authority.
- Reject cross-organization owner/evidence/action/relationship IDs, forged workspace inputs, Viewer writes and guest access beyond Demo.
- Verify double-confirm/retry behavior, concurrent confirmation, stale membership and stale-source failures.
- No hosted migration application in this mission before final checkpoint.

## Required acceptance stories

| Capability | Required behavior to prove |
|---|---|
| Setup / lifecycle | Addendum-defined create/resume/edit lifecycle journey; honest unknowns; source mapping; stable identity and scope; independent setup/stage semantics |
| Ownership | Assign active scoped owner; persist history; update Home/Brief/filter/Weekly; no competing owner source |
| Commitments | Explicit create/status changes with actor and evidence; due/unknown dates; carry open work forward; completed work appears as change |
| Evidence proposals | Exact supporting excerpt retained; AI produces proposals only; confirm/reject individually; material edit uses Human Entry; stale/retry protection |
| Queue completeness | Deferred/Dismissed remain distinct from Resolved; unchanged digest retains disposition; changed support reopens with history |
| Minimum context | Incompatible phases/effective context do not conflict; unknown remains unknown; SQL/TypeScript parity and chronology regressions |
| Meetings | Retained source feeds the same proposal and canonical confirmation paths, without a separate summary database |
| Relationships | Scoped evidence-backed links; self/cycle policy explicit in contract; reverse BLOCKS derived; no invented schedule impact |
| History | Ordered meaningful events with actor/source; corrections and reopened work understandable; bounded loading, not raw audit dump |
| Risks/questions | Canonical status/owner/source and resolution; visible in Brief/Home/Weekly; no redundant global module |

For each interaction: 390/768/1024/1440, keyboard/focus, error/loading/empty/read-only/stale states, contrast and reduced motion. Test complete evidence-to-truth-to-action-to-Weekly-to-history story with synthetic Demo data, then fresh independent browser red-team. Capture actual screenshots for Claude; do not substitute code review.

## Latest user clarifications to include in frozen contract

- Persistent, visible Manage Initiative / Settings entry within the initiative: Basics, owner, scope, delivery, source management and archive must be discoverable without an obscure menu.
- Permission matrix for every new write, enforced in the server/repository and tested against all existing roles. No new roles. Product Lead remains the already-existing capability with its limited authority, not a new role or general fact privilege.
- Version checks and deterministic concurrent conflict handling for metadata, owner, dates, decision states, mappings, confirmation and commitments. Conflict UI retains unsaved input and explains reload/review rather than silently overwriting.
- Scope-aware search and contextual links must connect Source, Initiative, Decision, Action, Weekly Review and History without adding global navigation modules.

## Performance plan

Retain accepted measurements from the research ledger. Compare same dataset, viewport, server mode and completion criterion. Measure Home→Analysis explicitly; add proposal review and paginated history measurements. Bound extraction text/proposal count and AI output, avoid synchronous blocking of the full page, retain navigation shell and show honest progress/failure. No speculative cross-request auth cache.

## Design skill use

Read frontend-design and ui-ux-pro-max. The targeted progressive-disclosure search returned off-topic typography advice even after a narrower retry; no matching guidance was adopted. Use existing Prodwise tokens and the skill's general form/focus/accessibility principles as fallback, with Claude's product-specific contract controlling interaction design.
