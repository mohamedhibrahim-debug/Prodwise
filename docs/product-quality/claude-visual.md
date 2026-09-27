# Rendered acceptance report: Prodwise product-quality implementation

**Verdict: REVISE.** Most of the product-comprehension contract is met in the rendered UI. However, the Weekly surface has visible composition and navigation defects. Two explicit acceptance criteria also fail: criterion 25 (Decisions hierarchy) and the register attention treatment. These fixes are small; none needs new scope.

## Images inspected

- **Inspected:** home-1440, home-390, register-768, brief-1440, decisions-390, knowledge-1440, sources-390, roadmap-1440, portfolio-v2-1440, metric-detail-1440, platform-orgs-1440, platform-orgs-390, org-users-1440, policy-review-390, help-390, weekly-draft-1440, weekly-draft-390, weekly-confirm-390, weekly-final-1440.
- **Not in the provided set (not judged):** metric-detail-390 and account-390. The mobile metric layout and Account (identity, Platform Owner shown separately, Demo security copy) are therefore **unverified**. Both must be supplied before sign-off.
- **Ignored:** the "N" and "Rendering…" development indicators.

## What passes (observed)

**Shell and levels**
- The organization control appears at every width: rail at 1440, top bar at 390/768.
- There are exactly four portfolio links, with Administration, Help and Account in a separate utility zone.
- Initiative routes show the h1, stage, line, owner, "Synthetic demo" and four route tabs.
- Platform versus organization scope is unambiguous:
  - "PLATFORM · ALL ORGANIZATIONS" / "Global authority";
  - "ORGANIZATION · INTERFACE LAB" / "Current organization".

**Home (1440)**
- The h1, the pulse with linked figures, "W39 review · Draft" with the single primary **Continue review**, and the first attention row all sit above roughly 580 px.
- Each initiative appears once, and every reason has its own destination link.
- "Ordered by reason type… not a priority score" is shown.
- Changes are written as sentences ("Target Live moved 1 Oct 2026 → 8 Oct 2026 (+7 days)").

**Home (390) and orientation**
- The review module and its button come before Needs attention.
- The orientation notice is in-flow and dismissible, and the floating Guide is gone.
- Help is a titled dialog with Close, Concepts, shortcuts and Restart orientation.

**Initiative pages**
- **Brief:** no duplicate identity heading; the Delivery facts rail has one primary; coverage reads "Checked · 1 open difference · 2 not confirmed".
- **Knowledge:** no Sources sub-navigation.
- **Sources (390):** a grouped library is the fourth tab.

**Analysis**
- Portfolio and Projects are route links. The inline stat row has no navy band, stage bars are present, and attention counts link to their records.
- Metric detail shows all seven definition fields, "Synthetic demo measurement", the target and approval, and a neutral sentence ("0.4 days above the approved target"). There is no chart with 2 observations, and "← Projects" is present.

**Weekly lifecycle**
- The W39 Draft shows "Compared with 2026-W38 Final · finalized 20 Sept 2026, 13:00 Cairo".
- There are three blocks: Record at cutoff, "Meeting commentary — this review only… never updates initiative records", and a separate "Update the initiative record" panel.
- The finalize checklist mirrors the server checks and names the unmet item.
- The confirm dialog names the initiative, current → proposed value, basis, source, reason, re-check consequence and partial-failure honesty.
- The W38 Final receipt includes: "This Final is the baseline for the next review… not a release or business approval." It also offers Open W39, View changes since and Read full review.

## Major findings

### M1 — The Weekly page loses the shell's content gutter and composition (weekly-draft-1440, weekly-final-1440)

**Observed:**
- All Weekly content starts flush against the rail edge: "PORTFOLIO MANAGEMENT REVIEW", "Snapshot cutoff…" and the index labels have zero left padding. Every other page has a roughly 40 px gutter.
- The "Home Roadmap" links are clipped at the right edge in weekly-final.
- The "Draft"/"Final" chip floats below and between the week input and "Open week".
- "Record at cutoff", "Changes since the previous Final" and "Recorded value differences" have no vertical spacing, so they read as one run-on block.

This is the flagship lifecycle page, and it looks unfinished next to Home and Brief.

- **Fix:** wrap Weekly in the same page container, gutter and max-width as Home. Align the state chip inline with the h1 or the week control. Give the record block the same section spacing and bordered treatment as the other two blocks.
- **Acceptance:** at 1440 the left text edge matches Home's (about x=288). No element is clipped at the right. The three section blocks are visually equal peers.

### M2 — The desktop Weekly index drops a section (weekly-draft-1440)

**Observed:**
- The index shows 7 rows under "DEMO REVIEWER". The "UNASSIGNED" heading has **no row beneath it**.
- Agent Cash-In Network is missing from the index, although the checklist lists it as "Needs review".
- At 390, the same index does show Agent Cash-In Network under Unassigned.

