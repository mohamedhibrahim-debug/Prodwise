# Rendered acceptance re-review: Prodwise corrected captures

**Verdict: PASS**, with minor follow-ups.

All five earlier major findings are fixed in the rendered evidence. No blocker or major defect is visible. Two items are only partly shown because the captures are single viewports, not full pages. They are listed under **Residual verification** for the browser redteam; neither contradicts the contract.

I disregarded the Next development badge. Nothing below is a claim about interactive behavior.

## Earlier major findings

| # | Finding | Status | Visible evidence |
|---|---|---|---|
| M1 | Weekly gutter and composition | **Fixed** | See below |
| M2 | Desktop index missing a section | **Fixed** | See below |
| M3 | Decisions action hierarchy | **Fixed** | See below |
| M4 | Absence of attention in attention colour | **Fixed** | See below |
| M5 | ISO dates and enums in wording | **Fixed** | See below |

**M1 — Weekly gutter and composition (weekly-draft-1440, weekly-final-1440)**
- In weekly-final-1440, the content left edge is at x≈288, matching Home, Brief and Register.
- The draft capture is downscaled; its left edge falls at the same proportional position.
- "Home · Roadmap" sits fully inside the right edge. Nothing is clipped.
- The state chip is now inline with the week input and "Open week".
- "Record at cutoff", "Meeting commentary — this review only" and "Update the initiative record" are three bordered cards with equal spacing and headed sub-sections ("Changes since the previous Final", "Recorded value differences").

**M2 — Desktop index (weekly-draft-1440)**
- The index shows 7 rows under DEMO REVIEWER plus **Agent Cash-In Network** under UNASSIGNED: 8 in total.
- Every pending name in Finalize prerequisites is an underlined link, e.g. "Agent Cash-In Network · Needs review".

**M3 — Decisions hierarchy (decisions-390, decisions-1440)**
- **Make a decision** is the only filled button in the action panel, and it comes first.
- Assign confirmer is outlined.
- "Review with a note only" is a text link with the hint "Records a note; Knowledge unchanged."
- "Decision controls ↓" is now a white outlined bar, not a filled primary.
- The 27 and 30 values stay side by side at 390.

**M4 — Register attention (register-768, register-1440)**
- Rows with no reasons show a neutral "—".
- Orange text appears only on Instant Settlement Payout, Merchant Flex Finance and Merchant Pricing Update. That matches Home's "3 need attention (5 reasons)".
- The visually hidden label cannot be verified from pixels.

**M5 — Wording (weekly-draft-1440/390, weekly-confirm-390)**
- Commentary reads "target live: 1 Oct 2026 → 8 Oct 2026 (7 days later)" and "Finance calculation review — 29 Sept 2026".
- The status headline reads "Delivery · Phase 1 · …", with no uppercase enum.
- The dialog reads "8 Oct 2026 → 15 Oct 2026" and "Apply 1 update".
- No `YYYY-MM-DD` strings appear in the Weekly or confirm captures.

## Earlier non-blocking items

**Resolved:**
- "Refresh inputs" no longer appears when inputs are current.
- The mobile "Sections (8)" disclosure is collapsed and shows "Current: Merchant Flex Finance".
- The Final receipt now includes "by".
- Administration has a distinct gear icon.
- The Roadmap axis labels are separated.
- The mobile top bar "Prodwise · Demo" is no longer clipped.

**Still present (minor):**
- Roadmap markers still cluster in the right part of the track, because the range starts at 1 Jun.
- "Global authority" is now plain text. The earlier plural checks ("1 domains", "1 entries") are not visible in this set.

## Newly inspected evidence

**Policy consequence review (policy-review-390): acceptable**
- The in-page "Review this change" names Interface Lab.
- It states "Other organizations are unchanged".
- It shows the new domains with "Previously: quality.test".
- It offers **Save organization policy** and **Keep editing**.
- No generic "Are you sure" appears.

**Owner consequence review (owner-review-390): acceptable**
- It names the organization, the new Org Owner (Taylor Morgan), the previous owner (Jordan Lee) and the reason.
- It states the effect ("Existing other owners become Admins") and the invariant ("At least one active Org Owner must remain").
- The destructive action is red, and Keep editing is offered as the alternative.

