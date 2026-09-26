# Claude release red-team — read-only evidence

Review date: 26 September 2026. Forked the existing Claude session `b0317c6a-7d51-4720-8b36-9d43aebfc163`; completed fork `ef22e4fb-0eee-4dca-b9cc-28f3ee3802fd`. The CLI reported success after 22 turns (about 118 seconds).

Only Read, Glob and Grep were enabled, with plan permissions, no MCP servers, and explicit private environment/data read denials. No source or production changes were made for this review. Reported runtime gates are distinguished below from code and screenshot evidence Claude independently inspected.

The following is Claude's returned report, preserved verbatim.

---
# Prodwise release red-team: final review

**Verdict: I found no release-blocking defect in the current code or the final-demo screenshots I inspected.** This was a read-only review with Read, Glob and Grep only. I ran nothing, and I did not access `.env*`, `.data`, credentials or production. The hosted integration gate is still open (see the outstanding gate section).

## Release-blocking defects

None verified.

## Prior findings now resolved (checked against current code)

- **Partial launch no longer clears a past target** (critique #1). `deliveryTiming` treats only a full-scope Actual Live as settled (`src/lib/delivery/roadmap.ts:14-15`). A partial actual with a past target returns `NEEDS_UPDATE` "Past target · partial live" (`:19`). Home uses the same function for past targets and for leaving the Coming-up list (`src/app/page.tsx:27,31`).
- **A live date after the cutoff is labelled correctly** (#17): "Live recorded after cutoff" (`roadmap.ts:13`).
- **Fixture facts are no longer credited to the reviewer** (#2).
  - The fixture context actor label is `FIXTURE_ORIGIN_LABEL` (`src/lib/demo/canonical.ts:58`, `presentation.ts:1`), and events and the W38 Final are flagged `preparedAsFixture` (`canonical.ts:67,104`).
  - `safeUserLabel` gives fixture provenance priority (`presentation.ts:4-5`).
  - Screenshot evidence: Home "What changed" shows "Synthetic scenario preparation" (home-1440.png). WeeklySection labels fixture notes "Synthetic scenario notes" / "Prepared scenario notes" (`WeeklySection.tsx:32`).
  - Caveat: `reviewerMemberId` is still used for fixture ownership and for member ids (`canonical.ts:55,73`), so "Demo Reviewer" appears as the owner on Roadmap. That is ownership, not confirmation, so it does not block.
- **A fixed scenario date drives the demo** (#3). Home uses `presentation.scenarioAt` (`page.tsx:24`) and labels it "Scenario date · 26 Sept 2026". Home, Roadmap and Analysis all show this label (home/roadmap/analysis-1440.png).
- **Past milestones are shown** (#8): "Past milestone · update needed" (`page.tsx:28,56`).
- **Recorded facts appear regardless of the AI draft or PM wording** (#9, #10). The frozen blocker, open value differences, target movements and next step render from `review.input` in a separate "Recorded facts · Frozen at the review cutoff" block. PM text is labelled "PM narrative … Notes do not change the recorded facts above" (`WeeklySection.tsx:24-32`). Visible in weekly-review-1440.png.
- **Target movements are counted within the current scope** (#7). Only SET→SET date changes after the latest real scope change count (`roadmap.ts:28-30`). Roadmap shows "1 Oct 2026 → 8 Oct 2026 · 1 target change in current scope".
- **Hidden sections cannot deadlock finalization** (#11). They are counted and explained (`weekly-review/page.tsx:21,33`), and finalizing requires a refresh because of the input digest check (`model.ts:235`).
- **A Final cannot change** in the model (`model.ts:205`). Out-of-order finalization is refused (`model.ts:233`).
- **Workspace comes from the session** (#4). Login candidates come from persisted active memberships only (`src/lib/auth/login-scope.ts:5-15`). The session token binds the workspace, which is re-verified (`:49-58`). Delivery reads use `ctx.workspaceId` (`src/lib/delivery/repository.ts:24`).
- **Comprehension fixes** (#13-15):
  - Home now has three inline attention links instead of four tiles (`page.tsx:41-43`), and the values appear once.
  - Roadmap uses business-line labels. "BP", "FS" and "MF" are the configured labels, and "Acceptance" is shown in full.

## Unverified gates (no defect found; not proven by me)

1. **Hosted integration (external).** A Vercel sign-in and the hosted Supabase state have not been checked. This is an environment gate, not a code bug.
2. **Storage-level guarantees** for week uniqueness, Final immutability and the owner guard (migrations 0013/0014). I did not read these migrations or their SQL tests this pass, so they rest on the reported gate evidence.
3. **Demo org role limits** (#6: invitations and policy edits blocked in the demo org) and **archived-generation denial**. These are reported as implemented; I did not trace them.

The reset guard (#5) still identifies the demo org by name (`canonical.ts:117`). It is called only from the operator script `scripts/demo/provision-local.mjs:51`, after the private-registration check the operator contract describes, and has no runtime route. That makes it an operator-procedure risk rather than a release blocker.

## Non-blocking observations

1. **Guide button and avatar overlap content.** On decisions-390.png the floating "Guide" button and the "N" avatar cover the "Record a decision" heading; at 1440px the Guide button overlaps side-panel text on Home and Roadmap.
2. **Analysis still repeats Home.** It keeps four equal KPI tiles and stage bars, and restates Home's attention panel (analysis-1440.png), which the earlier critique (#16) asked to simplify.
3. **Stray nav item and mixed dates.** knowledge-1440.png shows an extra "Initiative" item in the rail. Home "What changed" uses raw ISO dates ("2026-10-01 → 2026-10-08") alongside `dd/mm/yyyy`.

## Evidence limitations

- About five minutes of selective reading. I did not read `ai.ts`, `ai-validation.ts`, `auth/service.ts`, `auth/core.ts`, the roadmap and analysis page sources, migrations 0013/0014, or `FINAL-LOCAL-GATES.md`.
- The test counts, the accepted real-Claude response and the 40 viewport checks are reported by the root agent, not run by me.
- The screenshots show pre-mutation demo state (the W39 draft with 0/4 sections reviewed), so they cannot confirm the finalized-Final rendering. I did not read `claude-generated-1440.png`.

No files were saved. This text is for Codex to persist.
---

## Codex evidence notes for root adjudication

- Claude found **no verified release-blocking defect**. This is a selective critique, not an independent rerun of the test suite or hosted sign-off.
- The Analysis observation is current: both `src/app/analysis/page.tsx` and `analysis-1440.png` still contain the summary strip, lifecycle bars and recorded-attention panel. No edit was made in response.
- The small circular `N` visible in local screenshots is the Next.js development indicator, not a product user avatar. The floating Guide trigger does visually share space with page content in the full-page mobile capture; the screenshot does not itself demonstrate an unreachable control.
- `NavRail.tsx` has exactly four primary links (Home, Initiatives, Roadmap, Analysis). Its separate `Current initiative` contextual nav may show the fallback label `Initiative`; this is not a fifth primary destination. The label quality remains a non-blocking presentation observation.
- Screenshots describe captured local states; `docs/ui-review/final-demo/results.json` records the later real-Claude and human-finalization acceptance sequence. Claude did not independently inspect all source paths, SQL migrations, or the finalized post-mutation capture.
- Hosted Vercel/Supabase verification remains a separate outstanding access gate. No local review establishes hosted readiness.
