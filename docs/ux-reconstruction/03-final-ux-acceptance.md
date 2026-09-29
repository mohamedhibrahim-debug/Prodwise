# Prodwise: Final UX/UI Acceptance (live production)

**Reviewer stance:** final acceptance reviewer. This is a pass/fail judgement on what is live. It is not a design iteration and not an improvement backlog: each issue is classified, and nothing below is a redesign proposal. Where Section I names a missing element, it names only data that the page already holds.
**Date:** 29 Sept 2026
**Surface:** production `https://prodwise-flax.vercel.app`, build `d0dd2f9`. The app code is identical to `891eda5`.
- Entered through **Explore Demo** as "Demo Reviewer" (Org Owner of the synthetic "Prodwise Demo" org).
- Login and signup were judged as an anonymous visitor. I submitted `nobody@example.com` / `wrong-password-123` to the login form and `someone@example.com` to the signup form. The signup address is ineligible, so no email was sent.

**Read-only:** I edited no repository file except this one. In production I created, confirmed, rejected, archived, decided, finalized and imported nothing. I only opened menus and popovers, typed into search and filters, and pressed keys.

**Evidence:** screenshots are in `/tmp/claude-0/-home-user-Prodwise/7efb9df6-49dc-5c77-aa8d-1652ac925d9d/scratchpad/final-ux/`. This is session scratch and is **not committed**. Filename prefixes:
- `p-` is a full page at 1440.
- `v-` is the 1440 viewport.
- `r-` is responsive (1366/1024/768/390).
- `m-` is mobile (390).

Earlier smoke-test screenshots in `…/scratchpad/acc/` are cited only for write-result states, which I did not trigger myself.

**Environment caveat:** requests route through a US edge to London functions, so absolute load times are not representative. Responsiveness was judged by click-to-feedback and by the presence of progress or skeleton states.

**Method:**
- Playwright (Chromium) at 1440×900, 1366×768, 1280×680, 1024×768, 768×1024 and 390×844.
- Checks at every width:
  - ARIA roles and states read from the DOM;
  - keyboard walks (Tab, arrows, Escape) with focus tracking;
  - outside-click tests;
  - horizontal-overflow and clipped-control scans at each width.
- A computed-style scan of 18 routes for rendered brand-orange tokens.
- A pixel-composition sample of each full-page screenshot, workspace area only (shell excluded), for Section I.

**Not treated as defects** (truth rules), per the brief:
- "Not recorded" and UNKNOWN states;
- "No … evidence was found" wording;
- Demo labelled synthetic;
- nothing becoming Knowledge without confirmation;
- connectors OFF in the Demo org;
- the archived smoke initiative, which is hidden from Home and the register, as verified: "3 archived hidden".

---

## A. Login page (first impression) and signup

**What was verified:**
- `/login` at 1440, 1366, 1024, 768 and 390.
- Title "Sign in · Prodwise" and the favicon link.
- Tab order and focus rings.
- Empty submit, the hover state, the loading state and the wrong-credentials state.
- `role=alert` on the error.
- `/signup` at 1440 and 390, including the ineligible-email path.
- Screenshots: `login-1440.png`, `login-1024.png`, `login-768.png`, `login-390.png`, `login-tab2.png`, `login-hover.png`, `login-loading.png`, `login-error.png`, `login-empty-submit.png`, `signup-1440.png`, `signup-390.png`, `signup-ineligible.png`.

**Observed quality:**
- **Split layout is balanced.** A navy brand panel (44% at 1440, with a faint arc bleeding off the bottom) sits beside a white form panel whose content is vertically centred.
- **Clear type hierarchy:**
  - 40px brand statement;
  - 26px "Sign in";
  - 13px semibold labels;
  - 40px inputs and buttons, 6px radius.
- **CTA hierarchy is correct.** The primary teal is "Sign in". "Explore Demo" is secondary and outlined, with "Synthetic demo data…" disclosed directly beneath it.
- **Every state is present:**
  - Focus: a cyan ring on inputs and a double ring on buttons and links.
  - Hover: the primary darkens from `#007d91` to `#00667a`.
  - Loading: "Signing in…" with a spinner, inputs greyed, and Explore Demo disabled.
  - Error: an inline `role=alert` "Email or password is incorrect.", which does not disclose whether the account exists.
  - Empty submit: native required validation.
- **Responsive behaviour:** at ≤768 the brand panel collapses to a compact navy header with the tagline. There is no overflow at any width.
- **Consistency with the app:** same navy, same teal and the same Inter scale. It reads as the same product.

