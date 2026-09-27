# Second Mission engineering ledger

Baseline remains 4623810ddcb28382e79cbb3dcae8c01b7d966f3e on prodwise/core-operating-loop. No push/deployment. All changes uncommitted. Full mission must continue through P0/P1 and acceptance; this ledger is not a completion checkpoint.

## P0-1/2 in progress

- Frozen contracts: Claude 02 plus binding A1 (04). All later contracts still drafts.
- Implemented: visible Manage, basics, controlled contexts, structured source mapping/revision/unlink/relink, contextual source route; atomic creation + OWNER fact + optional context; progressive Setup routes; explicit Unknown delivery setup; archive/restore with old-path SQL/local guards; active/archived register; independent setup/attention in Brief; archived removed from Home attention and Roadmap.
- Creation uses PostgreSQL transaction and idempotency record. Local-only paired-file command journal, under delivery lock, rolls forward before product reads after an interrupted write. No extra owner column.
- Archive transition: weeklySnapshots includes archive transition once before excluding it from later active sections; frozen full source remains for audit. SQL section inventory mirrors this. Needs additional weekly regression tests.
- SQL migrations 0020–0027 local drafts, applied only to disposable databases. Through 0023 fresh replay passed. 0024/25 creation/Unknown tests PASS. 0026 archive guards/preservation tests PASS. 0027 applied, further tests pending.
- Unit suite last completed: 246 tests, 245 pass; only journal fsync failed on Windows read-only descriptor. Fixed by opening writable descriptor before fsync; rerun required. Added another archive portfolio test afterward.
- TypeScript passed through 0027 changes.
- Browser setup test PASS, nine assertions: Member self-owned create, setup 6/10, explicit unknowns → 8/10, Roadmap handles Unknown, Member cannot archive, admin archive, active-register exclusion, archived discoverability, restore.
- Browser test only in asserted Independent Review Lab; private report .data/second-mission/setup-browser.json. Created synthetic initiative /initiatives/synthetic-progressive-setup-1790528172302-de8975f5, restored to active at test end.
- Screenshots .data/second-mission/create-{390,768,1024,1440}.png and archive-confirmation.png. No rendered Claude verdict yet.

## Still required before P0-1/2 acceptance

Archive confirmation must match native alertdialog/focus contract (currently inline). Add archive header/read-only explanations/search tag; meaningful source links from detail (including map another initiative); dedicated owner-change entry; setup stepper focus/mobile refinements; readiness reached/lost immutable events and full Ready/regression story; stale conflict UX preserving user input, full permission matrix/tests; expose explicit Unknown editing outside setup without inconsistent labels. Check latest contextual source/evidence round trip. Test hosted RPC parity and archive weekly inventory/Final preservation, concurrency and old write paths. Run rendered Claude review and independent reviewer only after Claude approval. No capability currently marked complete.

## Later mission

Freeze contracts for Actions, AI proposals, Queue completeness and minimum context before implementing; P0 integration review; then freeze/implement Meeting intelligence, relationships, History, risks/questions. Extend Demo only. Complete full loop, org isolation, accessibility, responsive, performance, build/test/review gates, stable commit and clean tree. Stop only at final pre-deployment checkpoint.

## Continuation 27 September — still in progress

- Unit suite 250/250 passed after readiness-transition tests and immutable Weekly archive baseline test. Current webpack build passed before latest visual fixes/commitment scaffolding. Typecheck most recently fixed an EvidenceRecord typing mismatch; rerun pending.
- P0 contracts 3–6 frozen in 06; P1 7–9 in 07; P1-10 in 08. API limits truncated multi-capability replies: retained only complete sections with explicit freeze verdicts, then separately completed remaining contract. No rendered approval inferred.
- Claude rendered review round 1 in 09: REVISE. Fixed mobile sticky controls overlap, invalid --s-7 token causing missing padding, legacy editable scope in Setup (now controlled ContextManager plus read-only delivery scope), duplicate legacy-context prompt, owner prominence/history link, checklist missing/Unknown styles, raw stage enum, and wrong Brief active tab. Added independent Setup/Attention header links; their mobile visibility was fixed after first recapture. Latest screenshot set needs final recapture after that last header fix and resubmission to Claude. Missing-state screenshots remain.
- Archive now native modal alertdialog with focus/escape handling. Existing nine browser assertions pass. Direct owner editor added; unchanged role policy. Contextual source detail now maps existing source into another active initiative via guarded server command.
- Setup readiness now requires an ACTIVE *verified* claim; unverified legacy ACTIVE no longer meets R8. Explicit Unknown supported in FactLedger too; Weekly labels distinguish it.
- Added readiness history transitions locally inside product/delivery paired persistence; 0028 deferred SQL triggers create same transitions without storing readiness. Applied only disposable DB. Creation SQL test executes deferred triggers and passes. Still need full ready/lost SQL parity and membership-deactivation transition coverage.
- Local full browser ready path PASS (ready-browser.json): 9/10 with unverified claim, 10/10 after human confirmation, back to 9/10 after source unlink, READINESS_REACHED and READINESS_LOST retained. Synthetic Review Lab only. Current test initiative remains active, two retained unlinked synthetic source mappings and two synthetic Knowledge entries (one verified). No production changes.
- New scaffolding ONLY for frozen P0-3: workspace/commitments.ts and data/commitments.ts; StoreShape commitments/events. No SQL/UI yet. Not complete. Need security validation for all origins, idempotency payload integrity, tests, hosted parity before acceptance.
- No push/deploy/commit. No independent review yet (must follow Claude approval). Keep executing full mission; do not issue partial completion checkpoint.
