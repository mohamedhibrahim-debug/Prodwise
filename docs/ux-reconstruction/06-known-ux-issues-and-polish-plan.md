# Known non-blocking UX/UI issues and provisional polish plan

Status: **Production Accepted with Non-Blocking Issues** (29 Sept 2026). Nothing listed here is being fixed yet; every item waits for owner approval.

**Sources:**
- `03-final-ux-acceptance.md` (IDs A-, B-, C-, D-, E-, F-, G-, I-)
- `02-devil-review.md` (IDs m-; items already fixed are omitted)
- `01-independent-audit.md` (items that remain open)
- The owner's review comments
- The production acceptance report (IDs P-)

**Severity:** Major (weakens the core experience or trust) · Minor · Cosmetic.

---

## 1. Visual system

| ID | Severity | Current behaviour | Why it matters | Suggested direction |
|---|---|---|---|---|
| I-1 / VS-1 | **Major** | Too monochrome overall. Most screens are white/neutral text on white cards, and the product reads as a documentation portal rather than a command centre. This is raised repeatedly by the owner. | The product's positioning is "AI product-management workbench / command centre". Without visual differentiation between information types, scanning is slow. | Define information-type colour roles on top of the existing tokens: identity (teal), status (semantic), time (neutral scale), provenance (subtle). Add visual components only where they carry data. Fewer stacked white cards: use banded sections and 1px rules. |
| I-2 | Minor | The restrained orange secondary accent exists as tokens but is rendered on no screen or login (0 of 18 routes). | The brand reads as single-colour. The design law calls for a restrained warm accent. | Use orange only for non-semantic identity: the rail arc motif, section numerals, the login geometry. Never for status. |
| I-3 | Minor | Status colour is missing where status exists: the Weekly Review section navigator and Notifications overdue rows. The neutral "Already recorded" note uses amber. | Status must be legible at a glance (colour + text + glyph), and amber on neutral information dilutes real at-risk signals. | Apply the semantic tokens to review state and overdue rows. Make "Already recorded" neutral. |
| C-1 / m8 | Minor | Two table styles and two stat-strip visual languages: white tiles with amber numbers on Home, a navy block on Analysis. | Inconsistency reads as separately designed screens. | One stat-strip component and one table grammar. |
| m6 | Minor | Roadmap and Analysis keep eyebrow + lede page headers; the Initiatives page doesn't. The Analysis scenario date is in monospace. | Inconsistent page-header grammar. | One page-header pattern. |
| B-1 | Minor | The 16 px brand mark can read like a loading spinner. | It sits next to real loading indicators. | Adjust the segment geometry at small sizes (e.g. a gap or one filled segment) without redesigning the mark. |
| B-2 / B-3 | Cosmetic | The sidebar logo tile is low-contrast against the rail; the wordmark is plain Inter Bold. | Brand presence is weak. | A subtle tile contrast step; optional wordmark tracking and weight tuning. |
| C-3 / C-4 / C-5 | Cosmetic | The Analysis "How these counts are calculated" bar has no expand arrow. The 10/10 setup bar uses READY green. The Commitments "in progress" glyph is a tiny half-disc. | Small affordance and meaning slips. | A disclosure chevron. A neutral or teal setup meter. A clearer in-progress glyph. |
| VS-2 | Opportunity | There is no dark mode (the owner has mentioned it). | A preference for some users and demo settings. Not required by the design law. | Only after VS-1. The token layer already supports a theme switch. Scope it separately. |

## 2. Home

| ID | Severity | Current behaviour | Why it matters | Suggested direction |
|---|---|---|---|---|
| I-1 (Home) | **Major** | 93% white/neutral. Bare-number pulse strip, then a long Needs-attention text list, then three text cards. It doesn't show data it already holds: the attention mix, next-28-day targets and milestones, lifecycle distribution. | Home is the daily landing surface and must pass the five-second test visually, not only textually. | Attention band (proportion with reason split, colour + text). A compact 28-day "coming up" mini-timeline reusing the Roadmap marks. Lifecycle distribution strip. Status-banded attention rows. |
| m12 | Minor | The Demo actor shows as "Demo Reviewer · Org Owner". | Confusing role label for Demo visitors. | Show "Demo access". |
| E-5 (Home part) | Minor | Counts in the right rail aren't status-coloured where status exists. | Scanability. | Semantic tint on counts that are statuses. |