| ID | Finding | Severity | Status |
|---|---|---|---|
| A-1 | The wrong-credentials error outlines only the **Email** field in red, although the message covers email *or* password. The whole form also shifts up ~30px when the alert appears, because the content is vertically centred (`login-error.png`). | Cosmetic | Accepted |
| A-2 | Signup: the 3-step stepper does not fit the 384px column. It widens the form to 403px, so the input and Continue button end at x=1248 while the heading and divider end at x=1229 (`signup-1440.png`, measured). | Cosmetic | Accepted |
| A-3 | Signup at 390 hides step labels 2–3 and shows only numbers (`signup-390.png`). This is acceptable compaction. | Cosmetic | Accepted |

**Conclusion:** **The login page is production-quality.** It is professional, balanced, correctly branded, complete in its states and responsive. Signup matches it. The remaining points are cosmetic.

---

## B. Logo and brand

**What was verified:**
- The mark and wordmark in the sidebar (expanded and collapsed), on login at 2×, and in the mobile top bar.
- `/icon.svg` at 16, 32 and 64px, on dark and light tab strips.
- `/apple-icon.png`.
- The small lifecycle ring inside the Brief's stage chip.
- Screenshots: `logo-sidebar.png`, `logo-login-2x.png`, `favicon-sizes.png`, `shell-collapsed-hover-1440.png`, `m-home-390.png`, `brief-header-zoom.png`.

**Observed quality:**
- **Construction:** the mark is an original eight-segment ring with one cyan segment (the lifecycle "Initiative Arc") on a rounded navy tile. It does not resemble any AMAN mark.
- **Icon–wordmark alignment:** optically centred, with a consistent gap in the sidebar, login and mobile header.
- **Wordmark:** Inter Bold, which is clean and legible on navy.
- **Consistency:**
  - the same asset family everywhere;
  - the favicon matches the in-app mark;
  - the collapsed rail keeps the mark and moves the collapse control below it.
- **Contrast:** the light segments on navy are clear at ≥22px.
- **Intent:** the treatment is deliberate, not placeholder.

| ID | Finding | Severity | Status |
|---|---|---|---|
| B-1 | At favicon size (16px) the single cyan segment is barely visible. The mark then reads as a generic dashed "loading spinner" ring, especially in a browser tab that also shows real loading spinners (`favicon-sizes.png`). | Minor | Accepted |
| B-2 | In the sidebar the 22px tile (`--chrome-800`) sits on the rail (`--chrome-900`) with very little separation. At a glance the logo is mostly the wordmark (`logo-sidebar.png`). | Cosmetic | Accepted |
| B-3 | The wordmark is plain Inter Bold with no distinctive letterform. It is serviceable, and neutral by the 30/70 rule, but carries little personality. | Cosmetic | Accepted |

**Conclusion:** the brand is consistent, intentional and legible. Its only weakness is small-size recognisability of the mark (B-1). Nothing here blocks production.

---

## C. Overall visual identity as one system

**What was verified:**
- Every core screen at 1440: `p-home`, `p-initiatives`, `p-brief`, `p-decisions`, `p-knowledge`, `p-sources`, `p-commitments`, `p-risks`, `p-history`, `p-proposal`, `p-roadmap`, `p-weekly`, `p-analysis`, `p-analysis-initiatives`, `p-analysis-project`, `p-connections`, `p-notifications`, `p-account`, `p-new` (all `-1440.png`).
- The tokens in `src/styles/tokens.css`.

**Consistent (verified):**
- **Palette:** navy shell, pale blue-grey canvas, white work surface, teal as the only interactive and brand colour.
- **Buttons:** a filled teal primary, an outlined white secondary, and teal text links, with one radius and one height scale.
- **Typography:** Inter throughout. Page H1 26–32px, section H2 ~18px, body 14px, meta 12–13px.
- **Structure:** 1px rules and pale grey table headers.
- **Pills:**
  - neutral outlined stage pills;
  - dashed "Synthetic demo" pills.
- **Status colours are correct and legible without colour:**
  - green "✓ Confirmed / Target met / Live";
  - amber "▲ Decision needed / Recorded blocker / Overdue / below target";
  - red "■ Blocker";
  - grey "○ Not assessed / Awaiting confirmation / no approved target".
  - Every state carries a glyph and text.
- **Brand orange never carries status.** It is not rendered at all; see I-2.
- **Truth-rule copy is present:**
  - empty states ("No initiatives match these filters.", "Nothing matches '…'.");
  - loading states ("Loading initiatives…" in the palette, a progress bar on navigation);
  - error states ("Reading did not complete", `acc/reading-failed-1440.png`).
- **Charts share one style:** teal line, dashed target, dotted Actual Live marker, and hatched "Not recorded" gaps.

**Verdict on "one product or separately designed screens":** it is one product. The deviations are below.

