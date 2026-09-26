I found 17 issues across the three areas you asked about. The six P0 items should be fixed before the reviewer demo. This was a read-only review: I ran nothing, didn't read `.env` or data files, and couldn't save a file this session, so the findings are below. Items marked "integration gate" depend on the workspace-selection and scoped Delivery storage work Root is integrating; they are conditions to verify, not proven defects.

## P0: before the reviewer demo

**1. A partial launch hides the past-target warning.**
- Home (`src/app/page.tsx:27`, `:31`) and `deliveryTiming` (`src/lib/delivery/roadmap.ts:12`) treat any Actual Live record, including a partial rollout, as settled.
- The Analysis copy says a target needs an update until a *full* launch is confirmed. So a partial pilot silently clears "Past target · update needed" and drops out of "Coming up".
- **Acceptance:** one shared rule decides "live for this scope". A partial record shows "Partial live · {rollout} · full launch not recorded", and a past target with only a partial actual stays flagged on Home, Roadmap and Analysis. Unit tests cover full, partial and none.

**2. Demo fixture facts are credited to the reviewer.**
- `src/lib/demo/canonical.ts:55–60` records every synthetic fact, and finalizes the W38 baseline review, as "Demo Reviewer".
- As a result, Roadmap confirmation details (`roadmap/page.tsx:46`), Home "What changed" (`page.tsx:58`) and Weekly "Finalized by" all tell the reviewer they confirmed dates and finalized a review they never saw.
- **Acceptance:** fixture writes use a separate label, "Synthetic demo fixture", with no member id. A test asserts that no fixture fact or event carries the reviewer's user or member id.

**3. The demo story changes with the real date.**
- Home, Roadmap and Analysis use the current date, but the scenario is frozen at 26 Sep 2026.
- After 28–29 Sep and 8 Oct, the planned milestones and the MFF target turn into past targets and drop out of "Coming up". A reset on a later day tells a different story.
- **Acceptance:** either the demo org reads a stored scenario date, visibly labelled ("Scenario date · 26 Sep 2026"), or reset re-bases every fixture date to the reset day. A test shows the walkthrough's attention items are the same on any reset day.

**4. Integration gate: which workspace a session sees.**
- `PLATFORM-AUTHORITY-CONTRACT.md` says the MVP has "one configured product workspace". A separate Demo org only works if the workspace comes from the session's membership.
- **Acceptance:**
  - A reviewer with one active membership (Demo) always lands in the Demo workspace.
  - Any request carrying another workspace or initiative id is refused.
  - `listRecentActivity` (Home, `page.tsx:18`) is limited to the org in the query itself, not filtered afterwards.
  - The reviewer's lack of AMAN membership and platform role is checked at runtime, not only inside the reset guard.

**5. The demo reset guard trusts the org name.**
- `assertDemoResetTarget` (`canonical.ts:111–115`) accepts the org if it is named "Prodwise Demo" and matches ids the caller supplies. It checks only the reviewer's platform role, not their other memberships.
- **Acceptance:**
  - The demo org is identified by a stored, unchangeable flag or a server-pinned id, never by name.
  - Reset refuses if the reviewer has any non-demo membership, or if any demo member is a Platform Owner or belongs to AMAN.
  - Reset never removes the org's last active owner.

**6. The demo `ORG_OWNER` role can do more than the walkthrough needs.**
- Org owner includes invitations and policy administration, so a shared demo login could invite real outside email addresses or change the org's domain policy.
- **Acceptance:** in the demo org, invitations, policy edits and owner management are refused server-side with a clear message. Decisions, delivery facts and the Weekly Review stay allowed. "At least one active owner; several allowed" still holds.

## P1: Delivery truth and Weekly Review

**7. Target history mixes scopes.**
- Changing scope forces the old facts to be withdrawn (`model.ts:87–88`), and the new scope's targets are added to the same history (`roadmap.ts:19–27`).
- Movement counts ("N target changes", "revisions in 28 days") then mix Phase 1 and Phase 2 targets and count withdrawals as slips.
- **Acceptance:** facts and events record which scope they belong to. History and movement counts are per scope, and a scope change shows as "New scope · previous targets archived", not a date movement.

**8. Past milestones disappear silently.**
- A Next Milestone date that has passed simply drops out of "Coming up" (`page.tsx:33`), with no cue anywhere.
- **Acceptance:** it shows "Past milestone · update needed" on Home and Roadmap, with the same unknown-is-not-missed wording used for targets.