## 3. Initiative Brief (and initiative tabs)

| ID | Severity | Current behaviour | Why it matters | Suggested direction |
|---|---|---|---|---|
| I-1 (Brief) | **Major** | 94% white/neutral: six stacked white cards. The lifecycle position appears only as a 16 px ring. The delivery dates it states (dev start, milestone, Target Live, target move) aren't drawn. Relationships are text. | The Brief is the initiative cockpit and should show "where is it, what's next, what's in the way" at a glance. | A single-row delivery timeline (reuse the Roadmap row renderer). A readable lifecycle stepper (Initiative Arc at an allowed size, or a linear stepper). An attention status band. A dependency chip graph. |
| E-1 | Minor | Sources shows two identical primary "Add evidence" buttons (header + tab), with its own eyebrow and H1 under the initiative header. The top label sits 1 px under the tab rule. | Duplicate primary actions and the double-header pattern the redesign removed elsewhere. | Tab toolbar only; one primary action. |
| m1 | Minor | "Make a decision" is a `<summary>` that loses its primary fill when open; the form mixes control sizes. | Weak primary action on the most important decision flow. | Real button opening a panel or dialog; uniform control sizes. |
| m2 | Minor | Completing a commitment has no undo or toast. "Done & cancelled" is a bare summary. | Recoverability and feedback. | Success toast with Undo (within the revision rules). Chevron on the disclosure. |
| m4 | Minor | Clicking a tab while the Add evidence menu is open only closes the menu. During a pending switch two tabs look active. | Dead-click feel. | Let the click pass through after closing. A single pending indicator. |
| m5 | Minor | On Add evidence sub-pages no tab is marked current, and the breadcrumb is misaligned. | Users lose their place. | `aria-current` on Sources; standard toolbar gutter. |
| E-2 / C-2 | Minor | Proposal Review: "Needs your decision" labels on items the header says aren't counted. The "Date changes" icon renders as a plain brown dot. | Count wording contradiction; broken icon. | Align labels with the tally; fix the icon. |
| m11 | Minor | In the Demo org, the Import page H1 promises Jira import under a "Connectors are off" note. Connector tabs clip at 768 px. | Mixed message; clipped control. | Conditional heading in Demo; scrollable tab strip. |

## 4. Weekly Review

| ID | Severity | Current behaviour | Why it matters | Suggested direction |
|---|---|---|---|---|
| E-6 / I-3 (WR) | Minor | A long document-form. The section navigator shows 14 review states as grey text. The action row is misaligned, with a double rule. "0 sections affected" appears while an update is still required. | The weekly ritual should show progress and state at a glance. | Per-section state glyph + colour (Reviewed / Needs review / Needs recheck). Fix the action row. Accurate "update required" copy. |
| WR-1 | Opportunity | No visual comparison with the baseline (target moves, new attention) beyond text deltas. | The review is about change since last week. | Compact change band per initiative (moved target, new/closed attention) using existing baseline data. |

## 5. Roadmap

| ID | Severity | Current behaviour | Why it matters | Suggested direction |
|---|---|---|---|---|
| E-3 | Minor | The month header doesn't stay pinned when scrolling. The Details table below repeats the timeline as long text. | Orientation on tall roadmaps; redundant length. | Sticky month header; collapse Details by default. |
| m15 | Minor | At 390 px only Sep–Oct is visible and names truncate. The dependency label can overlap a row rule at 1440 px. | Mobile legibility; label collision. | Wider pinned name column on mobile; label collision avoidance. |
| RM-1 | Minor (owner-raised; details to confirm) | Demo dates. The Demo is frozen at its scenario date (26 Sept 2026), while the rest of the product uses the real date. As real time moves on, Demo targets and milestones will increasingly look past-due, and the "coming up" windows will empty. | The Demo narrative degrades over time. | Keep the scenario-date frame explicit. Refresh the Demo dataset or scenario date through the operator reset. No fake dates in real orgs. |
| RM-2 | Opportunity | No zoom levels (weeks/months/quarters), list↔timeline toggle, or peek panel. | Planning at different horizons. | Add after the Major items. |