| ID | Finding | Severity | Status |
|---|---|---|---|
| C-1 | **Two table grammars.** Sources uses uppercase tracked headers under a heavy 2px black rule with 88px-tall rows (`p-sources-1440.png`). The register, Knowledge and Analysis use a rounded bordered table with a sentence-case grey header. The same counts also appear as a light strip with amber numerals on Home and as dark navy tiles on Analysis. | Minor | Accepted |
| C-2 | The **Date changes** group glyph on Proposal Review is invisible. The ◷ is drawn in `rgb(79,98,114)` on a `rgb(122,82,0)` disc (~1.3:1), so it renders as a blank brown dot. The disc also uses the AT_RISK amber family as a category marker (`glyph-group-dates-pending.png`). | Minor | Requires action |
| C-3 | The Analysis "How these counts are calculated" `<summary>` has `display:flex`, which removes the disclosure marker. It reads as a static grey bar (`analysis-details.png`). | Cosmetic | Accepted |
| C-4 | Setup coverage bars at 10/10 use the READY green. The adjacent copy says "not a readiness assessment", so this is honest but chromatically close to READY (`p-initiatives-1440.png`). | Cosmetic | Accepted |
| C-5 | Commitments: the "in progress" glyph is a 6px half-disc that reads as a stray mark (`p-commitments-1440.png`). | Cosmetic | Accepted |

**Conclusion:** the visual system is coherent and the status semantics are correct. The system is consistent but **flat**; that is assessed separately in Section I.

---

## D. Application shell

**What was verified:**
- Sidebar, active state and collapse.
- Organization control, notification bell, account menu, Help, command palette and top bar.
- Mobile drawer.
- Screenshots: `shell-collapsed-hover-1440.png`, `shell-collapsed-reload-1440.png`, `account-menu-1440.png`, `account-menu-collapsed-1440.png`, `account-menu-1280x680.png`, `help-sideHelp-1440.png`, `shortcuts-1440.png`, `palette-open-1440.png`, `palette-results-1440.png`, `palette-empty-1440.png`, `m-nav-open-390.png`, `acc/evidence-saved-1440.png` (bell badge).

**Verified working:**
- **Sidebar:**
  - dark navy rail;
  - active item has a cyan bar, a lighter fill and `aria-current="page"`;
  - a "Current initiative" block appears on initiative pages.
- **Collapse:**
  - the control sits at the top beside the mark (`aria-label` and `aria-expanded` toggle);
  - the `[` shortcut works;
  - collapsed width is 56px and **persists across reload**;
  - collapsed items show tooltips with key hints (e.g. "Roadmap G R").
- **Organization control:** a non-interactive block ("Prodwise Demo", dashed "Synthetic demo" tag) with no chevron and no false affordance. This is honest for a one-org Demo.
- **Account menu:**
  - `role=menu` with `menuitem`s; focus lands on the first item;
  - arrow keys move focus;
  - Escape closes it and returns focus to "Account: Demo Reviewer";
  - outside click closes it;
  - at 1280×680 the menu spans y=296–622 and is fully visible, with Leave demo one click away.
- **Notification bell:** a link with a teal count badge when new items are routed to the viewer (seen in the smoke run). "For me 0" in the Demo correctly shows no badge.
- **Help:** a right-side reference panel. Opening moves focus to its heading. Escape closes it and returns focus to the trigger. `?` opens it at the shortcut list.
- **Command palette (Ctrl/⌘K or click):**
  - `dialog` containing a `combobox` and `listbox`, driven by `aria-activedescendant`;
  - Go-to and Utilities commands, plus initiatives;
  - "Loading initiatives…" state and an honest empty state;
  - Enter navigates;
  - Escape and outside click close it and return focus.
- **Top bar:** "Synthetic demo · Demo dataset V3 · scenario 26 Sept 2026" is permanently visible. It compacts to "Synthetic demo", and search to an icon, at ≤1024.
- **Mobile:**
  - the hamburger opens a full nav drawer;
  - focus moves in, and Escape returns focus to the trigger;
  - Search and Notifications are in the drawer.

| ID | Finding | Severity | Status |
|---|---|---|---|
| D-1 | The Help triggers and the mobile "Open navigation" button expose no `aria-expanded`. | Cosmetic | Accepted |
| D-2 | The Help panel is non-modal and does not close on outside click; × and Escape close it. This is acceptable for a reference panel, but it overlays the top-bar search while open (`help-sideHelp-1440.png`). | Cosmetic | Accepted |
| D-3 | Page titles and breadcrumbs are inconsistent: <ul><li>Home's tab title is "Home" (every other page is "… · Prodwise");</li><li>the Commitments tab's title is "Actions · …";</li><li>the Analysis initiative breadcrumb says "Analysis / Initiative" instead of the initiative name.</li></ul> | Cosmetic | Accepted |

