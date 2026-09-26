# Final delivery, Roadmap and Weekly Review model

The delivery record is the only source for the Roadmap. Users confirm initiative facts; they never draw or separately maintain timeline bars.

## Recorded delivery truth

| Field | Meaning |
| --- | --- |
| Initiative / business line / lifecycle stage | Current initiative identity and recorded lifecycle stage. Stage alone does not prove readiness or live status. |
| Responsible PM | Active organization member assigned to maintain the initiative's section. |
| Scope | Exact phase, pilot or rollout to which the delivery facts apply. Required before recording scoped dates. |
| Solution baseline confirmed | Optional actual date a human confirmed the named scope's agreed requirements and proposed approach were sufficiently recorded for implementation planning. Not development start, readiness or launch approval. |
| Development Start | Actual date implementation began in the recorded scope, if known. No future estimated start is stored as actual. |
| Target Live | Current committed production target recorded or confirmed by a human. Planned date, distinct from Actual Live. |
| Actual Live | Confirmed first production live date for real users in the recorded scope, with partial/full extent. Partial rollout includes its explicit scope description. |
| Next milestone | A concrete next checkpoint and its planned date, if known. A known checkpoint can have an unknown date. |
| Blocker / attention and next step | Human-recorded notes; absence does not establish that no blocker exists. |
| Confirmation | Human identity, timestamp, basis, reason and linked current-scope evidence/location where available. |

Every fact has an optimistic revision. Every confirmation/revision/withdrawal appends an immutable event containing previous and new values. A scope change cannot silently reuse facts from the old scope: withdraw those facts first. Target revision history includes the first record, changed dates, reconfirmations and withdrawals. A same-date reconfirmation is retained in history but is not counted as a date movement.

## Roadmap semantics and composition

A grouped schedule presents initiative identity/current scope, actual Development Start, planned Target Live, actual first live, next milestone and next step. The timeline is derived from recorded dates, with an open target diamond and a filled actual marker; bars are timing intervals, never progress or forecasts. Each initiative links to its maintained delivery record.

The selected cutoff defaults to today's Cairo date for ordinary workspaces, and to the visibly labelled fixed scenario date for registered synthetic Demo workspaces. A passed target without an Actual Live record is labelled **Past target · update needed**, with the days since the target. It requests confirmation and does not claim a missed launch, failed initiative or non-live product. A full-scope Actual Live on or before the cutoff settles the timing question. Partial live keeps remaining-scope attention visible; a date after the cutoff is labelled as recorded after cutoff. A scope change suppresses like-for-like target-day comparisons across different scopes while retaining every revision. No target is explicit **Unscheduled**. Missing date remains **Unknown** or **Not recorded**. Changing cutoff assesses today's recorded facts against that date; it does not pretend to reconstruct historical facts.

Business line, owner and attention filters are available. Chronological target sorting leaves unknown targets at the end. Target changes link directly to the retained history. Confirmation details preserve source, human confirmer and update date. Supporting evidence changes raise a review cue rather than silently rewriting human truth.

## Shared Weekly Product Review

One review exists per workspace and ISO week. The week labels the meeting; the snapshot cutoff is separately recorded. One full-portfolio artifact groups initiative sections by responsible PM. The comparison baseline is the latest earlier **Final** review in the same workspace/organization scope, including across skipped weeks. Drafts and foreign workspace reviews are not baselines. A first review explicitly states there is no previous Final.

Each initiative section shows status headline, changes, attention/blockers, decisions needed, target movement, next milestone and next step. Supported templates derive status from recorded lifecycle/scope only, list open deterministic value differences, and state unknown/absent information honestly. PM narrative never changes confirmed delivery facts. The target movement lane is computed from the frozen input and baseline, not from editable prose.

PMs edit their assigned sections; Org Owner/Admin/Product Lead can coordinate and finalize. Global Platform Owner authority remains inherited from the integrated authorization layer. Every section must be explicitly saved by a human. Input or baseline changes require refresh and re-review of affected sections. Independent PM edits use per-section revisions. Final is immutable: snapshot, original AI wording and baseline remain preserved. Corrections go in a later review. **Final is a meeting record, not business or release approval.**

## Claude boundary

The proven provider integration and strict extractive validator are preserved. Claude selects supported source statements with reference IDs; it cannot invent dates, health, decisions or performance. AI output remains labelled and requires human review. Unknown inputs are not filled by inference. The template fallback remains distinct from a successful Claude response, and no AI action mutates confirmed delivery truth.

## Validation

The complete integrated gates, including scoped history, partial rollout, cutoff boundaries, previous-Final selection, immutable snapshots and timeout fallback, are recorded in [FINAL-LOCAL-GATES.md](FINAL-LOCAL-GATES.md). Final synthetic reviewer browser evidence is in [the Demo gallery](ui-review/final-demo/README.md).

The delivery semantics retain the existing append-only model. Integration migrations 0013/0014 add cross-workspace foreign-key enforcement, explicit synthetic scenario registration and non-destructive Demo generation retirement; they do not erase historical facts or Final reviews.