## 6. Analysis

| ID | Severity | Current behaviour | Why it matters | Suggested direction |
|---|---|---|---|---|
| E-4 | Minor | Chart labels collide ("571 merchants hants"). Each metric section leaves ~600 px of empty space beside the contract table. | Broken-looking labels; low density. | Label collision handling. Chart and contract side-by-side, or contract collapsed by default. |
| m7 | Minor | An empty initiative (no metrics) shows a long 01–06 essay. | Copy volume. | Two lines + a Help link. |
| AN-1 | Minor (owner-raised; details to confirm) | Analytics demo data: 9 of 14 Demo initiatives have synthetic metrics and 5 deliberately have none (to show the empty state). The data is weekly/monthly with no channel or segment dimension. | The Demo may feel thin in places; breakdowns aren't possible. | Decide the target coverage. Adding dimensions needs a data-model change and owner approval. |
| AN-2 | Opportunity | Portfolio "Business metrics coverage" is a text table. | Coverage status isn't visual. | Met / below / no-target mini-bars. |

## 7. Administration / Settings

| ID | Severity | Current behaviour | Why it matters | Suggested direction |
|---|---|---|---|---|
| AD-1 | Minor (owner-raised) | Administration and Users are functional compact tables, but not yet redesigned to the new composition standard (filters are server-side; there's no member summary). | Admin surfaces still feel like a form tool. | Member/role summary band; instant client filters; consistent table grammar. |
| m9 | Minor | Platform Owner switching orgs: the initials change and the name renders "Mohamed Hassan (…" because a role note is part of the display name. | Identity confusion. | Separate display name from role annotation. |
| m10 | Minor | Platform → Organizations: the KPI says "0 in setup" while the filter says "Bootstrapping". | Inconsistent terms. | One term. |
| D-3 / Account | Cosmetic | Page titles and breadcrumbs are named inconsistently; Account has a heading offset. | Polish. | A naming pass; align the header. |

## 8. Connectors

| ID | Severity | Current behaviour | Why it matters | Suggested direction |
|---|---|---|---|---|
| CN-1 | Minor (external) | Figma isn't connected. If "Invalid scopes for app" recurs, the fix is in the Figma app settings (exactly `current_user:read`, `file_content:read`, `file_comments:read`). | Figma evidence is unavailable until configured. | Owner configures the Figma app; then a live re-test. |
| CN-2 | Minor | Live Jira search/import/refresh, Drive import and Figma import haven't been exercised on the current build (they need the owner's AMAN session). | Confidence in live connector UX. | A guided live pass with the owner. |
| CN-3 | Opportunity | No "Load more" paging (the UI asks to refine the search); no expand-epic-children; no "last used" for a connection (not recorded). | Power-user efficiency. | Later. |

## 9. Search / Notifications

| ID | Severity | Current behaviour | Why it matters | Suggested direction |
|---|---|---|---|---|
| E-5 | Minor | Notifications shows "22 new" beside "All 4 read" (different scopes side by side). Overdue rows aren't status-coloured. | Contradictory-looking counts; weak urgency signal. | Label scopes explicitly; semantic colour on overdue rows. |
| NT-1 | Opportunity | The bell links to a page; there's no inbox popover. | A fast glance without navigating. | Popover inbox reusing the existing read/unread logic. |
| m14 | Minor | The palette shows "Loading initiatives…" about 600 ms after first open. | Perceived speed. | Prefetch the index at idle. |
| P-1 | Watch | A few background RSC-prefetch requests returned 502 (not reproducible; navigation unaffected). One unstyled render at 1366 px didn't reproduce (G-3). | Possible edge instability. | Check Vercel runtime logs (owner access). |
| P-2 | Watch | Latency. Server-side DB hops are now fast in London, but US-measured TTFB didn't improve and cold starts reach 7–10 s. | Perceived speed for first loads. | Measure from Cairo/EU. If needed, reduce duplicated auth resolution (proxy + render) in a separate, reviewed change. |