**Conclusion:** the shell is production-quality. Every control is reachable, honest and keyboard-operable, and the earlier audit's shell blockers are resolved.

---

## E. Core screens

| Screen | Hierarchy / CTA / scanability | Findings (ID · severity · status) |
|---|---|---|
| **Home** (`p-home-1440.png`) | Passes the five-second test:<ul><li>a Start-here line naming the live decision;</li><li>a 7-count strip;</li><li>Needs attention grouped by initiative, each reason with a direct action and a Next step;</li><li>Weekly Review progress and "Continue review" primary;</li><li>Coming up and What changed.</li></ul>Reason text truncates with an ellipsis at 1440. | See I-1 (visual composition). |
| **Initiatives register** (`p-initiatives-1440.png`, `filter-stage-multi.png`) | Clean table with a sort indicator, amber attention reasons with "+n", setup bars, "Moved +14 d" and "Explicitly unknown". The empty state has a Clear action. It becomes a card list at 768. | F-1 (filter checked state) · Major · Requires action. G-1 (1024 wrapping) · Minor · Requires action. |
| **Initiative Brief** (`p-brief-1440.png`) | A headline sentence of stage, reasons, target and milestone; a Next-step callout with "Review decision"; Needs attention; Open work with inline Complete; Delivery facts with honest "Missing Actual Live does not establish…"; Relationships. Primary "Add evidence" and secondary "Manage initiative" are clear. | See I-1. |
| **Sources** (`p-sources-1440.png`) | Grouped by boundary (Current Scope 9 / Future Phase 1 / Historical 1 / Related 2 / Excluded 1), with a Demo connectors-off notice and manual add links. | E-1 · Minor · Requires action: <ul><li>a second, identical primary "Add evidence" sits 140px below the header's (the header menu even overlaps it, `add-evidence-menu-1440.png`);</li><li>the "MERCHANT FLEX FINANCE" eyebrow starts 1px under the tab rule (measured 198→199; the Brief has ~20px).</li></ul> |
| **Proposal Review** (`p-proposal-1440.png`) | Two columns: the read-only notes as pasted, and the proposals grouped by kind with CURRENT vs PROPOSED, exact quote, "Show in source", and Apply/Reject. Accepted, rejected and already-recorded counts are stated. The reading is labelled "prepared demo reading (synthetic, not AI)". | E-2 · Minor · Requires action: two proposals labelled "○ Needs your decision" sit under a header that says they "are not counted as waiting". Their "Already recorded" notes use the amber at-risk tint for neutral information. C-2 (invisible glyph) also applies. |
| **Decisions** (`p-decisions-1440.png`) | The strongest screen: 27 vs 30 as large side-by-side values with source ids, a NEEDS A DECISION tag, an amber top rule and a separate "Record a decision" panel. Destructive "Dismiss…" is visually distinct. | None. |
| **Roadmap** (`v-roadmap-1440.png`, `v-roadmap-1440-s1.png`) | A time-first timeline: bars, target diamonds, Live markers, target-moved ghosts, dependency-late connectors, a scenario-date line and semantic chips. Unscheduled initiatives are listed separately; no date is assumed. | E-3 · Minor · Accepted: the month header does not stay pinned, so after one scroll rows lose their month labels. The Details table below repeats the timeline as ~2,000px of text. |
| **Analysis — portfolio** (`p-analysis-1440.png`) | Dark KPI tiles, a lifecycle distribution bar, attention-by-reason bars, and upcoming, coverage and revision tables with met / below / no-target glyphs. | See I-1. |
| **Analysis — initiative** (`v-analysis-project-1440.png`, `chart-zoom.png`) | Latest-period tiles with sparklines; 7 charts, each with target, Actual Live and hatched gaps; a metric contract beside each chart. | E-4 · Minor · Requires action: a chart label collision renders "571 merchants **hants**" (the target label is partly hidden behind the value label). The section-level empty space is covered under I-1. |
| **Connectors** (`p-connections-1440.png`) | Four connectors, each listing READS / NEVER / ACCESS REQUESTED, a neutral "Not connected" pill, and an explicit Demo-off notice. No fake connect buttons. | None. |
| **Notifications** (`p-notifications-1440.png`, `notifications-everything.png`) | For me / Everything segments, kind filters, NEW pills, "not assigned to you" and "Open →". | E-5 · Minor · Requires action: <ul><li>in For me, the header reads "22 new in Prodwise Demo" beside "All 4 read", which contradicts at a glance;</li><li>overdue and past-needed-by items are plain grey text, while the same fact is amber "▲ Overdue" on the Commitments tab.</li></ul> |
| **Weekly Review** (`v-weekly-1440.png`, `r-weekly-1024.png`) | A comparison baseline, a 2/14 progress bar, a section navigator grouped by owner, a frozen record, a commentary form, record updates, and finalize prerequisites. | E-6 · Minor · Requires action: <ul><li>an empty band between two rules under the header;</li><li>"Update to latest records" (primary) and the disabled "Draft wording" are misaligned vertically;</li><li>"Initiative records changed after the snapshot · 0 sections affected" still gates finalization, which is confusing;</li><li>the navigator's status text ("Needs review", "Decision needed", "Recorded blocker") is grey where the same reasons are amber elsewhere.</li></ul> |
| **Account** (`p-account-1440.png`) | Identity, a Demo notice, Sign out, and a current-organization panel. | Cosmetic · Accepted: the "Identity" heading starts ~20px higher than the "Current organization" heading beside it. |
| **Create initiative** (`p-new-1440.png`) | Four essentials, autofocus on name, optional objective, primary/secondary pair. | None. |
| **404** (`p-search-1440.png`) | Honest "Nothing was changed." | Cosmetic · Accepted: the "Go to Home" and "Initiatives" buttons touch (0px gap, measured). |

