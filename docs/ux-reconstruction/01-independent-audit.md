# Prodwise: Independent UX / Interaction / Visual Audit

**Auditor stance:** outside senior enterprise UX / interaction / frontend-design reviewer. I assumed nothing was good. I did not edit any source file, commit or push. Production was browsed read-only.
**Date:** 28–29 Sept 2026
**Surfaces reviewed:**
- Production `https://prodwise-flax.vercel.app`, entered through **Explore Demo** as "Demo Reviewer" (shown as Org Owner of the synthetic "Prodwise Demo" org).
- Local dev `http://localhost:3100` as ORG_OWNER (`owner.demo@…`), VIEWER (`reviewer.demo@…`) and Platform Owner (`mohamed.hibrahim@…`).

**Evidence:** screenshots are in `/tmp/claude-0/-home-user-Prodwise/7efb9df6-49dc-5c77-aa8d-1652ac925d9d/scratchpad/audit/`, which is session scratch and is **not committed**. Prefix `p-` / `p_` is production at 1440, `m-` is production at 390, and `l-` is local. The key code references are cited inline so the findings can be reproduced without the PNGs.
**Competitive research:** web access was restricted, so every competitor comparison comes from my own working knowledge of Jira Cloud, Jira Product Discovery, Linear, Productboard, Aha! and Notion as of 2025–26. I did not re-verify any of it live, and it should be treated as expert recollection rather than a citation.

---

## Verdict in one paragraph

Prodwise has a **serious, honest information model** and is built by a team that clearly cares about Rule 4 wording. The **interaction layer is at "internal tool v0.3" level**, though. The popovers are raw `<details>` elements that never close. Controls are 44px tall everywhere with no size scale. Filters are GET forms with an **Apply filters** button. The roadmap is a list with a 260px sparkline squeezed into the middle. Every initiative tab stacks a second eyebrow + H1 + description under the initiative's own H1. Two nav items share the same icon. The account menu is clipped on a 680px-tall laptop. The canvas is a single flat pale blue-grey (`#dde5eb`), and white "cards" float on it with no surface hierarchy. Copy explains everything three times. The product reads as a *carefully written document*, not a *fast working tool*. Jira, Linear and Productboard all feel dense, instant and keyboard-first; Prodwise feels explanatory, slow (1.4–3.6 s to content) and form-driven.

---

## A. Top 15 problems, ranked

Severity scale:
- **Blocker:** breaks trust or makes the product look unfinished to an enterprise buyer in a demo.
- **Major:** clearly junior; fix before any external demo.
- **Minor:** polish.

### 1. Blocker: popovers and menus do not behave like popovers
- **Screen:** global. This covers the account menu, **Add evidence**, and every `<details>`-based disclosure (19 components use `<details>`).
- **Evidence:** measured on production.
  - Account menu (`aside details`): `open` is still `true` after an outside click, and still `true` after Escape (`p-acctmenu-after-outside.png`).
  - **Add evidence** (`WorkspaceHeader addMenu`): still open after an outside click and after Escape (`p-addevidence-open.png`).
  - The account menu opens **inline** and pushes Help and the rest of the rail up by 117px (`p-acctmenu-open.png`: Help jumps from y=751 to y=634).
  - None of the triggers expose `aria-expanded` or `aria-haspopup="menu"`, and there is no roving focus or arrow-key support.
- **Why it feels junior:** this is the first thing an experienced user tests. In Linear, Jira and Notion every menu closes on outside click, Escape and item activation, and returns focus to its trigger. A menu that stays open feels broken, not minimal.
- **Fix:** build one `Popover`/`Menu` primitive (no new dependency: use the `popover` attribute plus `showPopover()`, or a small hook) and apply it everywhere. The behaviour contract is in §E4. Retire `<details>` for anything that floats. Keep `<details>` only for in-flow disclosure ("Details", "Why raised").