## 10. Accessibility / interaction polish

| ID | Severity | Current behaviour | Why it matters | Suggested direction |
|---|---|---|---|---|
| F-1 | **Major** | Filter menus (Stage, Owner, Attention, Target, Business line, Setup, Archived, plus the mobile sheet) show no visible checked state; the selection is only in `aria-checked`. | Users can't see what's filtered. It affects every list. | Visible check glyph + selected styling in `Popover` `MenuButton`; the chip shows its count. |
| F-2 | Minor | Tab inside an open menu sends focus to the top of the page. | Keyboard users lose their place. | Tab closes the menu and returns focus to the trigger (or moves to the next control). |
| D-1 / D-2 | Cosmetic | The Help and mobile menu buttons don't expose open/closed state; Help doesn't close on outside click. | Assistive technology and consistency. | `aria-expanded`; outside-click close. |
| G-1 | Minor | At 1024 px the Initiatives register breaks words mid-word ("Unassign/ed") and drops the Updated column. | Tablet legibility. | Breakpoint-specific columns; no mid-word breaks. |
| G-2 | Cosmetic | At 390 px the initiative tab bar is cut off with no scroll cue. | Discoverability on mobile. | Edge fade + scroll snap. |
| A-1 / A-2 / A-3 | Cosmetic | The login error outlines only Email and shifts the form. The signup stepper widens the column by 19 px. Step labels are hidden at 390 px. | First-impression polish. | Reserve error space; fixed stepper width; short labels on mobile. |
| m13 | Minor | Signup "Check your email" has no resend and no countdown. | A dead end if the email is delayed. | Resend with cooldown. |
| 404 | Cosmetic | Buttons touch on the 404 page. | Polish. | Spacing. |

---

## Provisional implementation sequence — PLANNING ONLY, NOT APPROVED

This sequence is a proposal for discussion. **Nothing in it will be started without the owner's explicit approval.** Each step is a separately reviewable, promotable build with its own gates: typecheck, lint, unit tests, build, browser acceptance, privacy scan, and an independent visual check.

1. **Interaction correctness first** (small, high-leverage, low risk): F-1 visible filter selection; F-2 menu Tab behaviour; D-1/D-2 Help semantics; m4 tab click-through; m5 current tab on sub-pages.
2. **Visual system foundation:** define the information-type colour roles and the orange identity accent (VS-1 foundation, I-2). Add one stat-strip component and one page-header pattern (C-1/m8, m6). Apply semantic status where status exists (I-3, E-5). Tokens and primitives only, so every later page inherits them.
3. **Home command centre (I-1 Home):** attention band, 28-day mini-timeline, lifecycle strip, status-banded rows, using existing data only. Include m12.
4. **Initiative Brief cockpit (I-1 Brief):** delivery timeline row, readable lifecycle stepper, attention band, dependency chips. Include E-1, m1, m2, E-2/C-2.
5. **Weekly Review:** per-section state glyphs and colour, change band, action-row fix (E-6, WR-1).
6. **Analysis and Roadmap refinements:** E-4, m7, AN-2; E-3, m15; confirm the RM-1/AN-1 Demo data direction with the owner, then apply it through the operator path.
7. **Administration / Settings, Notifications, Search:** AD-1, m9, m10, E-5 wording, NT-1, m14.
8. **Responsive and cosmetic sweep:** G-1, G-2, A-1–A-3, B-1–B-3, C-3–C-5, 404, D-3, m13, m11.
9. **Independent visual acceptance** (fresh reviewer) on production with the owner's visual-richness criteria. Then consider VS-2 dark mode as a separate scoped proposal.

External or owner-dependent, in parallel: CN-1 Figma app scopes; CN-2 live connector pass; P-1/P-2 Vercel log check and EU latency measurement.