**Conclusion:**
- Every core screen has a clear orientation line and an obvious key action, and all of them respect the truth rules.
- The Decisions, Roadmap and Proposal screens are strong.
- The remaining issues are local clarity and spacing defects, none of which blocks a task.

---

## F. Interaction quality

**What was verified:**
- Hover:
  - primary, nav and register row hover;
  - the whole register row is a link.
- Pressed and loading:
  - the login spinner;
  - the navigation progress bar.
- Focus: the double ring is visible on every stop in a 14-stop Tab walk, including "Skip to main content".
- Disabled states: Signup Continue, Add question, Draft wording, Finalize.
- Escape and outside click on the account menu, Add evidence, all 7 register filters, the palette and Help.
- Focus return after close.
- Menu semantics: `aria-haspopup="menu"` and `aria-expanded` on triggers; `menuitem` / `menuitemcheckbox` / `menuitemradio`.
- Screenshots: `focus-nav-1440.png`, `focus-content-1440.png`, `hover-row.png`, `filter-stage-open.png`, `filter-stage-multi.png`, `filter-stage-checked-zoom2.png`, `add-evidence-menu-1440.png`.

**Verified working:**
- **Multi-select filters** (Stage, Owner, Attention, Target, Business line):
  - use `menuitemcheckbox`;
  - **stay open** across selections;
  - update the list and URL live;
  - the trigger reads "Stage: 2 selected" with a × clear.
- **Single-select filters** (Setup, Archived) use `menuitemradio` and **close** on choice, returning focus to the trigger.
- No menu was stuck, and no action was hidden.

| ID | Finding | Severity | Status |
|---|---|---|---|
| F-1 | **Selected filter options have no visible checked state.**<ul><li>After choosing Definition and Alignment, the DOM has `aria-checked="true"` on both, but the menu renders them identically to unselected options: no check, no fill, no weight change (`filter-stage-checked-zoom2.png`). The same applies to the radio filters and to the mobile bottom sheet (`m-filter-390.png`).</li><li>Sighted users cannot see which of 8 stages or 5 owners are active, or that clicking an option again deselects it.</li><li>Cause: `MenuButton` in `src/components/primitives/Popover.tsx` sets `aria-checked` and passes no indicator, and `Popover.module.css` has no `[aria-checked]` rule.</li><li>Not a Blocker: the trigger count, the result count and "Clear" still make the filter usable.</li></ul> | **Major** | **Requires action** |
| F-2 | Pressing Tab inside an open menu closes it but sends focus to the **document start** ("Skip to main content"). It should go to the next control after the trigger. The layer is portalled at the end of `body`. | Minor | Requires action |

**Conclusion:** interaction is now modern and well-behaved, with one material state-feedback gap (F-1).

---

## G. Responsive and viewport safety

**What was verified:**
- 13 routes at 1366, 1024, 768 and 390, scanned for:
  - page-level horizontal overflow;
  - interactive controls clipped outside the viewport;
  - unintended inner scrollers.
- The account menu at 1280×680.
- Add evidence and filter menus on mobile.
- Screenshots: all `r-*.png` and `m-*.png`, plus `account-menu-1280x680.png`, `m-add-evidence-390.png`, `m-filter-390.png` and `m-home-strip-390.png`.

**Result:**
- **Zero page-level horizontal overflow** and **zero clipped interactive controls** on all 52 route×width combinations.
- The inner scrollers are intentional:
  - roadmap timeline;
  - analysis tables;
  - initiative tab bar at 390.
- Menus become bottom sheets at 390.
- The account menu fits a 680px-tall laptop.
- The register becomes cards at 768.
- The Decisions screen adds a "Decision controls ↓" jump on narrow screens.