**Platform Owner shell after switch (platform-owner-shell-390)**
- The announcement reads "You are now working in Interface Lab".
- The new organization appears in the top bar, and a light focus ring is visible on the menu button.
- Orientation is in-flow, and the W39 Final module shows the finalizer and date.

**Mobile metric (metric-detail-390)**
- Visible: route links (Portfolio / Projects, "← Projects", "Open initiative Brief →"), the "Synthetic demo measurement" label, the latest value 3.4 days with its period, the target line with approver and date, and the neutral sentence "0.4 days above the approved target".
- Observations render as labelled cards (Value / Captured / Source / note), and the partial-launch caution is preserved.

**Account (account-390)**
- Visible: Identity (name, email), the password form, Sign out, and the start of a "Current organization" section.
- For a normal membership fixture, showing the password form is correct.

## Remaining findings (all minor)

1. **"Prepare W40 review" state is ambiguous** (platform-owner-shell-390).
   - A filled, enabled-looking primary sits above "W40 starts 28 Sept 2026", in a session whose history is timestamped 27/09.
   - The contract treats the week's start as a *disabled reason*.
   - If the action is available before W40 starts, reword the line (e.g. "W40 begins 28 Sept 2026"). If not, render it disabled and link the reason with `aria-describedby`.
   - Redteam should confirm the actual state.
2. **Weekly state chip looks like a button** (weekly-draft/final-1440).
   - "Draft" and "Final" use the same bordered box and height as "Open week".
   - Style them as non-interactive status pills.
3. **Weekly sentence wording is inconsistent with the shared renderer.**
   - Weekly says "target live: 1 Oct 2026 → 8 Oct 2026 (7 days later)." and "next milestone: recorded 29 Sept 2026."
   - Home and Brief say "Target Live moved 1 Oct 2026 → 8 Oct 2026 (+7 days)".
   - Because this seeds Final wording, align new Template output to the shared renderer. Do not rewrite persisted Finals or human-edited text.
4. **Week label format differs.** Weekly uses "2026-W39 · Draft" and "Compared with 2026-W38 Final"; Home uses "W39 review" and "W38 Final". Pick one display format.
5. **Final commentary provenance line** (weekly-final-1440).
   - It reads "Prepared scenario notes Synthetic scenario preparation · 20 Sept 2026, 13:00 Cairo Commentary never updates…". It lacks "by" and a sentence break.
   - Field labels such as "WHAT CHANGED" sit closer to the preceding value than to their own, which blurs the grouping.
   - Keep the persisted text byte-identical; fix only the rendering chrome.
6. **Confirm dialog jargon** (weekly-confirm-390). "These changes update the initiative truth" is internal vocabulary. "…update the initiative record" matches the panel heading.
7. **Admin history date format** (policy-review-390).
   - "27/09/2026, 14:13:12" breaks the "27 Sept 2026" convention.
   - Repeated "Organization Context Switched" rows also crowd a section titled policy history. Consider a filter or grouping.
8. **Policy diff could be more explicit.** Show "Added: example.test" rather than making users compare the full list with "Previously".
9. **Account section order** (account-390).
   - Security and Sign out come before Current organization, and Sign out sits directly under Update password.
   - The contract order is Identity → Access → Security → Preferences → Sign out.
10. **Register header alignment** (register-1440).
    - The header labels sit on two baselines (Stage/Owner/Coverage higher than Initiative/Attention/Target Live/Latest change).
    - Initiative names sit lower than the other cells in their row.
    - The Sort select's default shows "All"; it should name the actual sort, e.g. "Name".
11. **Decisions lane tabs at 390.** "His…" is cut off at the right edge with no visible fade. This is pre-existing preserved layout; confirm the edge fade renders.

## Residual verification for the browser redteam (not visual failures)

- **Account Access section:** current organization, role, Product Lead and a separately labelled "Platform Owner (global)". It is below the fold in account-390; capture it for a Platform Owner identity.
- **Mobile metric, lower sections:** the definition fields, the second metric's "Not observed" null and the absence of a chart are below the fold in metric-detail-390.
- **Screen-reader label** "No attention reasons recorded" on the register "—".
- **Guest isolation and Administration denial** are tested separately; nothing here infers guest authority from the Demo Reviewer fixture.

With M1–M5 fixed and no visible blocker or major defect, the rendered UX is accepted. Items 1–3 should land before release polish; the rest can follow.