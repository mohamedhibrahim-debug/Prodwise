# Rendered Review: P0‑1 Setup/Manage and P0‑2 Ownership Display (16 screens)

## Verdict: **REVISE** (visual only)

The structure is right. Create is four essentials, Setup is a stepped flow, Review is an honest checklist, and Manage is sectioned.

The copy mostly respects A1.2 and A1.3:
- "Setup coverage does not replace open attention or release approval"
- "Only an admin or Product Lead can change the owner"
- "Unknown is a deliberate record"

Four things block visual approval:
- Mobile layout defects on Manage and Create.
- Scope/context rendering that contradicts A1.5.
- No Attention signal anywhere.
- Owner prominence too weak for P0‑2.

This verdict covers only what is visible. It says nothing about server auth, idempotency, concurrency, archive guards or the Ready/history journey, which remain final‑acceptance gates. Your axe and overflow passes don't catch the clipping below, because it is overlap, not overflow.

## Blockers

1. **manage‑390 and manage‑768, Scope/phase and Lifecycle sections.** White panels overlay the text above them:
   - "Synthetic merchant pilot" and "Synthetic merchant pilot · Current" are cut in half.
   - "Active record · Discovery" is clipped.
   - Large empty gaps follow each panel.
   - At 768 the legacy line and "Create context from this" disappear entirely.

   Match the 1024 layout: stacked, no panel backgrounds, normal flow.

2. **create‑390, sticky "Create initiative" bar.** It covers the lifecycle radio list, hiding "Delivery" and cutting "Alignment". Either make the bar non‑sticky, or pad the bottom of the form by the bar height and give the bar a top border or shadow.

3. **setup‑\* (all widths), "Delivery phase / scope" free‑text input.** This is a legacy string edited as if it were a context, which A1.5 forbids. Replace it with a controlled‑context selector: current context plus "Create context". Show the legacy string read‑only as "Legacy scope: '…' (not a controlled context)".

4. **manage‑1024 and manage‑1440, Scope/phase.** A context "Synthetic merchant pilot · Current" already exists, yet the legacy row still offers "Create context from this". That invites a duplicate. Once a context was created from the legacy string, or a context with the same label is current, hide or disable the action with its reason.

   Related: **review‑\* "Current scope / phase: Recorded"** must reflect R6, meaning a controlled context. Label it with the context name, not the legacy string.

## Major

5. **Attention is invisible.** No Setup or Attention chips appear in the header on setup‑\*, review‑\* or manage‑\*. Add both to the initiative header next to "Discovery", e.g. "Setup incomplete · 8/10" and "Attention: Not assessed / N open". The disclaimer sentence alone is not independence.

6. **P0‑2 owner prominence.**
   - The header "Owner · Review PM" is small and low‑contrast grey on every screen.
   - In Manage > Ownership, the name sits as body text with no "Owner" label.
   - There is no link to assignment history, though the copy claims "Previous assignments remain in history".

   Fixes:
   - Header: the owner name at body weight and at least AA contrast.
   - Ownership: a labelled "Owner" value plus a "View history" link.

7. **create‑390/768/1024 banner.** It omits the A1.2 required rail copy; only the 1440 side rail has "Existing checks apply immediately". Use the exact A1.2 creation‑rail sentence in the banner at every width.

8. **review‑\* status column.** "Recorded" and "Missing" have identical plain styling, and the actions look like bold labels, not links.
   - Give Missing a distinct chip and sort it first, or group it under "Remaining (2)".
   - Show Target Live and Next milestone as "Unknown · recorded", not "Recorded". Unknown must be visibly different from a known value.
   - Style actions as links or buttons.

9. **review‑768.** Right‑edge actions touch the viewport edge with no gutter ("Review initiative name"). The same edge‑flush problem affects "Continue to Sources →" on setup‑768/1024.

10. **setup/review 390, 768 and 1024 content column.** The page heading and body start at x=0 while the header uses a 16px inset; "Delivery context" and "Review setup" sit flush left. Apply the standard content padding.

11. **setup‑\* rationale.** "Why / where this comes from" is required per A1.4 but has no "*" and no helper text. Mark it required and show the inline error state.

12. **Copy and spacing defects.**
    - "Next meaningful stepLinked source" is missing a space (390/768).
    - "DISCOVERY" appears as a raw enum on review‑\*.
    - create‑\*: the owner helper line collides with the "Lifecycle stage" label, with no spacing.
    - Owner at create reads "Review PM (you)"; the contract format is "You (Name)".

13. **Wayfinding.** The "Brief" tab stays active on the Setup and Manage pages.
    - manage‑1024 and manage‑1440: "Back to Brief" and "Review setup" float far apart. Group them.
    - manage‑390: the "Sections (6)" disclosure appears empty or collapsed with no affordance.

14. **1024/1440 sidebar.** In the full‑page captures it ends at about 1000px, leaving a white block below. Confirm this is a capture artifact; if not, fix the sidebar to full height. The Next.js "N" dev badge also overlays content in every shot. Hide it in review captures.

## Missing states (needed before P0‑1/P0‑2 completion)

**Create and ownership**
- Admin or Product Lead create with the owner picker.
- PLATFORM_OWNER without membership, where self is not offered.
- Unassigned "No owner recorded" with R3 unmet.
- The authorized "Change owner" panel with its required rationale.

**Validation and setup flow**
- Validation errors on create and on the rationale field.
- Legacy‑only with no context (R6 unmet).
- Retired context and the rename flow.
- Setup step 3, the Sources form, including the "PAY‑9X" format error.
- The Ready card with the A1.2 copy.

**Register and roles**
- The Register with separate Setup and Attention columns and filters.
- Viewer view with reasons shown in place of controls.

**Archive**
- Archived read‑only banner and restore state.
- The guarded‑write message "Archived — restore to edit. Nothing was changed."

**States at all widths**
- Save failure and loading states at all four widths.

## Final acceptance status

Visual verdict is REVISE on items 1–4, with 5–8 strongly recommended in the same pass. Re‑submit all four widths for Create, Setup, Review and Manage, plus the missing‑state set above.

Functional acceptance stays open until the Ready/history journey is complete and the server‑side authority and archive guards are demonstrated by tests. Screenshots cannot prove either.