| ID | Finding | Severity | Status |
|---|---|---|---|
| G-1 | At **1024** the sidebar stays expanded (232px) and the register table compresses. Words break mid-token ("Unassign/ed", "Release Preparatio/n" inside stage pills, `overflow-wrap: break-word` on 79px pills), and the Updated column is dropped (`r-initiatives-1024.png`). It looks unfinished at a common laptop and tablet width. | Minor | Requires action |
| G-2 | At 390 the initiative tab bar is cut at "Comm…" with no fade or scroll cue. The Home count strip's "Recorded blockers" label touches the strip's right border (`r-brief-390.png`, `m-home-strip-390.png`). | Cosmetic | Accepted |
| G-3 | **One transient unstyled render.** The first Home load at 1366 rendered with the page stylesheet missing (`r-home-1366.png`). It did not reproduce in 17 further cold and warm loads, where all 7 stylesheets returned 200. The environment's proxy logged relay failures in the same session, so an environment cause is likely but not proven. | Minor | Requires action (check production logs for 5xx on `/_next/static/*.css`) |

**Conclusion:** the layout is viewport-safe at every width tested. The 1024 register is the only layout that looks under-finished.

---

## I. Visual richness and information visualisation

The product owner's intended direction:
- a deep navy shell;
- cyan/teal identity;
- a **restrained orange secondary accent** (decoration and identity only);
- a light workspace;
- semantic status colour;
- stronger differentiation between information types;
- richer visualisation where it improves understanding;
- fewer repetitive white cards and less empty white space;
- page compositions fitted to each job;
- a "modern AI product-management workbench / command centre" rather than a static admin dashboard, CV or documentation portal.

**How this was measured:**
- Each full-page 1440 screenshot was sampled over the workspace only (shell excluded).
- "White/neutral" means near-white or unsaturated pixels.
- "Chromatic" means teal, amber, red and green pixels, which includes link text, so it is an upper bound.
- A computed-style scan of 18 routes looked for the brand-orange tokens (`#a04818`, `#dc6b2f`, `#f2ddd0`).
- **The brand orange is rendered on none of them, and not on login either.** The login arc is navy.

| Page | Current composition | Monochrome / repetition / empty space | Missing or weak visualisation (existing data only) | Severity |
|---|---|---|---|---|
| **Home** | <ul><li>Start-here banner;</li><li>a 7-number strip;</li><li>a long Needs-attention text list;</li><li>three right-rail white cards (Weekly Review with a thin progress bar, Coming up list, What changed list);</li><li>a near-empty "Your work" card.</li></ul> | 93% white/neutral, ~5% chromatic. Five white bordered cards of text rows. Amber appears only in the ▲ reason labels and some numerals. It reads as a list page, not a command centre. | <ul><li>The count strip is bare numbers; "8 need attention of 14" has no proportion or status band.</li><li>"Coming up" is a date list of 7 targets/milestones inside 28 days, where the Roadmap already draws them as a timeline.</li><li>The attention-by-reason breakdown already drawn on Analysis (decision 3, blocker 3, past target 1, dependency 4) is absent here.</li></ul> | **Major** |
| **Initiative Brief** | A headline sentence, a Next-step callout, Needs attention, an Open work list and a What changed list. The right rail holds a Setup bar, Delivery facts key-value pairs, a Relationships text list and 3 count tiles. | 94% white/neutral. Six stacked white cards. Lifecycle position appears only as a 14px ring inside the stage chip. | <ul><li>No delivery timeline for the initiative, although the page states Development start 14 Sept, next milestone 29 Sept, Target Live 15 Oct (moved from 1 Oct) and the scenario date. The Roadmap renders exactly this row.</li><li>The 8-stage lifecycle position (the Arc) is not shown at a readable size.</li><li>Relationships are text, not a dependency visual.</li></ul> | **Major** |
| **Roadmap** | A navy-headed time grid with bars, milestones, target diamonds, moved-target ghosts, dependency connectors, a scenario line and semantic chips, followed by a long Details text table. | The richest page, and correctly job-specific. The lower ~50% is a monochrome text table repeating the timeline. | The timeline month header is not pinned (E-3). Nothing else is missing. | Minor · Accepted |
| **Analysis — portfolio** | Dark KPI tiles, a lifecycle distribution bar, attention bars, and three tables with status glyphs. | 90% white/neutral, but with purposeful navy tiles and teal/amber data ink. A distinct composition. | "Business metrics coverage" is a text table; the per-initiative met / below / no-target counts in it are not drawn. | Minor · Accepted |
| **Analysis — initiative** | Sparkline tiles, then 7 metric sections, each a ~300px chart beside a ~900px contract table. | 96.5% white/neutral. Each section leaves a ~600px white void under the chart, and the page is 7,942px tall. Label collision (E-4). | Charts exist. The weakness is the empty space from the chart/contract proportion, not a missing chart. | Minor · Requires action |
| **Sources** | A grouped table: 14 rows of title, mono reference, type, date and count, plus "▸ Details". | 96.5% white/neutral. 88px rows carry one line of content. Boundary groups are grey bands with no differentiation. Type is plain text. | <ul><li>No source-type iconography (Jira / Document / Decision Note / Email / Meeting are known per row).</li><li>No compact boundary distribution; the counts 9/1/1/2/1 exist in the group headers.</li></ul> | Minor · Requires action |
| **Decisions** | Large 27 vs 30 value comparison, source ids, a NEEDS A DECISION tag with an amber top rule, and a separate action panel. | Purposeful, distinct composition. The colour carries meaning. | None. | Accepted |
| **Risks & questions** | Two columns: risks grouped by status, with owner, mitigation and source; open questions with an Answer action. | 94.7% white/neutral. Neutral pills are correct, because risks deliberately carry **no severity** (truth rule), so a risk heat-map would fabricate data. | Only the header count line (0 open · 1 mitigating · 2 awaiting · 1 question) could be a compact status band. | Minor · Accepted |
| **Weekly Review** | A long document-form: baseline text, a 2/14 progress bar, an owner-grouped section navigator, frozen record, commentary textareas, record-update checkboxes and a prerequisites link list. | 96.2% white/neutral. It reads like a documentation page. The navigator's 14 review states and attention reasons are grey text. | <ul><li>No review-state glyph or colour per section; Reviewed / Needs review and the reasons are known per section.</li><li>The prerequisites are underlined links, not state markers.</li></ul> | Minor · Requires action (see also E-6) |
| **Connectors** | One bordered list of 4 connectors, each with READS / NEVER / ACCESS rows and a Not connected pill. | Appropriate for a settings page. Neutral is correct while every connector is off. | None needed. | Accepted |
| Initiatives register *(context)* | A dense table with setup bars and amber attention. | Appropriate for a register. | None. | Accepted |
| Notifications *(context)* | A grouped list of rows. | 96.3% white/neutral. Overdue and past-due rows are not status-coloured (E-5). | Status colour for overdue and past-needed-by items only. | Minor · Requires action |

