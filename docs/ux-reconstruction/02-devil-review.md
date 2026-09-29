# Prodwise: Devil / Red-Team Review of the Local Candidate

**Reviewer stance:** independent red-team reviewer. I did not design or build this product, and I set out to prove it is frustrating, confusing, slow, inconsistent or unfinished. I did not edit any source file, commit or push. Production was not touched.
**Date:** 29 Sept 2026
**Surface:** local candidate at `http://localhost:3100` (Next dev, webpack). Every route was warmed once, and first-compile time is ignored throughout.
**Personas exercised end to end:**
- Demo reviewer (Prodwise Demo, 14 initiatives)
- `pm.demo` (MEMBER, AMAN)
- `reviewer.demo` (VIEWER, AMAN)
- `mohamedhassanpe` (PLATFORM_OWNER + AMAN owner)
- an anonymous `/signup` visitor

**Evidence:** screenshots are in `/tmp/claude-0/-home-user-Prodwise/7efb9df6-49dc-5c77-aa8d-1652ac925d9d/scratchpad/devil/`. This is session scratch and is not committed. Filenames are cited per finding. Code references are given where a finding is a logic or trust issue, so it can be reproduced without the PNGs.

**Local writes made (for the lead's reset):**
- Demo org:
  - Recorded a decision on Merchant Flex Finance: Daily Repayment divisor → **27**, rationale "…(devil review test)".
  - Completed the commitment "Get Finance's written confirmation of the repayment divisor".
  - Marked the Weekly Review W39 "Installment Early Settlement" section reviewed (the Draft is now 3/14).
- AMAN org, as `pm.demo`:
  - Created the initiative **Devil Review Card Controls** (`/initiatives/devil-review-card-controls-984c6de4`).
  - Pasted one evidence record into it, "Card controls kickoff email".
  - Started signup for `newperson@aman.eg`. This stopped at "check your email".

**Environment note:** the original `:3100` dev server was **OOM-killed by the kernel** partway through my first warm-up pass. `dmesg` shows `next-server` at about 5.2 GB RSS, with four other `next dev` servers (3201–3204) resident. I restarted it with the same command (`next dev --webpack -p 3100`, from the repo root) and logged to `scratchpad/devil/server3100.log`. This is an environment issue, not a product finding. The lead should know that `:3100` is now my process.

---

## 1. Verdict

The candidate is a real step up from the audited build. The shell now behaves like a modern SaaS tool:
- Popovers close on Escape and on outside click, and return focus.
- The account menu fits a 680px laptop, with Sign out one click away.
- The collapse toggle sits at the top and its state persists.
- The icons are distinct.
- The org switcher is a one-click menu.
- Loading keeps the previous page and shows a progress bar instead of a broken stripe.
- The Roadmap is finally a time-first timeline, with target-moved ghosts and dependency connectors.

Most of the audit's Blockers are fixed.

What still breaks trust is **consistency after a person acts**:
- A new initiative's header shows **"Not assessed" in the green READY tone** (a trust-rule regression).
- After I resolved the golden 27-vs-30 conflict, the **Demo Home banner still asserts that the two sources disagree**. The Brief keeps the stale "confirm the divisor" next step and blocker. The confirmed Knowledge row says "Verification history not recorded", with no pointer to the decision I just made.
- The same label, **"Dependency date impact"**, reads **2** on Roadmap and **4** on Analysis.
- The Initiatives register, the Roadmap and Analysis use **three different filter mechanics**, one of which still needs **Apply**.
- The key golden-flow next steps after saving evidence ("Add Knowledge entry · Add commitment · Ask a question") are **links styled as body text**.
- **/signup overflows the viewport at 390px**.

It is demo-able to a friendly audience. It is not yet a product whose numbers and banners an enterprise PM can trust after their first click.

---

## 2. Findings (reproduced only)

Legend: **[TRUST]** marks a regression or violation of a domain or trust rule (CLAUDE.md §8, §16, Stage 2.1). **[pre-existing]** marks code that predates this redesign but is still live.

### Blocker

**B1 [TRUST] "Not assessed" and "No open items in current checks" are rendered in the green OK tone**
- **Persona:** New PM (`pm.demo`).
- **Screen:** initiative header on any tab, e.g. `/initiatives/devil-review-card-controls-984c6de4`.
- **Steps:** create an initiative, then land on its Brief.
- **What happened:** the header chip reads "· Not assessed" in green: `color rgb(20,107,63)`, green border, `data-tone="ok"`. The same green chip reads "No open items in current checks" once claims exist.
- **Expected:** §16 reserves green for READY and makes UNKNOWN neutral grey. A fresh, unassessed initiative must not carry the "all clear" colour, especially since GAP, UNKNOWN and RISK are not checked at all (§11).
- **Evidence:** `pm-brief-new.png`, `pm-import.png`.
- **Fix:** in `src/components/*/WorkspaceHeader.tsx:43`, use a `neutral`/`unknown` tone for both no-attention strings. Keep `ok` for nothing, since there is no READY state today.

**B2 [TRUST] The Demo Home banner asserts a disagreement that has already been resolved, and nothing downstream reconciles**
- **Persona:** Product Lead (Demo).
- **Screens:** `/`, `/initiatives/merchant-flex-finance`.
- **Steps:**
  1. Open Decisions on Merchant Flex Finance.
  2. Click Make a decision, choose 27, enter a rationale, then Save.
  3. Return to Home and to the Brief.
- **What happened:**
  - The decision saved in about 1.8 s with a clear Saving… state, and Decisions shows Open 0 / Resolved 1.
  - Home still says **"Merchant Flex Finance has two sources that disagree on the repayment divisor (27 vs 30)"**. This is a hard-coded string that also re-appears after an org switch (`po-after-switch.png`).
  - The Brief still shows Next step **"Confirm the daily repayment rule with the Finance owner…"** and the recorded blocker **"needs a Finance decision: 27 or 30"**.
  - No prompt suggests updating either.
- **Expected:** a banner never states a fact that the records contradict (Rule 4 inverted: an assertion without evidence). After a decision, the product should offer the obvious follow-up, without auto-changing human records.
- **Evidence:** `d-dec-after.png`, `d-brief-after.png`, `d-loading-roadmap.png` (Home after the decision), `po-after-switch.png`.
- **Fix:**
  - Derive the Start-here banner from live findings: "… has an open value difference" only while one is open; otherwise "Start here: open Merchant Flex Finance".
  - After a decision whose initiative has a next step or blocker mentioning the same subject, show an inline "Decision recorded. Update the next step / clear the blocker?" with two secondary buttons.

### Major

**M1 The same label, "Dependency date impact", gives two different counts**
- **Persona:** Product Lead.
- **Screens:** `/roadmap` vs `/analysis/portfolio`.
- **Steps:** read the Roadmap view chip "Dependency date impact **2**", then Analysis → Attention by recorded reason "Dependency date impact **4**".
- **What happened:**
  - The Roadmap filter shows 2 initiatives: `?view=dependency` → "2 initiatives match".
  - The timeline itself tags 4 rows "Dependency late" (Partner Bank, Collections, Merchant Insights, Merchant Flex).
- **Expected:** one definition, one number.
- **Evidence:** `d-roadmap.png`, `d-analysis-portfolio.png`.
- **Fix:** decide whether the count is "initiatives that wait" or "initiatives on either end". Use one selector for both, and name the other one differently (e.g. "Blocks another initiative").

**M2 Three filter mechanics across the product, one of which still needs Apply**
- **Persona:** Product Lead.
- **Screens:** `/initiatives`, `/roadmap`, `/analysis/projects`.
- **Steps:** filter each list.
- **What happened:**
  - The register uses instant chips (good: about 100 ms, URL `router.replace`).
  - Roadmap uses 44px native `<select>`s that auto-apply, plus a native date input showing **"09/26/2026"** (US format; every other date reads "26 Sept 2026").
  - Analysis → Initiatives is still a GET form with native selects and an **Apply** button. Its Stage options are in random order rather than lifecycle order.
- **Evidence:** `d-reg-stage-open.png`, `d-roadmap.png`, `d-an-projects.png`.
- **Fix:** reuse the register's `FilterBar` on Roadmap and Analysis. Order Stage options by lifecycle. Use a date chip that shows "26 Sept 2026".

**M3 The golden-flow next actions are links styled as plain body text**
- **Persona:** New PM.
- **Screens:** `/initiatives/<new>/evidence/<id>`, `/initiatives/<new>/sources/import`.
- **Steps:** Add evidence → Paste text, then save. Alternatively, open Import.
- **What happened:**
  - The only way forward, "Add Knowledge entry · Add commitment · Ask a question", is rendered as `<a>` in ink colour `rgb(10,27,42)` with `text-decoration:none`, so it is indistinguishable from the sentence around it.
  - "Record a reference instead" on Import has the same problem.
  - The page states "Not read yet" and "No proposals — automatic reading is off / Nothing was read…", which is three statements of the same fact, while the actual actions are invisible.
- **Evidence:** `pm-evidence-saved.png`, `pm-import.png`.
- **Fix:**
  - Render the three as secondary buttons in a "Record from this source" row.
  - Make "Record a reference instead" a secondary button.
  - Collapse the three "not read" statements into one.

**M4 /signup overflows the viewport on mobile**
- **Persona:** Newly signed-up user.
- **Screen:** `/signup` at 390×844.
- **What happened:**
  - `scrollWidth 419 > 390`.
  - The form, the email input, the Continue button and the helper paragraphs extend 29px off-screen.
  - The stepper is cut at "Your acc…".
  - `/login` is fine.
- **Evidence:** `su-390.png`, `m390_signup.png`.
- **Fix:** give the signup form `min-width:0; max-width:100%`, and let the 3-step stepper wrap or show "Step 1 of 3" below 420px.

**M5 The Viewer still sees write verbs that lead to read-only pages**
- **Persona:** Viewer (`reviewer.demo`).
- **Screens:** Brief, Risks & questions.
- **What happened:**
  - Brief → Setup "**Complete setup →**" and Relationships "**Record**" both go to `/manage?section=…`, which then explains that only admins can edit.
  - Risks & questions shows "**Confirm in Knowledge**".
  - "Viewer · read-only" appears twice (top bar and header chip).
  - The same fact is worded two ways on one screen: "No owner recorded" (chip) vs "Owner · Unassigned" (Delivery facts).
- **Evidence:** `v_initiatives_merchant-flex-finance.png`, `v-setup.png`.
- **Fix:**
  - For viewers, show "View setup" / "View" (Delivery facts already does this correctly) and "View in Knowledge".
  - Show the read-only chip once.
  - Use one wording for an absent owner.

**M6 Weekly Review has three week pickers, the same count stated three times, and a mixed date format**
- **Persona:** Product Lead.
- **Screen:** `/weekly-review`.
- **What happened:**
  - Week navigation exists three times: a ‹ › stepper, a native week input with a text-style **"Open"** button, and a link list "2026-W39 · Draft / W38 · Final / W37 · Final".
  - "Reviewed 2 of 14 sections" appears in the subtitle, the meter and a sentence.
  - The section commitments use ISO "**2026-09-30**", while the rest of the product uses "30 Sept 2026". Home uses "W39" while this page uses "2026-W39".
  - "Draft wording" is disabled with no reason given (no `title`, no hint).
  - After "Save and mark reviewed", the confirmation appears at the top of the page, out of view, while the page jumps to the next section.

  The flow itself works: saving took about 1.5 s, advanced to the next section, and Finalize is gated with "6 of 8 checks passed" plus reasons.
- **Evidence:** `d-weekly-review.png`, `d-wr-section.png`, `d-wr-after.png`, `d-wr-finalize.png`.
- **Fix:**
  - Keep only the stepper plus a popover list of weeks.
  - State the count once.
  - Format dates with `displayDate`.
  - Give the disabled button a reason line.
  - Show the save confirmation as a toast near the section.

**M7 [TRUST] After a decision, Knowledge and Decisions do not tell the same story**
- **Persona:** Product Lead.
- **Screens:** `/knowledge`, `/decisions`.
- **What happened:**
  - The chosen claim (27, "Replaces 30") still says "**Verification history not recorded.**" and has no link to the decision record that just confirmed it. That phrase appears on 9 of 10 rows, which is noise.
  - The Decisions toolbar shows "**Recorded decisions · 4**" both before and after I recorded a decision, beside "History 2". The two "decision" counters mean different things.
  - The decision record is time-stamped "**14:25 UTC**", while Weekly Review says "Cairo" and the Demo shows a scenario date. That is three time frames.
- **Evidence:** `d-know-after.png`, `d-dec-after.png`, `d-mff-decisions.png`.
- **Fix:**
  - Show "Decided by Demo Reviewer · 29 Sept 2026 → decision record" on claims confirmed via a decision. Keep the exact Stage-2.1 string only for genuinely legacy rows, and show it once as a table footnote rather than on every row.
  - Rename "Recorded decisions" to "Decision entries in Knowledge", or drop it.
  - Use one time zone label across the product.

**M8 The Initiatives register truncates at 1366px, the most common enterprise laptop**
- **Persona:** Product Lead.
- **Screen:** `/initiatives` at 1366×768.
- **What happened:**
  - The Setup value is cut as "10/10··".
  - "Demo Revie…", "Dependency date im…" and "Explicitly unkn…" are truncated.
  - The "Release Preparation" stage pill overflows into the Owner column.
  - The business line shows as a boxed code ("BP", "MF", "FS") for some rows and as full text ("Digital Transformation", "Acceptance") for others. The same mix appears in Roadmap group headers and Analysis.
- **Evidence:** `d-reg-1366.png`, `d-reg-stage-open.png`, `d-roadmap-full.png`.
- **Fix:**
  - Give the numeric Setup column a `min-width` with no ellipsis.
  - Allow the Attention cell to wrap to two lines.
  - Show business lines consistently (code chip with the full name in a tooltip, or always the full name).

**M9 [TRUST] [pre-existing] Pasted evidence is auto-classified CURRENT_SCOPE and typed "Document"**
- **Persona:** New PM.
- **Screen:** Sources after Paste text.
- **What happened:**
  - The paste form offers no boundary choice.
  - The record lands under "Current Scope" as type "Document", even though it was pasted as an email.
  - `src/lib/evidence/service.ts:42` hard-codes `boundary:'CURRENT_SCOPE'`, `sourceType:'DOCUMENT'`.
  - Phase 2 says "no auto-classification". Under Stage 2.1, CURRENT_SCOPE evidence authorises verification, so a paste silently becomes verification-grade support.
- **Evidence:** `pm-sources.png`.
- **Fix:** add a required boundary radio (default unselected) and a type select to the paste form. Alternatively, land pastes as `RELATED` with a one-click "Mark current scope".

**M10 [pre-existing] Initiative URLs carry a UUID fragment**
- **Persona:** New PM.
- **What happened:** creating "Devil Review Card Controls" yields `/initiatives/devil-review-card-controls-984c6de4`. The source is `src/lib/workspace/initiative-creation.ts:17`, which appends `id.slice(0,8)`.
- **Expected:** §17 says "Never key fixtures or URLs off generated UUIDs". `uniqueSlug()` in `repository.ts` already resolves collisions with `-2`, `-3` and so on.
- **Fix:** use `uniqueSlug(name, existingSlugsInWorkspace)`.

### Minor

| id | persona | screen | what happened | fix |
|---|---|---|---|---|
| m1 | Product Lead | Decisions | "Make a decision" is a `<summary>`, not a button (`getByRole('button')` cannot find it), and it **loses its primary fill once opened** (`d-dec-make.png`). The form mixes 44px radio cards, a native select and small Defer…/Dismiss… buttons. | Use a real button that toggles a disclosure region with `aria-expanded`. Keep the primary style when open. |
| m2 | Product Lead | Commitments | Complete is one click with a spinner (good), but there is no undo or toast. "Done & cancelled 1" is a bare `<summary>` with no chevron. The in-progress glyph renders as a stray "‹" (`d-com-click.png`, `d-com-after.png`). | Add an "Undo" toast for 5 s, a chevron on the group, and a proper status icon. |
| m3 | Product Lead | Register | The Stage filter (single-select radio) stays open after a pick. | Close it on selection for radio menus. |
| m4 | All | Initiative tabs | Clicking another tab while the Add evidence menu is open only closes the menu (the first click is swallowed). During a pending tab switch, Brief keeps its underline while History shows a pending highlight: two "active" tabs (`d-loading-history.png`). | Let outside clicks on links pass through. Move the underline optimistically. |
| m5 | All | Add evidence → Paste / saved evidence | No tab is selected on sub-pages (`aria-current` is absent on Sources), so the user loses their place. The breadcrumb sits 10px under the tab rule. | Mark Sources as current. Add the standard toolbar gutter. |
| m6 | Product Lead | Roadmap, Analysis | These pages keep marketing eyebrows ("DELIVERY OUTLOOK · PRODWISE DEMO", "ANALYSIS · PRODWISE DEMO") plus a lede. The Initiatives page does not. The Analysis "Scenario date" is set in monospace. | One page-header pattern: H1 + count line. |
| m7 | Product Lead | Analysis project (no metrics) | A 01–06 "A metric needs…" essay fills an empty state (copy volume, audit #14). | Two lines plus a "What a metric needs" Help link. |
| m8 | Product Lead | Home / Analysis | Stat tiles are white with amber numbers on Home, and a navy block on Analysis. It is the same six numbers with two visual languages. | Use one stat-strip component. |
| m9 | Platform Owner | Org switch | Avatar initials change from **MH** (AMAN) to **MM** (Demo), and the name renders as "Mohamed Hassan (…" because "(Platform Owner, not a member)" is part of the display name (`po-after-switch.png`). Switching from /roadmap lands on Home, with two stacked banners. | Derive initials from the person's name only. Put the platform role on the second line. Stay on the same route when it exists in the target org. |
| m10 | Platform Owner | Platform → Organizations | The KPI says "0 in setup" while the Status filter says "Bootstrapping". | Use one term. |
| m11 | New PM | Import (Demo org) / Sources | The Demo org's Import page H1 promises "Import from Jira — Choose epics, stories…" under a "Connectors are off" note. The connector tabs clip at 768px ("Figma Not…") with no scroll affordance. Sources shows "Not set up for this installation · Not set up" twice per connector, plus two Add evidence entry points (header and page). The **Demo** Add evidence menu omits the Import entry, while AMAN's has it. | Title the page "Import" and state availability once. Add a scroll fade on the tabs. Use one Add evidence entry. Keep the menu items consistent across orgs, disabled with a reason where applicable. |
| m12 | Demo | Account / org card | The Demo actor is still "Demo Reviewer · **Org Owner**" (audit #15 not addressed). | Rename to "Demo PM", or show the role as "Demo access". |
| m13 | New user | /signup verify | "Check your email" offers only "start again", with no resend and no countdown. | Add "Resend link" with a cooldown. |
| m14 | Product Lead | Palette | Typing shows "Loading initiatives…" about 600 ms after open. Pages are listed first (good). | Prefetch the initiative index when the palette opens, or at idle. |
| m15 | All | Roadmap at 390 | The timeline only shows Sep–Oct and names truncate ("Tap-to-Pay Merch…"). This is usable, but the dependency label can overlap the row rule at 1440 (`d-roadmap.png`, Partner Bank row). | Pin the name column wider on mobile. Keep the connector label inside its row. |

### Verified as working (so it is not re-reported)

- **Popovers:** account menu, Add evidence, filter menus, org switcher and Help all close on Escape and on outside click, and focus returns to the trigger. Arrow keys move within Add evidence. Menus use `role=menu` / `aria-haspopup`.
- **Account menu at 1366×680:** the menu bottom is at 622, and Sign out is visible and direct.
- **Collapsed rail:** the collapsed-rail menu is anchored and full. Collapse sits at the top with the aria-label "Collapse sidebar", and its state persists across reload. Rail icons are distinct (`d-collapsed.png`).
- **Keyboard focus:** a visible two-ring focus (navy + cyan).
- **Sign out:** takes about 300 ms. Back afterwards redirects to `/login?returnTo=…`, and no cached admin page is shown.
- **Mobile and tablet:** no page-level horizontal overflow at 390 or 768 on any app route tested (11 routes each). The mobile drawer works.
- **Signup copy:** Rule-4-honest, and the domain refusal is clear ("isn't currently eligible… ask your administrator").
- **Perceived speed (dev, second visit):** Home→Initiatives about 0.6 s, →Roadmap about 0.6 s, →Analysis about 0.8 s, Register→Brief about 0.9 s, Brief→Decisions about 0.5 s. Feedback is immediate: the nav highlight moves, a top progress bar appears, and the previous content stays. I saw no blank page and no dead click.

---

## 3. Audit follow-up (01-independent-audit.md, Blockers and Majors)

| # | Audit item | Status | Note |
|---|---|---|---|
| 1 | Popovers don't behave like popovers | **Fixed** | Escape and outside click close them, focus returns, and they use ARIA menu roles. In-flow `<details>` remain for the decision form and the "Done" group (see m1, m2). |
| 2 | Account menu clipped, Sign out hidden | **Fixed** | It fits at 680px tall, opens upward, shows identity, and Sign out is one click. |
| 3 | Flat, washed-out canvas | **Fixed** | The white work sheet sits on a grey-blue gutter with a navy rail. Grey panels such as "Record a decision" are still used inside the sheet. |
| 4 | Roadmap is not a roadmap | **Mostly fixed** | Time is now the canvas, with target-moved ghosts, a scenario-date line and dependency connectors. Native selects and the US-format date input remain, and business-line code/name mixing remains (M2, M8). |
| 5 | Double header on every tab | **Fixed** | Tab toolbars replace the re-titled headers. Some tabs keep a one-line lede ("Current differences requiring a decision."). |
| 6 | Shared icons; pin used for Collapse | **Fixed** | Distinct icons, and collapse sits at the top. |
| 7 | GET filter forms with Apply | **Partially** | Fixed on the register and Administration. Roadmap uses native auto-apply selects. Analysis → Initiatives still has **Apply** (M2). |
| 8 | Misaligned baselines, tall rows | **Partially** | Rows are compact and aligned at 1440. At 1366, cells truncate and pills overflow (M8). |
| 9 | No button system | **Partially** | The `pw-btn` system exists. Remaining: "Make a decision" `<summary>` loses its primary style, Weekly Review's text-style "Open" button, and a mix of 44px and small buttons in the decision panel (m1, M6). |
| 10 | Broken loading stripe | **Fixed** | Previous content stays, with a progress bar and an immediate nav highlight. Production latency could not be measured here. |
| 11 | Unbalanced header, floating actions | **Fixed** | A persistent top bar with breadcrumb, search, bell and help. Actions are right-aligned on the title. |
| 12 | Notifications badge, not actionable | **Partially** | The desktop badge exists (count 4→3 live). The bell still navigates to a page rather than opening an inbox popover. |
| 13 | Static org card / modal radio switcher | **Fixed** | A one-click menu, a non-interactive card for single-org users, and a confirmation banner. Minor initials bug (m9). |
| 14 | Copy volume | **Partially** | Better, but still: 9× "Verification history not recorded", 3× "reviewed 2 of 14", 3× "not read yet", and the 01–06 metric essay (M3, M6, M7, m7). |
| 15 | Test data and dates leak into demo | **Partially** | "Smoke check" no longer shows (1 archived hidden). Still present: "Demo Reviewer · Org Owner", and three temporal frames (scenario date, "UTC" on decision records, "Cairo" on Weekly Review) (M7, m12). |

---

## 4. Research validation (brief)

Web access was restricted, so every competitor observation below comes from expert recollection of Jira Cloud, Jira Product Discovery, Linear, Productboard, Aha! and Notion as of 2025–26. None of it was re-verified live.

| Area | Observed pattern in the category | Prodwise adaptation | Holds up? |
|---|---|---|---|
| Shell / nav | Linear and Jira: a dark or neutral rail, a top-anchored collapse, `[` to toggle, distinct icons, and a persistent top bar with ⌘K | Navy rail, collapse at top, `[` shortcut, distinct icons, top bar with search, bell and help | **Yes.** Only the per-page header patterns still diverge (m6). |
| Account & org switcher | Linear, Notion and Slack switch workspace in one click, show identity in the menu, and keep the route | One-click org menu, identity header, Sign out direct | **Mostly.** It drops the current route and the initials are inconsistent (m9). |
| Popovers | Close on Escape, outside click and selection; return focus; arrow keys | All of that, except radio filter menus stay open on pick | **Yes** (m3). |
| Roadmap | Jira Plans, JPD Timeline and Productboard: time is the canvas, a sticky name column, fixed rows, details in a side panel, dependency lines | Time canvas, ghost for the previous target, dependency connectors, a details table below | **Mostly.** Filters are native selects, the counts disagree with Analysis (M1), and details are a second long table rather than a side panel. |
| Analysis | Productboard and Aha! dashboards: one stat language, instant filters, drill-through | Honest metric states (met / below / no approved target) and drill to the initiative | **Partially.** The Apply form (M2), two stat styles (m8) and an essay-style empty state (m7). |
| Initiative journey | JPD and Linear: create → land on the item → an obvious next action inline | Create → Brief with a setup meter and "continue setup"; decisions resolve inline | **Partially.** Resolving a decision does not propagate to the banner, next step or Knowledge provenance (B2, M7), and the evidence next steps are invisible (M3). |
| Import | Jira and Productboard integrations: one "Import" entry, connector state and a clear alternative | An Add evidence menu entry (AMAN), connector tabs, a "record by reference" fallback | **Partially.** The entry is missing in the Demo org, "Not set up" appears twice, and the fallback is styled as text (M3, m11). |
| Help | Linear and Notion: a "?" shortcut sheet plus contextual docs in a side panel | A Help panel with "On this page", "How Prodwise works", shortcuts and orientation restart; Escape closes it | **Yes.** Its purpose is obvious. The shortcut list says Alt 1–4 covers 4 of 7 tabs. |
| Loading | Linear and Jira keep the previous view with a thin progress indicator and prefetch routes | Previous content kept, a top progress bar, an optimistic nav highlight | **Yes** in dev. Production latency is unverified here. |