### 2. Blocker: the account menu is clipped, and Sign out is hidden in it
- **Screen:** nav rail footer.
- **Evidence:**
  - At 1366×680 (a common 13" laptop with browser chrome), the menu's bottom edge is at y=700 while the viewport is 680 and `.rail{overflow:hidden}`. **Sign out is cut off** (`p-acct-1366x680.png`).
  - When the rail is collapsed, the menu flies out at a fixed position over the content with no arrow, header or identity (`p-collapsed-acct.png`).
  - The trigger is a bare letter "D" or "L" with no avatar circle, no email and no role.
- **Why it feels junior:** the account menu is the most-used utility menu in any SaaS tool. Clipping Sign out is a classic junior layout bug, caused by putting a menu inside an overflow-hidden, fixed-height container.
- **Fix:** render the menu in the top layer (popover), anchored above the trigger. It should open upward, flip if needed, and be 280px wide. The full spec is in §E2.

### 3. Blocker: the canvas is flat and washed out, with no surface hierarchy
- **Screen:** global. The canvas is `--canvas:#dde5eb`, the panel is `#fff`, and `--surface-subtle` is `#eef2f5`.
- **Evidence:**
  - The workspace header, the page body, table header rows, the filter bar, side panels ("Attention by recorded reason", "How connected sources work") and the decision queue all sit on nearly the same pale blue-grey (`p_analysis_portfolio-1440-full.png`, `l-owner_account_connections.png`).
  - The Brief puts body copy directly on the grey canvas, while the Delivery facts card beside it is white with a 3px navy top bar (`p_initiatives_merchant-flex-finance-1440.png`).
  - Tables are white; filter rows are grey. There is no rule for which things are "work surfaces".
- **Why it feels junior:** the palette has one background and one "card white", used arbitrarily. In Linear and Jira the canvas is either the work surface itself or a clearly distinct gutter, and text always sits on a surface of known contrast.
- **Fix:** adopt the three-tier surface model in §D:
  - chrome (navy)
  - canvas (a deeper blue-grey, `#cfd9e2`, used only as the gutter)
  - work surface (white, containing all primary reading content)
  - sunken (`#f1f4f7`, used for table headers and filter bars inside the white surface)

  Make the entire page body of each screen a white sheet on the canvas. Do not use a card per section.

### 4. Blocker: Roadmap is not a roadmap
- **Screen:** `/roadmap` (`p_roadmap-1440.png`, `p_roadmap-1440-full.png`).
- **Evidence:**
  - The time axis (1 Jun to 20 Oct) gets about 570px of a 1100px table. The other columns are a 240px label column and a 270px free-text "Next milestone / attention" column.
  - Rows are 140–300px tall because the right column wraps paragraphs, so 14 initiatives need 3,700px of scroll.
  - Bars are 3px hairlines. There are no month gridlines in the body, the "today" line is a dotted 1px stroke, and target movement is only text ("Moved +14 d").
  - Dependencies are prose ("Depends on … date impact not assessed"), not connectors.
  - Business-line headers mix codes and names ("Business line BP", "Business line Acceptance").
  - Filters are four native selects plus an Apply button. At 390px the date input shows "09" (`m-roadmap-390.png`).
- **Why it feels junior:** it looks like a table that contains a sparkline. Jira Plans/Timeline, JPD Timeline, Productboard and Aha! all make **time the canvas**, with fixed-height rows (32–40px), a sticky left name column, and details in a side panel.
- **Fix:** rebuild to the §E5 spec.

### 5. Major: the double header ("initiative H1 + tab eyebrow + tab H1 + description") wastes 250–330px on every tab
- **Screen:** every initiative tab (Decisions, Knowledge, Sources, Commitments, Risks & questions, History, Setup, Meeting notes).
- **Evidence:**
  - Knowledge: the initiative H1 (34px) and tabs are followed by "STRUCTURED LEDGER", "Knowledge record" (24px), a description line, then a link line, then segmented tabs. The first data row starts at y=640 on a 900px screen (`p_initiatives_merchant-flex-finance_knowledge-1440.png`).
  - Commitments: "OWNERSHIP INTO ACTION" eyebrow, then a 32px H1, then the description, then the button. Content starts at y=480.
  - The tab H1 sizes are inconsistent: Sources and Knowledge use 24px; Commitments, History and Risks use 32px; Decisions uses 26px. The x-origin also varies: Decisions at 284px, Setup at 294px, the rest at 288px.
  - The eyebrows are marketing slogans ("OWNERSHIP INTO ACTION", "STRUCTURED LEDGER", "ATTENTION CENTER", "PORTFOLIO MANAGEMENT REVIEW").
- **Why it feels junior:** each tab was designed as a standalone page and then placed under a shared header. Linear and Jira issue views never re-title a tab. The tab label *is* the title.
- **Fix:**
  - Delete the tab-level eyebrow, H1 and description.
  - Replace them with a 40px **tab toolbar**: count or summary on the left ("16 entries · 1 differs"), view controls in the middle (segmented filter), and the primary tab action on the right.
  - Move the explanatory sentence into Help ("About this page"), which already exists.
  - Content should start at or below y=280 on a 900px viewport.

### 6. Major: Roadmap and Analysis share one icon, and "Collapse" uses a pin
- **Evidence:**
  - `NavRail.tsx`: both the Roadmap and Analysis links use `icon:'reporting'`. The collapsed rail shows two identical line-chart glyphs (`p-collapsed.png`).
  - The initiative context item reuses the Initiatives icon.
  - Collapse uses `InstrumentIcon name="pin"` and the aria-label "Pin expanded navigation", which mixes two metaphors (pin versus collapse).
  - Help is a bold "?" character and the account item is a bold initial letter; neither is an icon.
- **Why it feels junior:** in a collapsed rail the icons *are* the navigation. Identical icons make the collapsed state unusable.
- **Fix:** one 20px outline icon set at a consistent 1.5px stroke:
  - Home: house
  - Initiatives: stacked list
  - Roadmap: horizontal bars on a time axis (gantt)
  - Weekly Review: calendar-check
  - Analysis: bar chart
  - Administration: shield or gear
  - Help: circle-question
  - Account: 24px avatar circle with initials

  The collapse toggle is a `«` / `»` panel icon at the **top** of the rail, next to the wordmark. The §E1 spec applies.

### 7. Major: filters are GET forms with "Apply filters" and oversized native selects
- **Screens:** Initiatives register, Roadmap, Analysis/Initiatives, Administration/Users.
- **Evidence:** four 44px-tall native `<select>`s plus **Apply filters** and **Clear** (`p_initiatives-1440.png`). Nothing happens until Apply is clicked, and every Apply triggers a full server render of about 1.5 s.
- **Why it feels junior:** Jira, Linear and JPD all use instant **filter chips** ("Stage: Delivery ×") with a typeahead popover and multi-select. The URL updates as you go and the result updates in under 100ms client-side for a 14–200 row list.
- **Fix:**
  - Put a filter bar (32px tall) above the table: a search field (240px), a "+ Filter" chip button that opens a popover listing fields, and one chip per active filter.
  - Filter client-side against the already-loaded rows and mirror the state to the query string with `router.replace` (no navigation).
  - Show the result count live.
  - Add saved views later.

### 8. Major: tables have misaligned baselines and 100–120px rows
- **Screens:** Initiatives register, Analysis tables, Sources, Administration.
- **Evidence:**
  - In the first column the initiative name is vertically centred, while every other column is top-aligned, so row text sits on two baselines (`p_initiatives-1440.png`: "Agent Cash-In Network" at y=500 and "Discovery" at y=489; the Analysis "Upcoming Target Live" table shows the same).
  - Header cells are misaligned too: "Initiative ↑", "Attention" and "Target Live" sit about 12px lower than "Stage", "Owner" and "Setup".
  - Row heights are 105–122px on the register, 77px on the Analysis tables and 93px on Sources.
  - The admin table header wraps "Acces / s" (`l-owner_administration.png`).
  - The role pill "Org Owner" wraps onto two lines.
- **Why it feels junior:** baseline alignment is the first thing an enterprise table reviewer notices. Jira's list view uses 40px rows and Linear uses 36–44px rows.
- **Fix:**
  - One `DataTable` style: `vertical-align: top` on all cells, header height 36px, 12px/600 uppercase-free header labels, and a row height of 44px for single-line rows.
  - Secondary metadata (business line, key) goes inline after the name in `--ink-500` 12px, or into a hover card, not onto a second line.
  - `white-space: nowrap` on headers and pills, with a min column width.

### 9. Major: there is no button system (four styles on one screen, 44px everywhere)
- **Evidence:**
  - 123 hard-coded `min-height:44px` and 120 raw `<button>` usages versus one `Button` primitive.
  - Weekly Review alone shows a solid navy button, a grey-bordered button, a flat "Draft" chip-like button and a dashed-border "Draft wording" disabled button (`p_weekly-review-1440.png`).
  - On Decisions, "Make a decision" is 12px bold and "Defer…" is 15px regular, both 44px tall (`p_initiatives_merchant-flex-finance_decisions-1440-full.png`).
  - "Add question" on Risks is a dashed outline.
  - The primary button colour is navy, which is the same as the chrome, so the primary action does not stand out from structure.
  - The primary CTA on the Brief ("Update delivery facts") is a full-width 46px slab.
- **Why it feels junior:** there is no scale (sm/md/lg), no consistent type, and dashed borders are used for "disabled".
- **Fix:** the button spec in §D5, with 32px default height in dense surfaces, 36px for page-level actions and 44px only on touch or mobile. Reserve the cyan-600 fill for the single primary action per view.

### 10. Major: the loading state is a broken-looking full-bleed stripe block, and time to content is 1.4–3.6 s
- **Evidence:**
  - Measured on production (two runs each), in the format feedback / URL / content:

    | Navigation | Feedback | URL | Content |
    |---|---|---|---|
    | Home→Initiatives | 53–69 ms | 68–86 ms | **1.5–1.8 s** |
    | Register→Brief | 55–57 ms | ≈80 ms | **3.0–3.6 s** |
    | Brief→Decisions | ≈60 ms | ≈80 ms | **1.7 s** |
    | Brief→Knowledge | ≈55 ms | ≈70 ms | **1.4–1.5 s** |
    | Home→Roadmap | ≈60 ms | ≈80 ms | **1.5–2.1 s** |
    | Home→Analysis | ≈65 ms | ≈80 ms | **1.9–2.1 s** |
    | Home→Weekly | ≈60 ms | ≈75 ms | **1.8–1.9 s** |

  - The skeleton (`p-loading-brief-to-decisions.png`) has **no page gutter**. It starts flush against the rail at x=248. "Loading current records…" is plain text at the left edge, and the placeholder bars span the full width with no relation to the destination layout.
  - The initiative header is preserved (good), and the tab underline moves immediately (good).
- **Why it feels junior:** feedback is fast, but the skeleton looks like a rendering error, and 1.5–3.6 s for a 14-row list is 5–10× slower than Linear. Much of this is structural: functions run in iad1 while the database is in London. That is not a UX fix, but the UX must hide it.
- **Fix:**
  - Per-route skeletons that match the destination grid, inside the same gutter and white sheet: a table skeleton with 8 × 44px rows, a brief skeleton with two columns.
  - Remove the visible "Loading current records…" text and keep it for screen readers only.
  - Move function region to London (lhr1/`eu-west-2`), as infrastructure advice to the owner.
  - Prefetch the initiative tabs on hover.
  - Cache the register rows client-side so returning to Initiatives is instant (stale-while-revalidate).

### 11. Major: the workspace header is unbalanced, and actions float mid-page
- **Screen:** initiative header (`p_initiatives_merchant-flex-finance-1440.png`).
- **Evidence:**
  - **Add evidence** and **Manage initiative** sit at x=870–1140, which is neither right-aligned nor next to the title. Notifications and Search sit in a separate cluster at the far right, 20px higher.
  - The initiative page has no white top bar, while list pages do ("Initiatives", "Roadmap" at 26px in a white 56px bar). The global chrome therefore changes shape between pages.
  - The meta row mixes a stage label with no pill, an "MF" boxed code, "Owner · Demo Reviewer" in bold, an amber pill with a literal "!" glyph, and grey "Synthetic demo".
- **Fix:**
  - One persistent **56px top bar** on every page. Left: breadcrumb ("Initiatives / Merchant Flex Finance"). Right: Search field (240px, showing ⌘K), Notifications bell with a numeric badge, Help "?" icon.
  - Below it, the initiative header: title at 28px/700, the meta row as uniform 24px chips (Stage chip, Business line chip, Owner avatar+name, Attention status pill), and actions right-aligned on the title baseline (**Add evidence** as a split button, then a `⋯` overflow containing Manage, Setup and Archive).
  - Tabs sit flush under it and become sticky on scroll at a combined height of 104px.

### 12. Major: the Notifications button has no unread badge, and notifications are not actionable
- **Evidence:**
  - The header button "Notifications" is text only. The Notifications page says "Everything in Prodwise Demo · 22 new", but the header shows no count (`p_notifications-1440.png`).
  - Items are not links (no arrow, no hover) and there is no per-item "mark read".
  - The page has a four-line explanatory paragraph.
  - Mobile has a badge (`mobileBar a[data-notifications] b`) but desktop does not, which is inconsistent.
- **Fix:**
  - A bell icon button (32px) with a cyan-500 count badge (16px, 11px/700 navy text), showing "9+" above 9.
  - Clicking it opens a 400px **inbox popover**: For me / All tabs, grouped by day, each row clickable, with "Mark all read" and "Open inbox" in the footer.
  - The full page stays for history.

### 13. Major: the org / workspace context card is a static block, and the switcher is a modal radio form
- **Evidence:**
  - Demo: the org card is not interactive (`org tag not interactive`), yet it looks like a card-button (dark navy box, rounded).
  - Viewer with one org: the card **shows a ⌄ chevron** and opens a modal that says "This is your only authorized active organization", with a disabled Switch button.
  - Platform Owner: the modal lists orgs as radio buttons, and switching requires selecting and then pressing **Switch organization** (`l-mohamed-orgswitch.png`).
  - The dialog stays open on backdrop click.
  - The card mixes the org name, role and a demo scenario date.
- **Why it feels junior:** Linear, Notion and Slack switch workspace in one click from a dropdown. A chevron on a non-choice is a false affordance.
- **Fix:** §E3.

### 14. Major: copy volume. Every screen explains itself two or three times
- **Evidence:**
  - Home banner: "Shared synthetic demo. Its records are dated up to the scenario date, 26 Sept 2026; changes made here carry today's real date and stay visible to other visitors until the Demo is reset (last reset 29 Sept 2026)." This repeats on History.
  - Notifications: a four-line lede.
  - Create initiative: a right-hand panel with three paragraphs.
  - Knowledge: two stacked amber banners before the table.
  - Weekly Review: three lines of process text before a button.
  - Meeting notes: a "What happens next" 01/02/03 panel.
  - The Decisions queue has a description under every state (Open, Deferred…).
- **Why it feels junior:** honesty is a product value, but repeating it on every screen reads as insecurity. Enterprise tools state it once (Help or empty state) and trust the user.
- **Fix:**
  - Cap the descriptive lede at one line of 80 characters or fewer.
  - Move explanations into (a) Help "About this page", (b) `ⓘ` tooltips on the specific term, or (c) empty states.
  - Keep Rule 4 copy exactly where a fact is absent, and nowhere else.

### 15. Major: test data and dates leak into the demo
- **Evidence:**
  - "Smoke check — synthetic (production verification)" appears in Home → "What changed since W38 Final" as "1 initiative added" (`p-home-1440.png`) and in the Analysis/Initiatives list (it is archived but still listed there, while the register hides archived).
  - The banner states "scenario date 26 Sept 2026" and "last reset 29 Sept 2026", and the History header adds "Times in Cairo time". That is three different temporal frames on one screen.
  - The Demo Reviewer is labelled **Org Owner** in the org card but is named "Reviewer".
- **Fix:**
  - Purge verification artefacts from the demo dataset, or filter archived initiatives out of Analysis and What-changed by default.
  - Show one demo pill in the top bar: `Demo · scenario 26 Sep` with a popover for the rest.
  - Rename the demo actor "Demo PM".

Honourable mentions (Minor):
- The command palette has a fixed 540px height with about 250px of empty navy below 6 results, and a lone "Close" button stranded mid-footer (`p-palette-typed.png`). It searches initiatives only: no commands, pages or recent items.
- The Import page has **zero gutter**: content is flush against the rail at x=248 (`l-owner_initiatives_merchant-flex-finance_sources_import.png`).
- The Decisions right panel overflows the content edge (1404 vs 1400).
- The Proposal review source panel is not sticky, so the quotes lose their context as you scroll. Its counts also contradict each other: "3 proposals are still waiting", "1 pending" and "Needs your decision 1".
- The Viewer sees a "Record a decision" navy panel containing only "This view is read-only".
- **Sources has two "Add evidence" buttons** (header and page).

---

## B. Per-area findings

### Login / Signup / Explore Demo (`p-login-1440.png`, `p-signup-1440.png`, `m-login-390.png`)
- It is a boxed split card floating on grey. The left navy half is about 70% empty, with a 3-item bullet list pinned at the bottom. That treatment is a 2016 SaaS template.
- **Explore Demo** is a full-width outline button of equal visual weight to Sign in. For a demo URL shared with prospects, the demo should be the *first* option when arriving from a demo link (`?demo=1`).
- The "Show" password toggle is a grey block attached to the input, not an inline eye icon.
- **Fix:** full-bleed layout. Put a 440px form column on white on the left and a navy panel on the right with the Initiative Arc motif and one sentence. The primary button is 40px and cyan-600. Explore Demo is a secondary 40px button plus a caption, and becomes primary when `?demo` is present. Add an inline eye icon in the input. Signup's three-step numbered indicator is fine, but use a horizontal stepper with lines.

### Nav rail and collapse control (`p-collapsed.png`, `p-collapsed-hover.png`)
- The rail is 248px expanded and 76px collapsed. That is too wide in both states (Linear uses 220/56, Jira 240/64).
- The collapse control sits at the very bottom, labelled "Collapse" with a pin icon.
- Hovering the collapsed rail only shows the native `title` tooltip after about a second.
- The org card disappears entirely when collapsed, so there is no org context.
- The active item uses both a background fill and an inset left bar, which is two indicators for one state.
- Between 781 and 1100px the rail is forced collapsed regardless of the saved preference.
- The initiative context item (a 13px label with a duplicate icon) appears under a divider. It is a good idea executed weakly.
- **Fix:** §E1.

### Account / user menu
Covered in Problem 2 and specified in §E2. The Account page itself is a two-column read-only form; "Connected sources" lives on the Account page as a card, while Import lives under an initiative. It should be one path, "Settings → Connected accounts", reachable from the account menu.

### Organization / workspace context card and switcher
Covered in Problem 13 and specified in §E3.

### Popovers and dropdowns (global)
Covered in Problem 1. The measured behaviour:

| Component | Outside click | Escape | Navigation |
|---|---|---|---|
| Account menu | no | no | closes on full reload only |
| Add evidence | no | no | n/a |
| Org dialog | stays open on backdrop click | closes (native dialog) | n/a |
| Help | closes (modal dialog) | closes | n/a |
| Command palette | closes | closes | n/a |

That is five components with three behaviours. §E4 unifies them.

### Home (`p-home-1440.png`)
- The five-second test partly passes: "What needs attention" plus a KPI strip plus grouped reasons.
- The strip ("14 Initiatives · 8 Need attention · 7 Targets in 28 days · 4 No Target Live · 7 Setup incomplete") duplicates Analysis/Portfolio exactly.
- Needs-attention cards use amber left bars for *every* reason, including "Decision needed". Every item looks equally urgent, and the amber is used for categorisation rather than status.
- Each reason has a separate "Review decision →" / "Inspect record →" link instead of making the whole row clickable.
- "Next step" sits below the cards at the same weight as body text.
- The right column (Weekly review card, Coming up) is good but visually disconnected: a white card with a navy top rule next to open grey space.
- "What changed since W38 Final" has 28px headings at the same level as the page H1's children.
- **Fix:**
  - The page is one white sheet in two columns (8/4).
  - The attention list becomes a dense list grouped by initiative. Each group header is 36px: initiative name, stage chip, owner avatar, and a count of reasons.
  - Each reason row is 40px: severity glyph, reason type label, one-line text, and a whole-row link.
  - "Next step" becomes a pinned line in the group header with the cyan `→` treatment.
  - Remove the KPI strip or make it 3 clickable filters above the list: Need attention · Targets ≤28d · Setup incomplete.

### Initiatives register (`p_initiatives-1440.png`, `m-initiatives-390.png`)
- 14 rows need about 1,700px.
- The Setup column ("6/10") uses the same weight as data and is a link to setup, which surprises users.
- The Attention column shows concatenated amber text ("Recorded blocker · Past target · update needed").
- The "Latest change" column truncates without a tooltip.
- The mobile card view is acceptable.
- **Fix:**
  - A 44px-row DataTable with a sticky header.
  - Columns: Name (with business-line chip), Stage chip, Owner (avatar + name), Attention (count pill plus top reason on hover), Target Live (date, with a small `+14d` delta chip), Setup (a 40px mini progress meter with the label "6/10" and a tooltip; §12 permits factual counts), Updated (relative time).
  - Chip filters as in Problem 7. Column sort on header click. Clicking a row opens the initiative; ⌘-click opens a new tab.
  - Create initiative becomes a 36px cyan primary button in the page toolbar.

### Create initiative and setup flow (`p_initiatives_new-1440.png`, `p_initiatives_merchant-flex-finance_setup_step_review-1440.png`)
- It is a four-step wizard with underlined step tabs that look like page tabs.
- The lifecycle stage uses 8 radio cards in a 2×4 grid. Each card is 44px tall and grey on grey.
- The right-hand explainer panel repeats "Existing checks apply immediately" twice.
- The Setup review H1 x-offset (294) differs from the others (288).
- "Review setup" appears as an extra page under the initiative, with its own H1 and its own step tabs *under* the initiative tabs, which makes three rows of tabs.
- **Fix:**
  - Create becomes a **modal sheet** (640px wide, right-side drawer or centred) with 4 fields: Name, Business line (combobox), Owner (people picker defaulting to you), Stage (segmented select or combobox, not 8 radios). One primary "Create" button.
  - After creation, land on the Brief with a **Setup checklist panel** (collapsible, in the right column) showing 10 items with ticks. That follows the Linear project-setup and JPD onboarding pattern.
  - Remove the separate setup route from primary navigation.

### Brief (`p_initiatives_merchant-flex-finance-1440.png`)
- The content is the right content (current state sentence, next step, relationships, delivery facts).
- The current-state paragraph is set at 18px. That is readable but has no structure.
- The Next step block is a grey box with a navy left bar, visually *weaker* than the white Delivery facts card beside it, which inverts the priority.
- Relationships are labels in uppercase micro type ("DEPENDS ON") with prose.
- **Fix:**
  - Left column (white sheet): a "Current state" summary line, then a **Next step** callout (white, 1px cyan-600 left border of 3px, 16px/600 text, owner avatar and "Confirmed 10 Sep" meta), then the attention list, then Relationships as a compact table (type chip · initiative · date impact status pill).
  - Right column: Delivery facts as a key/value list in a sunken panel. The update button becomes a 32px secondary button, not a full-width slab.

### Decisions (`p_initiatives_merchant-flex-finance_decisions-1440-full.png`, `l-reviewer-decisions.png`)
- The 27 vs 30 comparison is strong and is the best screen in the product.
- It is let down by a three-column layout: a 184px queue rail with a paragraph under each count, the centre card, and a right "Record a decision" navy-headed card.
- The queue rail also holds "Recorded decisions" as long link paragraphs and a "Go to" link list.
- The right card has five buttons in four different styles.
- The Viewer still gets the navy panel.
- **Fix:**
  - The queue becomes a **segmented control** (Open 1 · Deferred 0 · Dismissed 0 · Resolved 0 · History 1) in the tab toolbar.
  - The list-detail layout is a 360px list on the left (one row per difference) with the detail on the right.
  - Actions go in a sticky footer bar inside the detail: primary "Decide…", secondary "Assign confirmer", then an overflow for Note / Defer / Dismiss.
  - "Recorded decisions" moves to Knowledge (filter Type = Decision), where it already lives.
  - Viewer: hide the action bar and show a one-line "Read-only" chip.

### Knowledge (`p_initiatives_merchant-flex-finance_knowledge-1440.png`)
- There are two stacked amber banners (the conflict banner and "3 entries waiting for confirmation"), then a navy 3px rule, then a table with 95px rows.
- "Confirmed (11 entries)" is a boxed tab while the others are plain text, which is inconsistent with the History filter chips and the Notifications chips.
- The Inspect column contains "▸ Details" disclosure triangles.
- **Fix:**
  - One line of inline status chips in the tab toolbar: "1 value differs →" (attention pill) and "3 awaiting confirmation →" (unknown pill).
  - A 44px-row table: Subject · Attribute, Value (600 weight), Phase chip, Status pill, Sources count, Updated.
  - Clicking a row opens a **right detail panel** (480px) with provenance, history and actions. That is the Linear/Jira issue peek pattern. Retire the Details disclosures.

### Sources (`p_initiatives_merchant-flex-finance_sources-1440.png`)
- 93px rows with "▸ Details".
- References are in 11px monospace grey, which is too small; they should be the scannable key.
- The group header "Current Scope 9" is a grey band.
- There is a duplicate Add evidence button.
- **Fix:**
  - A 40px-row table with the type icon (Jira / Doc / Decision / Meeting) and Key (12px mono, ink-700, as a chip), plus Title, Boundary chip, Source date and Linked entries.
  - Grouping becomes a "Group by: Boundary" control.
  - Row click opens the detail panel. Remove the page-level Add evidence.

### Commitments (`p_initiatives_merchant-flex-finance_actions-1440.png`)
- Link-underlined titles, a status pill at the far right, and a separate "Details" button per row.
- The 32px H1 and the big "Add commitment" button make this a sparse page.
- **Fix:** a list with 44px rows, grouped by Overdue / This week / Later. Columns: checkbox-less status icon, title, owner avatar, due date (red text + "Overdue" pill when late), source chip. Inline "+ Add commitment" row at the bottom of each group (Linear style).

### Risks & questions (`p_initiatives_merchant-flex-finance_context-1440.png`)
- A two-column Risks / Questions split with separate ledes.
- "Add question" is a dashed button next to an input, with the hint "Type the question to add it."
- The risk status pill "Mitigating" uses the amber at-risk palette, so status and category are conflated.
- **Fix:** two stacked tables with a shared 40px row style. Keep "Mitigating", "Open" and "Awaiting confirmation" as neutral workflow chips; use amber only for true at-risk state. Question entry becomes an inline add-row.

### History (`p_initiatives_merchant-flex-finance_history-1440.png`)
- The filter chips (All 28, Delivery 7…) are the best-looking control in the product; reuse that pattern for the other filters.
- The timeline nodes are 32px circles with glyphs that are hard to read.
- Event titles are in 12px uppercase tracking ("KNOWLEDGE CONFIRMED"), which is shouty.
- **Fix:** event rows are a 20px icon, then the sentence ("Demo Reviewer confirmed **Pilot scope · Merchant cap**"), then relative time on the right, grouped by day with sticky day headers. That is the GitHub/Linear activity-feed pattern.

### Manage initiative (`/manage`)
- A long single page of sections (Basics, Ownership, Scope, Delivery, Relationships, Sources, Lifecycle), each with its own explanation paragraph and buttons.
- It duplicates setup.
- **Fix:** a Settings-style page with a left sub-nav (200px) and a right form. Each section saves inline, with a "Saved" toast. Put Archive in a "Danger zone" at the bottom with a destructive button.

### Add evidence menu (`p-addevidence-open.png`)
- A good two-line menu item design.
- The menu does not close (Problem 1).
- In the demo the import option is hidden, so a prospect never sees connectors.
- The last item, "Saved notes and pasted text", is navigation, not an add action.
- **Fix:**
  - A split button: the main part opens "Meeting notes"; the caret opens the menu.
  - Menu sections: **Paste**: Meeting notes, Text. **Import**: Jira, Drive, with a connector icon and a "Connect" badge if not connected. **Reference**: Link or ID.
  - Remove the "Saved…" item; the Sources tab covers it.
  - In the demo, show import items with a "Demo: sample import" variant.

### Meeting Intelligence proposal review (`p-proposal-review-full.png`)
- A two-column layout with the pasted notes on the left and proposals on the right, which is the correct pattern.
- The notes panel is **not sticky**, so it scrolls away.
- "Show in source" presumably scrolls or highlights, but the source is off-screen.
- The contradictory counts (3 waiting / 1 pending / Needs your decision 1) remain.
- Category icons are coloured circles; the Date changes icon is brown, borrowing an amber-brown tone as decoration.
- "Mark as already recorded" is a navy primary sitting inside an amber callout.
- **Fix:**
  - A sticky left source pane (`position: sticky; top: header+16`, `max-height: calc(100vh - …)`, own scroll) with **highlighted spans** for each proposal quote (cyan-100 background). Hovering a proposal highlights its span.
  - The right pane is a queue: one proposal card at a time or a compact list with keyboard shortcuts (A accept, R reject, J/K next/previous). That is the Superhuman/Linear triage pattern.
  - One summary line: "5 proposals · 2 accepted · 2 rejected · 1 needs you".

### Roadmap
Covered in Problem 4 and specified in §E5.

### Analysis, portfolio (`p_analysis_portfolio-1440-full.png`)
- A duplicate of Home's counts plus a lifecycle bar list plus two tables with misaligned baselines.
- It contains no business metric at all.
- "Portfolio / Initiatives" are sub-tabs inside a page under an eyebrow "ANALYSIS · PRODWISE DEMO".

### Analysis, project (`/analysis/projects/merchant-flex-finance`)
- Every initiative shows "Measurement not configured" and a six-row "Not configured" checklist, while the Initiatives list says "configured for 0 of 16 initiatives".
- The whole Analysis section is therefore an empty shell in the demo, and a prospect clicking **Analysis** sees nothing measured.
- **Fix:** §E6. Also seed at least two demo initiatives with configured synthetic metric definitions (clearly labelled synthetic), so the demo shows the capability.

### Weekly Review (`p_weekly-review-1440.png`)
- The control row is a native week input, an "Open week" button and a disabled "Draft" button, followed by a process line ("Prepare · Draft wording · Review sections 2/14 · …") that looks like breadcrumbs but is actually a stepper.
- "Update to latest records" is primary, and the dashed "Draft wording" appears disabled with no reason given.
- The section list and section detail come far down the page (y=730).
- **Fix:**
  - Header: Week picker (a `‹ W39 ›` stepper with a popover calendar), a status pill (Draft/Final), a progress meter "2 of 14 sections reviewed", then primary "Continue review" and secondary "Refresh inputs".
  - Below it, a two-pane layout: section list on the left (owner-grouped, with a check per reviewed section) and the section on the right.
  - The amber "records changed after snapshot" banner becomes an inline pill on the affected sections, not a page banner (it currently says "0 sections affected" while still being amber, which is a false alarm).

### Notifications
Covered in Problem 12.

### Help (`p-help-open.png`)
- A centred modal with "About this page", "How Prodwise works", three keyboard shortcuts and "Restart Home orientation".
- There is no search, no docs links, no glossary for "Knowledge / Source / Evidence / Commitment", no "What's new" and no contact.
- **Fix:** §E9.

### Administration / Users (`l-owner_administration.png`)
- Triple navigation: the rail, then an admin sub-nav (Organization / Users & Access / Access Policy), then tabs (Members / Invitations). The title "Users & Access" appears four times (sub-nav, H1, section title, and the eyebrow via "Organization").
- A "Current organization" label is floating top right with no value.
- The table header wraps and role pills wrap.
- "Open Local Owner →" is a text link column instead of a row click.
- The Next.js dev "N" badge overlaps the rail's Collapse button locally (dev only, but it shows the collapse control is in a collision zone).
- **Fix:**
  - Admin gets its own left sub-nav *replacing* the rail content (Linear-style settings mode, with "← Back to app"), so there is no double nav.
  - Users table rows are 44px: avatar, name + email, role dropdown inline (for authorised roles), status chip, joined, and a `⋯` row menu.
  - "Invite people" opens a modal with a multi-email field.

### Connected sources and source import (`l-owner_account_connections.png`, `l-owner_initiatives_merchant-flex-finance_sources_import.png`)
- Connections is a long key/value list per connector, each repeating "Not available yet — X hasn't been set up… Ask your administrator".
- No logos, no connect button state, no last-sync timestamp.
- The Import page has **no gutter** (a layout bug), tabs for Jira / Gmail / Google Drive / Figma, and a grey notice.
- The result list (per `ImportForm.tsx`) is a checkbox list of name + "kind · detail · Updated" text. There are no key, status, assignee or due columns, no filters, and a hard cap of 10.
- **Scope flag (product law):** CLAUDE.md §6 lists **Gmail and Figma as strictly out of scope**, yet Account, Add evidence and Import all advertise "Jira, Gmail, Drive or Figma". Either the constitution is stale or the UI is out of scope. The owner must decide; I am flagging it, not ruling on it.
- **Fix:** a connector grid (§E8 progress states) and a Jira import table (§E7).

### Buttons, logo / wordmark
- The logo mark is a small cyan node glyph with a 20px "Prodwise" wordmark. That is acceptable, but the mark is visually weak at 16–24px and competes with nothing. The CLAUDE.md "Initiative Arc" signature is **not present** in the rail or header, so the only brand signature the constitution defines is missing.
- **Fix:** a 24px Arc mark (8 segments, current stage cyan) plus the wordmark at 16px/700 with -0.01em tracking. Buttons per §D5.

### Colour / contrast
- The canvas `#dde5eb`, the header `#d5dfe6`-ish and the sunken `#d3dde5` are too close to each other (ΔL of about 2–3), so everything looks the same pale blue.
- Link teal (`--accent-700 #00667a`) is used for titles, links, secondary actions *and* table names, so there is no hierarchy between navigation and action.
- The brand orange is used correctly (numerals only).
- Amber is **overused**. It appears on Home reason labels, Knowledge banners, the Weekly "0 sections affected" banner, "Already recorded" callouts in proposals and the "Mitigating" chip, so real at-risk states lose signal.
- Palette in §D.

### Density
The rows are 2–3× Jira's density. Controls are 44px, H1s are 32px on sub-pages, and section gaps are 32–40px. A PM with 30 initiatives would scroll constantly. Targets are in §D.

### Empty states
- The copy follows Rule 4 well ("No overdue, due-soon or blocked commitments assigned to you.").
- Visually they are plain paragraphs with no icon, no primary next action and no link to Help.
- **Fix:** a 3-line pattern: title (14/600), one sentence (13/400 ink-500), and one secondary action button. For Analysis: "Measurement not configured · Define a metric →".

### Mobile (`m-*-390.png`)
- No horizontal scroll on any page, which is good.
- The mobile top bar reads "Prodwise · Demo / Prodwise Demo", so the name is repeated.
- The Brief header consumes 250px before tabs, and the tabs overflow with a cut-off "Commi".
- Roadmap filters are crushed to about 70px each, so the date reads "09".
- Initiatives uses a card-per-row layout with 7 key/value lines. It is OK, but at about 230px per initiative it is long.
- **Fix:**
  - Tabs become a horizontally scrollable strip with fade edges and scroll-into-view on the active tab, or a "Brief ▾" select on phones.
  - Filters go into a bottom sheet.
  - The mobile initiative row is 72px: name, stage chip, attention pill and target date.

---

## C. Competitive interaction research

These are recalled patterns (no live verification was possible). I extracted interaction principles only; visuals are not to be copied.

| Area | Observed pattern (product) | Prodwise adaptation | Why |
|---|---|---|---|
| Persistent shell | Linear: the sidebar and top bar never re-render; only the main pane swaps, and route changes feel instant thanks to a local cache. Jira: a persistent top nav plus sidebar. | One 56px top bar and the rail on every route, including the initiative. Only `main` swaps. Per-route skeletons inside the same sheet. | Stable chrome reads as "fast" even at 1.5 s of data latency. |
| Fast navigation | Linear: optimistic, cached lists, prefetch on hover, keyboard `G then I`. Notion: instant page shell. | Prefetch tabs and rows on hover, SWR-cache the register and Home, add `G H / G I / G R` shortcuts. | Masks the iad1↔London latency. |
| Workspace switcher | Linear, Slack and Notion: the top-left workspace name opens a dropdown listing workspaces; one click switches; "Create/join" sits at the bottom. | The §E3 dropdown with one click. No radios or confirm step, except a confirm-on-unsaved-changes. | Switching is frequent for platform owners and consultants. |
| Account menu | Linear and GitHub: an avatar menu with name/email header, Settings, Theme, Help, Sign out at the bottom with a separator. | §E2. | Standard muscle memory. Sign out must be findable and never clipped. |
| Sidebar collapse | Linear: `[` toggles, a collapse icon sits in the sidebar header, and hovering the collapsed edge peeks the full sidebar as an overlay. Jira: a `«` button on the sidebar edge with hover-expand. | §E1: a header toggle, the `[` shortcut, and a hover-peek overlay at 56px collapsed. | Keeps the canvas wide without losing labels. |
| Roadmap timeline | Jira Plans/Timeline, JPD Timeline, Aha! Roadmaps, Productboard Roadmap: time is the x-axis canvas, rows are fixed height, there is a sticky name column, a zoom (weeks/months/quarters), a today line, swimlanes by group, dependency arrows, and an "unscheduled" tray. | §E5, derived only from confirmed delivery facts. No drag-to-reschedule (facts must be confirmed via a form). Movement ghosts show target changes. | The industry-standard mental model for "where is everything in time". |
| Analytics / metrics | Productboard Insights and Amplitude-style cards: metric card = value + period + delta + sparkline + definition tooltip. Linear Insights: a chart plus a slice/segment control. | §E6 metric cards drawn only from configured definitions, with an explicit "No observation" state ≠ 0. | Business stakeholders expect GTV/TPV-style tiles; honesty rules must survive. |
| Project setup | Linear project creation: a modal with name, lead, dates, and "Create" in under 10 s. Details are added later in the project page with a setup checklist. JPD: templates. | Create modal (4 fields) plus a post-create checklist panel on the Brief. | Lowers creation friction; setup completeness stays visible. |
| Source / import | Jira issue picker, Linear's GitHub/Slack integrations, Notion's import: search, filter by project/type/status, a table with key/type/status/assignee, multi-select, import progress per item, and a results summary. | §E7 and §E8. | PMs identify Jira items by key + status, not by prose. |
| Onboarding / help | Linear: a "?" menu with docs search, shortcuts, changelog and contact. Notion: a help panel. JPD: an in-product checklist. | §E9: a help popover plus a slide-over docs panel, a glossary, shortcuts and a demo tour. | Help should be contextual and non-modal. |
| Loading transitions | Linear/Vercel: a thin top progress bar plus layout-matched skeletons; never a blank page. | Keep the bar (already fast at ≈60 ms) and fix the skeletons to match layout and gutter. | Perceived performance. |
| Filters | Linear and Jira: filter chips, a "+ Filter" popover with typeahead, saved views, instant client filtering, URL state. | Problem 7 fix. | Removes the "Apply" round trip. |
| Tables vs visual workspaces | Jira list view vs board; Linear list vs board; Productboard grid vs roadmap. Same data, switchable views, shared filters. | Initiatives: List (default) and Timeline (the Roadmap) share one filter state. | One mental model. Roadmap becomes "a view of the register". |
| Contextual actions | Linear: right-click and `⋯` on rows, a `⌘K` scoped to the selection. Jira: a `⋯` per issue. | A `⋯` row menu on the register, Knowledge and Sources, and a scoped ⌘K ("Record decision on MFF"). | Actions where the eye already is; fewer full-page forms. |
| Popover behaviour | All of them: close on outside click, Escape, item selection and route change; focus returns to the trigger; one popover open at a time. | §E4 global contract. | The current behaviour is broken. |
| Detail views | Linear/Jira peek: clicking a row opens a right side panel (about 40% width) that is deep-linkable; Escape closes it; J/K moves between rows. | Knowledge entries, Sources, Commitments and Decisions open in a peek panel. | Replaces "▸ Details" disclosures and page hops. |

---

## D. Visual-direction spec

### D1. Palette tokens (proposal; stronger, darker, less washed out)

```css
:root{
  /* Chrome, deeper navy with a clear step between rail and popovers */
  --chrome-900:#061a2c;   /* rail background (darker than today's #002a47) */
  --chrome-850:#0b2338;   /* rail hover / popover-on-dark */
  --chrome-800:#12304a;   /* rail active item */
  --chrome-rule:#1c3a55;
  --chrome-ink:#e9eff5;   /* 15.6:1 on chrome-900 */
  --chrome-ink-dim:#a3b4c5;/* 8.1:1 */

  /* Canvas and surfaces: three distinct tiers */
  --canvas:#cfd9e2;       /* gutter only; ΔL ≈ 10 from white (today #dde5eb ≈ 6) */
  --surface:#ffffff;      /* all reading/work content sits here */
  --surface-sunken:#f1f4f7;/* table header, filter bar, key/value panels INSIDE surface */
  --surface-hover:#e8eef3;/* row hover */
  --surface-selected:#e3f4f7;/* selected row (cyan-tinted) */
  --overlay:#ffffff;      /* popovers, menus, panels */
  --scrim:rgb(6 26 44 / 55%);

  /* Rules */
  --rule:#d5dde4;         /* 1px separators inside white surface */
  --rule-strong:#b4c1cc;  /* table header bottom, section rule */
  --rule-on-canvas:#b9c6d1;

  /* Text */
  --ink-900:#0a1b2a;  /* titles, values  – 17.4:1 on white */
  --ink-700:#2e4253;  /* body            – 10.6:1 */
  --ink-500:#546676;  /* meta            – 5.9:1 on white, 4.9:1 on canvas */
  --ink-400:#6b7c8b;  /* placeholders only (4.5:1 on white) */
  --ink-link:#006678; /* links */

  /* Brand accent: identity plus the ONE primary action per view */
  --accent-600:#007d91;   /* primary button fill, focus ring, active tab underline */
  --accent-700:#00667a;   /* primary hover, link */
  --accent-500:#00aec7;   /* rail active bar, Arc current segment, badges on navy */
  --accent-100:#d9f2f6;   /* selection, highlight spans */

  /* Decoration only */
  --brand-orange:#c25a22; /* Arc accent + section numerals, never status */

  /* Status (unchanged hues, stronger marks) */
  --ready-fg:#146b3f; --ready-bg:#e3f4ea; --ready-mark:#1f8a52;
  --atrisk-fg:#7a5200; --atrisk-bg:#fdf1d3; --atrisk-mark:#c99100; /* yellow-amber, hue ≈43°, far from orange ≈21° */
  --blocked-fg:#a3170f; --blocked-bg:#fce8e6; --blocked-mark:#d03a2f;
  --unknown-fg:#4f5d6a; --unknown-bg:#edf0f3; --unknown-mark:#7f8e9b;

  /* Neutral workflow chips (NOT status): Open, Mitigating, Draft, Awaiting */
  --chip-bg:#eef2f5; --chip-fg:#2e4253; --chip-border:#d5dde4;
}
```

Usage rules:
- Amber appears **only** with the `AT_RISK` state or an attention reason that is at-risk-class. Workflow states use neutral chips.
- Cyan-600 fill appears **once per view** (the primary action). Cyan-500 appears only on the navy chrome.
- Links use `--ink-link` without bold. Entity names in tables use `--ink-900` 600 weight, not teal. They are clickable rows, not links.

### D2. Typography scale (Inter; tabular numerals for all numbers and dates)

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| display | 28 / 34 | 700, -0.02em | Initiative name, top-level page title (once per page) |
| h1 | 20 / 28 | 600 | Section title inside a page (replaces tab H1s) |
| h2 | 16 / 24 | 600 | Group headers, panel titles |
| body | 14 / 20 | 400 | Default text, table cells |
| body-strong | 14 / 20 | 600 | Entity names, values |
| small | 13 / 18 | 400 | Secondary cells, descriptions |
| meta | 12 / 16 | 500 | Timestamps, keys, counts |
| micro | 11 / 14 | 600, +0.04em, sentence case | Column headers, chip text (drop the ALL CAPS micro-label habit except column headers) |
| value | 40 / 44 | 700 | Decision comparison values (27 vs 30) |

`font-feature-settings:"tnum","cv11"` goes on tables, dates and metrics. Remove the ≈50 hard-coded px font sizes in module CSS.

### D3. Spacing and density
- 4px base. Page gutter is 32px (desktop) and 16px (mobile). The white sheet has 24px inner padding.
- Between sections inside a sheet: 32px. Between a heading and its content: 12px.
- Row heights:
  - Dense list: 36px.
  - Default table: 44px.
  - Two-line row: 56px, maximum.
- Control heights:
  - sm: 28px (chips, inline row actions)
  - md: 32px (default desktop)
  - lg: 36px (page primary)
  - touch: 44px (≤780px only, applied through one media query in tokens, not 123 hard-codes)
- Radius:
  - Controls: 6px.
  - Chips and pills: 999px (status only).
  - Panels and popovers: 8px.
  - Sheets: 8px.
  - No radius on tables.
- Elevation: popovers use `0 8px 24px -6px rgb(6 26 44/.25), 0 0 0 1px rgb(6 26 44/.08)`. Nothing else has shadow.

### D4. Layout
- Rail: 232px expanded, 56px collapsed.
- Top bar: 56px, white, with a 1px rule.
- Main: one white sheet, `max-width:1440px`, 8px radius, on the canvas.
- Initiative header lives inside the sheet's top. It becomes sticky when the tabs reach the top bar.

### D5. Button system

| Variant | Fill / border / text | Height (sm/md/lg) | Padding | Type | Icon |
|---|---|---|---|---|---|
| **Primary** | accent-600 fill, no border, white text. Hover accent-700; active darker by 6% | 28 / 32 / 36 | 12 / 14 / 16 px | 13–14px / 600 | Optional leading 16px icon, 6px gap |
| **Secondary** | white fill, 1px `--rule-strong`, ink-900 text. Hover surface-hover | same | same | 13–14 / 500 | same |
| **Ghost** | transparent, ink-700. Hover surface-hover | same | 8–10 px | 13–14 / 500 | Icon-only variant is square (28/32/36) with a tooltip |
| **Destructive** | white fill, 1px blocked-mark, blocked-fg text. Confirm step uses a blocked-mark fill with white text | same | same | 600 | Optional |
| **On-chrome** | chrome-850 fill, chrome-ink. Used in the rail | 32 | 12 | 13 / 500 | 20px icon |

- **Pending state:** the label stays and a 14px spinner replaces the leading icon (or is prepended). Width is locked (`min-width` equal to the measured width) so there is no reflow. `aria-busy="true"`, disabled pointer events, and text becomes "Saving…" only when the action is not obvious.
- **Disabled:** 45% opacity, `cursor:not-allowed`, and always a tooltip explaining why ("Viewer · read-only"). **Never dashed borders.**
- **Split button:** primary plus a 28px caret segment separated by a 1px rgba(255,255,255,.3) divider.
- **One primary per view.** Navy fills are retired for buttons, because navy is chrome.
- Focus ring: `0 0 0 2px #fff, 0 0 0 4px var(--accent-600)`.

---

## E. Specific specs

### E1. Sidebar collapse control
- **Location:** the rail header, right of the wordmark, as a 28px ghost icon button (`panel-left-close` / `panel-left-open` glyph). Tooltip: "Collapse sidebar  [". Remove the bottom "Collapse" row.
- **Shortcut:** `[` toggles, ignored while typing in inputs.
- **Widths:** 232px expanded and 56px collapsed, with a 160ms width transition. Content reflows via `--rail-w`; there is no overlay in the pinned state.
- **Collapsed state:**
  - Icons are 20px in 40×40 hit areas, centred.
  - The org becomes a 32px square org avatar (initials, colour from a hashed neutral palette, never status colours) that opens the switcher.
  - The account becomes a 28px avatar circle at the bottom.
  - Tooltips are custom, show after 300ms, sit 8px to the right, and include the shortcut ("Roadmap  G R").
- **Hover-peek:** hovering the collapsed rail edge for 400ms slides in the full 232px rail as an overlay (shadow, z above content) without reflowing content. It closes on mouse-leave after 300ms or on Escape.
- **Persistence:** localStorage, respected at all widths ≥1024px. Between 781 and 1023px, start collapsed but honour a user expand as an overlay.
- **Active item:** one indicator only, a chrome-800 background plus a 2px cyan-500 left bar inside the item radius.

### E2. Account menu
- **Trigger:** the rail bottom row, 40px tall: 28px avatar (initials on accent-600), then name (13/600) over role · org (12/400 dim), then a `⋯` / chevron-up. When collapsed, it shows just the avatar.
- **Popover:** top layer, 280px wide, anchored `bottom-start` to the trigger with an 8px offset, flipping to `top` if space is short, `max-height: calc(100vh - 16px)` with scroll. **It must never be inside an overflow-hidden container.**
- **Contents, in order:**
  1. Header: name (14/600), email (12/400 ink-500), role chip.
  2. Divider.
  3. My account, Connected accounts, Notifications settings.
  4. Divider.
  5. Keyboard shortcuts `?`, Help & docs, What's new.
  6. Divider.
  7. **Sign out** (ghost, blocked-fg on hover only, with a leading log-out icon).
  8. The demo variant adds "Leave demo" as the Sign out label with the caption "Your changes stay in the shared demo".
- **Behaviour:** §E4. Items are 32px, with arrow-key navigation, Enter to activate and type-ahead.

### E3. Org / workspace switcher
- **Trigger:** the rail header area below the wordmark, 44px tall: 24px org avatar + org name (14/600) + role (12/400 dim). A chevron is shown **only** if the user has 2 or more contexts. With one context it is a static label with no hover state.
- **Popover:** 300px wide.
  1. Search field if there are 6 or more orgs.
  2. List rows at 40px: org avatar, name, role, then a "Demo" chip if synthetic. The current org has a checkmark.
  3. Divider, then "Organization settings" (admins only) and "Create or join organization" (if allowed).
- **Switch:** **one click**. Show an optimistic spinner on the row, then navigate to Home of the new org. If the current page has a dirty form, show a confirm dialog ("Discard unsaved changes and switch to Prodwise Demo?"); otherwise no confirm.
- **Demo:** show a `Demo` chip in the trigger. The scenario date moves to the top-bar demo pill, not the org card.
- **Platform Owner:** a divider section "Platform access" listing non-member orgs with a "Platform" chip.

### E4. Global popover behaviour (contract for every menu, popover and dropdown)
1. One floating layer is open at a time. Opening another closes the first.
2. It closes on: outside pointerdown, Escape, item activation, route change (`usePathname` effect), window blur for menus (not for editable popovers), and trigger re-click.
3. Focus: on open, focus the first item (menus) or the first field (popovers). On close, **return focus to the trigger**, unless closing was caused by navigation.
4. ARIA: the trigger has `aria-haspopup="menu|dialog|listbox"`, `aria-expanded` and `aria-controls`. Menus use `role=menu` / `menuitem` with arrow keys, Home/End and type-ahead.
5. Placement: anchored in the top layer (`popover` attribute or a portal), flipping and shifting to stay 8px inside the viewport, with `max-height` and internal scroll. It is never clipped by ancestors.
6. Motion: 120ms fade plus 4px translate from the anchor side. `prefers-reduced-motion` disables it.
7. Modal dialogs (confirm, create) close on Escape and on backdrop click **unless the form is dirty**. In that case show "Discard changes?".
8. Mobile (≤780px): menus become bottom sheets with a scrim, drag-to-dismiss, and a 44px row height.

### E5. Roadmap visual timeline
**Data source:** only confirmed delivery facts (Development start, Target Live planned, Actual Live, milestones, dependencies, Target revisions). Nothing is estimated. A bar is drawn only between two recorded dates.

**Layout**
- Toolbar (40px):
  - View: `List | Timeline` (shared with Initiatives).
  - Zoom: `Weeks | Months | Quarters`.
  - "Today" button (scrolls to today).
  - Group by: `Business line | Owner | Stage`.
  - Filter chips.
  - Legend `ⓘ` popover (not a permanent legend row).
- Left sticky column (280px): group header rows (32px, business-line **full name** plus a code chip and count), then initiative rows (40px) with name (13/600), stage chip and owner avatar. Clicking opens the peek panel.
- Time canvas (the remaining width, horizontally scrollable, default window today −8 weeks to +16 weeks):
  - Sticky axis header (48px): months (12/600) over week numbers (11/400).
  - Alternating month column shading (`--surface-sunken` on odd months).
  - Vertical rules at 1px `--rule`.
- **Today line:** a 2px accent-600 vertical line with a "Today · 29 Sep" flag at the top.
- **Review cutoff line:** a 1px dashed ink-500 line with a "Cutoff 26 Sep" flag. It is visually distinct from today and shown only when set.

**Bars (per row, 16px tall, 4px radius, vertically centred)**
- Development start → Target Live (planned): an ink-700 at 20% fill bar with a 1px ink-500 border.
- Actual Live recorded: a solid ready-mark diamond (10px) at the date. Full launch = filled; partial = half-filled.
- Target Live marker: a 10px open circle at the planned date. If past with no Actual Live, the marker becomes an at-risk ring plus a "Past target" pill in the row's right edge (the *only* use of amber on the canvas).
- **Target movement:** a ghost (dashed outline, 40% opacity) marker at each previous Target Live, with a thin arrow to the current one and a label "+14d" (11/600). The tooltip lists revisions with who and when.
- Milestones: 8px squares on the bar, labelled on hover. The next milestone gets a label beside it if space allows.
- Only start recorded: a bar fades out (gradient to transparent) over 2 weeks after the start. The tooltip says "Target Live not recorded".
- Attention: a severity glyph (●/▲/■ with a text tooltip) at the row's left edge in the sticky column, never colour-only.

**Unscheduled lane**
- A collapsible group at the bottom: "No Target Live recorded (4)". Rows show name, stage and owner, plus an "Add delivery facts" ghost button (permission-gated). There is no bar.

**Dependencies**
- Toggle "Show dependencies" (off by default).
- A 1.5px curved connector from the dependency's Target Live marker to the dependant's milestone / needed-by date.
- Neutral ink-500 when the dates are compatible. Blocked-mark red with an arrowhead and a "13 d late" label when the dependency lands after it is needed. Dashed grey when "impact not assessed".
- Hovering a row highlights its connectors and dims others.

**Interaction**
- No drag-to-reschedule (facts require a confirmed form).
- Clicking a marker opens a popover with the fact, source, confirmer and "Update delivery facts".
- Keyboard: arrow keys move the row focus, Enter opens the peek, `T` jumps to today.
- **Mobile:** a vertical agenda (grouped by month, one row per dated event) instead of the canvas.

### E6. Analysis metric cards (per initiative)
**Rule:** a card exists only for a **configured metric definition** (definition, source dataset, period, formula, target/approval). There are no default or placeholder metrics. *Missing ≠ Zero.*

**Card (grid of 3–4 per row, 240–300px wide, 136px tall, white on the sheet with a 1px rule, 8px radius, no shadow)**
- Row 1: metric name (13/600), e.g. "GTV", "TPV", "Transactions", "Active merchants", "Success rate", then a `ⓘ` icon (popover shows the definition, formula, source, owner, approval).
- Row 2: the value at 28/700 tabular with its unit ("EGP 41.2M", "182,340", "1,204", "97.8%"), then the period caption (12/500 ink-500): "Last 7 days · to 28 Sep · Cairo".
- Row 3: a delta vs the configured comparison period ("▲ 6.1% vs prior 7 days"). The arrow glyph plus text are neutral ink-700; colour is applied **only** if the definition declares a direction (higher-is-better), and then it uses ready/blocked marks with glyph + text, never colour alone.
- Row 4: a 32px sparkline (1.5px ink-500 line, last point accent-600 dot) and "Target 45M · approved by Salma R." or "No approved target".
- **States:**
  - **Observed:** as above.
  - **No observation in period:** the value shows "—" with the label "No observation recorded for 22–28 Sep" (unknown pill). **Never 0.**
  - **Observed zero:** "0" with the caption "Recorded observation" (a zero that was actually recorded).
  - **Stale:** a "Last observation 14 Sep" meta line plus an unknown pill "Stale".
  - **Definition draft / unapproved:** the card has a dashed 1px border and a "Draft definition" chip, and the value is hidden.
- **Page layout:**
  - Header: initiative, period selector, comparison selector, and "Metric definitions (n)".
  - Card grid, then one chart area (a line chart of the selected card, 280px tall), then an observations table with its source.
  - Empty (none configured): one empty state, "No metrics are defined for this initiative yet. Define a metric →", with a short list of example definitions (GTV, success rate) as *templates*, not data.

### E7. Jira import results
- **Search bar:** a JQL-lite text search, plus filter chips **Project** (multi, typeahead), **Type** (Epic/Story/Task/Bug/Sub-task), **Status** (grouped To do / In progress / Done by status category), **Assignee** (includes "Unassigned" and "Me"), **Updated** (7d/30d/any), and a "Linked to epic…" picker. The result count sits at the right ("48 results · showing 25").
- **Table (40px rows, sticky header, 25 per page with "Load more"):**

| ☐ | Type | Key | Summary | Status | Assignee | Updated | Due | Already here |
|---|---|---|---|---|---|---|---|---|
| checkbox | 16px Jira type icon + tooltip ("Story") | `MFF-133` mono 12/600, links out ↗ on hover | 13/400, 1 line, ellipsis + tooltip | status-category lozenge: grey To do / blue-ish neutral In progress / green-outline Done. **Text always present; Done ≠ Ready (Rule 1)** | 20px avatar + name | relative ("3 d ago"), absolute on hover | date or "—" (never "none") | "In sources" chip + "re-import saves snapshot only if changed" |

- Epic rows are expandable (▸) to show children, with "Select epic and its 12 children".
- **Selection bar** (sticky bottom, appears on selection): "3 selected · Import as: [Delivery source ▾] · [Import 3 as evidence] · Clear". Selection persists across filter changes. Remove the silent cap of 10, or state it in the bar ("Up to 25 per import").
- **Results:** per-row inline outcome replacing the checkbox (✓ Saved, ↻ Unchanged, ✕ Failed + reason + Retry), and a summary toast "2 saved · 1 unchanged · Review snapshots →".

### E8. Connector import progress states
One state machine per connector card (Connected accounts page) and per import job:

| State | Card visual | Copy | Action |
|---|---|---|---|
| Not available (not configured by admin) | Logo 50% opacity, neutral chip "Not set up" | "Your administrator hasn't enabled Jira." | "Request access" (sends notification) |
| Available, not connected | Full logo, chip "Not connected" | What it reads (1 line) | Primary "Connect" |
| Connecting (OAuth) | Spinner on button | "Waiting for Atlassian…" | Cancel |
| Connected | Chip "Connected" (ready-mark dot + text), account email, **Last used 2 h ago** | Scopes line | "Import…" secondary · `⋯` Disconnect |
| Token expired / revoked | Blocked chip "Reconnect needed" | "Access expired 3 Sep." | Primary "Reconnect" |
| Import: queued | Row with the item key + a grey clock | "Queued" | Cancel |
| Import: fetching | Determinate bar per job ("4 of 12") + spinner per row | "Fetching MFF-133…" | Cancel remaining |
| Import: saved | ✓ per row | "Saved snapshot · 29 Sep 10:42" | "Review →" |
| Import: unchanged | ↻ neutral | "Unchanged since last snapshot" | none |
| Import: partial failure | Summary pill "2 failed" (blocked) | Reason per row ("No permission", "Not found", "Rate limited, retry in 30 s") | "Retry failed" |
| Import: done | Toast + results summary | "10 saved · 2 unchanged" | "Review proposals →" |

**Never fake a live integration:** the demo shows the flow with a visible "Sample data · Demo" chip on the connector.

### E9. Help model
- **Top-bar `?` icon button** (32px), which opens a 320px **Help popover** (not a modal) containing:
  1. A search field ("Search help…", filters articles and the glossary).
  2. "About this page", with 2–3 sentences, contextual per route. The long ledes removed from pages move here.
  3. Links: Getting started · Glossary (Evidence, Source, Knowledge, Decision, Commitment, Attention reason, Setup, Target Live vs Actual Live) · Keyboard shortcuts (`?`) · What's new · Contact support.
  4. Demo only: "Take the 90-second tour" (a 5-step coachmark tour: Home attention → MFF Decisions 27 vs 30 → Knowledge → Roadmap → Weekly Review), with Restart available.
- Clicking an article opens a **420px right slide-over docs panel** that does not block the page. Escape closes it.
- **Inline `ⓘ` term tooltips** on the product's specialised terms (hover or focus shows a 1-sentence definition plus "Learn more").
- **Keyboard shortcut sheet** (`?`) as a modal listing groups: Navigation (G H, G I, G R, G W, G A), Initiative (Alt+1…7 tabs), Lists (J/K, Enter, Esc, X select), Global (⌘K, [ sidebar, / search).
- Help never replaces empty states. Empty states link to the relevant help article.

---

## Appendix: measurement notes
- Production timings came from rAF polling in page: feedback = the `.nav-progress[data-active]` or `[data-link-pending]` element appears; URL = `location.pathname` changes; content = the destination marker text is present and no `[aria-busy]` remains. There were two runs per route. The first-feedback numbers match the known 46–88 ms baseline, and content at 1.4–3.6 s matches the known 1.5–4.4 s baseline.
- Popover behaviour came from DOM `details.open` / `dialog[open]` checks after a synthetic outside click and Escape.
- Clipping came from `getBoundingClientRect()` of the account menu at 1366×680 against `.rail{overflow:hidden}`.
- Code references:
  - `src/components/shell/NavRail.tsx` (icons, `<details>` account menu, pin collapse)
  - `src/components/shell/OrganizationControl.tsx` (modal radio switcher, chevron when `contexts` is null)
  - `src/components/evidence/AddEvidenceMenu.tsx` (the `<details>` menu, Gmail/Figma wording)
  - `src/components/connectors/ImportForm.tsx` (flat result list, 10-item cap)
  - `src/styles/tokens.css` (`--canvas:#dde5eb`)
- Not exercised: signup verification and invite acceptance (both would create accounts), and actual connector OAuth, which is not configured locally or in production. No production writes were made.