| ID | Finding | Severity | Status |
|---|---|---|---|
| **I-1** | **Visual richness.**<ul><li>The two primary daily surfaces, **Home** (the "command centre") and the **Initiative Brief**, are predominantly monochrome text-and-rule lists stacked in repetitive white bordered cards. 93–94% of their workspace is white/neutral.</li><li>They do not visualise schedule, lifecycle or attention-mix data that they already hold, and that the Roadmap and Analysis already know how to draw.</li><li>Sources, Weekly Review and Notifications lean further toward a document or portal feel.</li><li>Roadmap, Analysis and Decisions show that the system can do job-specific, visually rich compositions. The weakness is concentrated where users land every day.</li></ul> | **Major** | **Requires action** |
| **I-2** | The **restrained orange secondary accent is absent from the live product.** The tokens exist (`--brand-orange`, `--orange-geometry`, `--brand-orange-soft`), but 0 elements render them across 18 routes and login. Brand identity is carried by navy + teal alone, which adds to the "one fixed colour" impression. (Status semantics are unaffected: orange correctly carries no status.) | Minor | Requires action |
| I-3 | Status colour is used correctly wherever status is shown as a chip or label. It is **not** used in three places where status exists: the Weekly Review navigator, the Notifications overdue rows, and the "Already recorded" proposal notes, which use amber for neutral information (E-2, E-5, E-6). | Minor | Requires action |

**Conclusion on visual richness:**
- **Credibility is not at issue.** The product is consistent, calm, credible and truthful, and it does not look like a generic admin template.
- **The positioning is not yet met.** It does not yet look like the "command centre / AI workbench" the owner describes. Home and the Brief carry most of that gap (I-1, Major), and the missing secondary accent (I-2) adds to it.
- **This is not a Blocker.** Under the acceptance definition of a Blocker (breaks a core task, violates a truth or status rule, hides or clips a critical control, or looks clearly broken), I-1 does not qualify:
  - every task completes;
  - every status is correct;
  - nothing looks broken.
- It is the single largest open UX/UI item.

---

## H. UX/UI Final Acceptance Result

**What was verified:**
- Login and signup as an anonymous visitor, with all states.
- Brand assets at all sizes.
- The whole visual system across 19 authenticated routes.
- The complete shell: sidebar, collapse persistence, org control, bell, account menu, Help, palette and mobile drawer.
- Every core screen named in the brief.
- Interaction states and keyboard behaviour on every menu and popover, with ARIA semantics read from the DOM.
- Responsive safety on 13 routes × 4 widths plus a 680px-tall laptop.
- A dedicated visual-richness and colour-composition assessment (Section I), including a DOM scan for the orange accent.