Because the checklist items are plain text, desktop users cannot reach the 8th section from the index. Finalize requires all 8 to be reviewed.

- **Fix:** render all Unassigned rows in the desktop index. Make the checklist's pending-section names links to `?initiative=`.
- **Acceptance:** 1440 capture shows 8 index rows, including Agent Cash-In under Unassigned, and each pending name in the checklist is a link.

### M3 — Decisions action hierarchy is not implemented (decisions-390; criterion 25, §6.5)

**Observed:**
- "Assign confirmer" and "Make a decision" are identical outlined buttons, with Assign listed first.
- "Review with a note only" is a bordered button with no hint text.
- The only filled navy element is "Decision controls ↓", which is a jump link.

- **Fix:**
  - Make **Make a decision** the filled primary and put it first.
  - Keep Assign confirmer as secondary.
  - Render "Review with a note only" as a text button with the hint "Records a note; Knowledge unchanged."
  - Give the jump link a non-primary style.
- **Acceptance:** 390 and 1440 captures show exactly one filled button in the action panel, labelled Make a decision.

### M4 — The register shows absence of attention in attention colour (register-768)

**Observed:** "No attention reasons recorded" is rendered in orange attention text on five of eight rows. It looks identical in weight and colour to "Decision needed · Recorded blocker". Scanning for what needs action is defeated, and §6.2 specifies "—" plus screen-reader text.

- **Fix:** render a neutral "—" with visually hidden "No attention reasons recorded". Reserve attention colour for real reasons.
- **Acceptance:** at 768 and 1440, orange text appears only on the 3 initiatives counted on Home, which lists "3 need attention".

### M5 — ISO dates and enums leak into commentary and the consequence review (weekly-draft-1440/390, weekly-confirm-390)

**Observed:**
- The prefilled commentary reads "target live: 2026-10-01 → 2026-10-08" and "Finance calculation review — 2026-09-29".
- The status headline reads "DELIVERY · Phase 1…" in uppercase enum style.
- The confirm dialog mixes formats: "8 Oct 2026 → 2026-10-15".
- It also says "Apply 1 updates".

This text becomes Final record wording, and criterion 20 bans ISO/enum output.

- **Fix:**
  - Use the shared sentence and date renderer for Template drafts and for the dialog's proposed value.
  - Use the stage display label.
  - Pluralize the button ("Apply 1 update").
- **Acceptance:** Draft and confirm captures contain no `YYYY-MM-DD` strings or uppercase stage enums.

## Non-blocking findings

- **Roadmap axis collision (roadmap-1440):** the axis header reads "20 Oct 2026Next milestone / attention" with no gap. Every marker also clusters in the rightmost 10% of the track because the range starts at 1 Jun. Separate the labels, and consider fitting the range to recorded dates.
- **Weekly secondary actions:** "Refresh inputs" appears as a secondary action while the checklist says "Met · Inputs match". Hide it, or disable it with its reason, when inputs are current.
- **Final receipt copy:** reads "Prepared synthetic scenario baseline Synthetic scenario preparation · 20 Sept…". It is missing "by" and the separators.
- **Weekly mobile length:** weekly-draft-390 opens the "Sections (8)" disclosure by default, which pushes the section down. Collapse it when a section is selected.
- **Rail icons:** Administration reuses the Roadmap/Analysis chart icon, which weakens the separation between work and utility. Give it a distinct icon.
- **Pills that look like buttons:** "Global authority" and "Current organization" are bordered and button-like. Style them as non-interactive pills.
- **Platform role in the org control (inferred):** in platform-orgs-1440, the control shows "Interface Lab · Org Owner" for a user acting with global authority. If Jordan Lee is also a Platform Owner, consider appending "· Platform Owner" to the role line. This is display only.
- **Policy review not shown:** policy-review-390 shows the edit form, not an in-page diff or consequence review. The sensitive-action review is unverified; capture it.
- **Plural errors:** "Replaced (1 entries)" in Knowledge and "1 domains" in the Organizations table.
- **Breadcrumb:** "Initiatives /" renders with the slash offset above the text (brief-1440, knowledge-1440).
- **Mobile top bar:** the "Prodwise" label is half-clipped at the top of the 390 top bar.
- **Rail height (inferred capture artifact):** the navy rail ends at about 1000 px in full-page captures. Confirm it is sticky or full-height in the live browser.

## Acceptance path

1. Fix M1–M5.
2. Recapture weekly-draft-1440/390, weekly-final-1440, weekly-confirm-390, decisions-390/1440 and register-768/1440.
3. Supply metric-detail-390, account-390 and the policy/Replace-owners consequence review.

The Home, Brief, Analysis and Administration compositions are accepted as rendered.