**9. Claude can leave out a blocker or mismatch.**
- `validateDraft` (`src/lib/delivery/ai-validation.ts`) guarantees every line is a supported, recorded statement, but not that anything required is present.
- Claude could drop a blocker, an open mismatch or a target change, possibly steered by user-written evidence or blocker text, and the draft would still pass.
- **Acceptance:** blockers, open value differences and target changes always render from the data in their own fields; AI wording fills only the updates text. A test with a mock provider that omits the blocker shows the blocker still appears.

**10. A Final doesn't separate what a PM wrote from recorded facts.**
- `editSection` accepts any text, so a PM can write "Launched" in a Final while Actual Live is still unknown.
- **Acceptance:** in a Final, each section splits "Recorded facts" from "PM narrative (human-written)". The target-movement lane comes from the frozen data, never from the prose; I didn't read `WeeklySection`, so this needs checking. Contradictions aren't blocked, but they are visibly attributed to the PM.

**11. Finalizing can deadlock on hidden sections.**
- The page hides sections for initiatives the user can no longer access (`weekly-review/page.tsx:34`), but `finalizeReview` still requires every section to be reviewed (`model.ts:231`).
- **Acceptance:** hidden sections are counted and named ("2 sections unavailable under your access"). A refresh removes or reassigns them before finalizing, and a disabled Finalize button says why.

**12. Integration gate: one review per week, and Final is permanent.**
- "One review per workspace and week", "Final cannot change" and the concurrent-edit checks are enforced only in the pure model (`model.ts`).
- **Acceptance:** storage enforces uniqueness on (workspace, week) and refuses any write to a Final. A two-writer test shows concurrent create or finalize has exactly one winner.

## P2: comprehension and layout

**13. Home's headline numbers are four equal KPI tiles.**
- `page.tsx:41–43` shows four equal counts, including a low-value "Initiatives" total. That breaks the no-equal-cards rule. Weekly Review is also promoted twice (header button and side panel).
- **Acceptance:** drop the total and show the three attention counts inline as links to their sections. Keep one Weekly Review entry point, in the side panel. The first decision card is visible without scrolling.

**14. Home decision cards show the values twice.**
- The sentence already says "two confirmed values: 27 and 30", and "27 vs 30" appears again below it (`page.tsx:49`).
- **Acceptance:** show them once.

**15. Roadmap shows raw internal codes.**
- Business-line headings and filter options (`roadmap/page.tsx:27,35`) and the stage label (`:41`) print raw enum values such as "DIGITAL TRANSFORMATION".
- **Acceptance:** use `BUSINESS_LINE_LABEL` and `STAGE_LABEL`, and add a check that no page renders a raw enum this way.

**16. Analysis largely repeats Home.**
- Its four counts and attention panel repeat Home, and the stage bars suggest more than the data supports.
- **Acceptance:** Analysis says what it is for ("definitions and counts you can cite") and keeps its calculation definitions and honest empty business-metrics checklist. It uses a plain stage-and-count list instead of bars, and doesn't restate Home's attention panel.

**17. Roadmap mislabels an actual live date that falls after the cutoff.**
- If the review cutoff is before the recorded Actual Live date, the row still says "Live date recorded" (`roadmap.ts:12`).
- **Acceptance:** it shows "Live recorded {date} (after cutoff)".

## Already correct
- Home and Roadmap never claim a missed launch when a target passes; they ask for an update.
- The first Weekly Review says there is no previous Final, and the baseline is the latest earlier Final in the same workspace, even across skipped weeks.
- A Final is labelled "not business or release approval".
- The AI validator only accepts recorded statements for the right initiative, and the template fallback is labelled separately.
- Analysis leaves business metrics honestly empty ("Missing data is not zero performance").
- Demo records are labelled synthetic, and seeded Knowledge shows "Verification history not recorded."

## What the implementer should run
- Unit tests for items 1, 2, 3, 7, 8, 9 and 11.
- A two-session Demo isolation test: the reviewer against a platform owner, plus the reviewer trying another org's ids (items 4–6).
- A storage-level test of week uniqueness and Final immutability under concurrency (item 12).
- Screenshots at 390 and 1440px of Home, Roadmap, a Final Weekly Review and Analysis, taken from the isolated Demo org after a reset (items 13–16).