**Not verifiable read-only:**
- The success toasts and states after real writes. The earlier smoke screenshots show saved-evidence and reading-failed states rendered correctly (`acc/evidence-saved-1440.png`, `acc/reading-failed-1440.png`).
- A successful real-account sign-in.

### Remaining issues

| ID | Area | Severity | One line | Status |
|---|---|---|---|---|
| F-1 | Interaction | **Major** | Filter menus show no visible checked state (`aria-checked` only). | Requires action |
| I-1 | Visual richness | **Major** | Home and Initiative Brief are monochrome text-and-card lists that do not visualise data they already hold. | Requires action |
| I-2 | Visual identity | Minor | Brand orange secondary accent is rendered nowhere. | Requires action |
| I-3 | Visual system | Minor | Status colour missing in the Weekly Review navigator and Notifications overdue rows; amber used for neutral "Already recorded" notes. | Requires action |
| E-1 | Sources | Minor | Duplicate primary "Add evidence"; eyebrow 1px under the tab rule. | Requires action |
| E-2 | Proposal Review | Minor | "Needs your decision" label on proposals the header says are not waiting. | Requires action |
| E-4 | Analysis (initiative) | Minor | Chart label collision "571 merchants hants"; ~600px voids per metric section. | Requires action |
| E-5 | Notifications | Minor | "22 new" beside "All 4 read"; overdue rows uncoloured. | Requires action |
| E-6 | Weekly Review | Minor | Misaligned action row, double rule, "0 sections affected" yet update still required, grey status text. | Requires action |
| C-2 | Proposal Review | Minor | "Date changes" group glyph invisible (brown dot). | Requires action |
| F-2 | Interaction | Minor | Tab from an open menu sends focus to the document start. | Requires action |
| G-1 | Responsive | Minor | 1024 register: mid-word breaks in owner and stage pills; Updated column dropped. | Requires action |
| G-3 | Responsive / delivery | Minor | One transient unstyled Home render; not reproduced in 17 retries. | Requires action (log check) |
| B-1 | Brand | Minor | Mark reads as a loading spinner at 16px. | Accepted |
| C-1 | Visual system | Minor | Two table grammars and two KPI-strip treatments. | Accepted |
| E-3 | Roadmap | Minor | Month header not pinned; long text Details table. | Accepted |
| A-1 | Login | Cosmetic | Error outlines only Email; form shifts on error. | Accepted |
| A-2 | Signup | Cosmetic | Stepper widens the column by 19px, misaligning edges. | Accepted |
| A-3 | Signup | Cosmetic | Step labels hidden at 390. | Accepted |
| B-2 | Brand | Cosmetic | Sidebar logo tile low separation from the rail. | Accepted |
| B-3 | Brand | Cosmetic | Wordmark is plain Inter Bold. | Accepted |
| C-3 | Analysis | Cosmetic | Disclosure summary has no chevron. | Accepted |
| C-4 | Register / Brief | Cosmetic | Setup 10/10 bar uses READY green (disclaimer present). | Accepted |
| C-5 | Commitments | Cosmetic | Tiny half-disc "in progress" glyph. | Accepted |
| D-1 | Shell | Cosmetic | No `aria-expanded` on Help and hamburger triggers. | Accepted |
| D-2 | Shell | Cosmetic | Help panel ignores outside click (non-modal by design). | Accepted |
| D-3 | Shell | Cosmetic | Tab titles and breadcrumb naming inconsistencies. | Accepted |
| G-2 | Responsive | Cosmetic | 390 tab bar clipped without a cue; count label touches its border. | Accepted |
| — | Account / 404 | Cosmetic | Heading offset on Account; touching buttons on 404. | Accepted |

**Does any remaining issue block production?**
- **No.** No issue breaks a core task, violates a truth or status rule, hides or clips a critical control, or makes the product look broken.
- **The two Majors are real:**
  - **F-1** is a genuine feedback gap on a core control.
  - **I-1**, from the visual-richness assessment in Section I, means the product does not yet deliver the owner's "command centre / AI workbench" visual positioning on Home and the Brief. It is consistent and credible, but predominantly monochrome and card-repetitive, and the secondary orange accent is absent (I-2).
- I-1 is Major and requires action. It is judged non-blocking because it is a positioning gap, not a defect.
- If the owner makes that positioning a release gate, I-1 is the item that would hold release. That is the owner's call, not a defect gate.

**Verdict:** UX/UI Accepted with Non-Blocking Issues
