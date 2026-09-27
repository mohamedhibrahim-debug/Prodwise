# Round 2 Visible-Screens Verdict: **APPROVE**, with one should-fix and minor polish

**Scope of this verdict:** the 16 rendered screens (Create, Setup Step 2, Review, Manage at 390/768/1024/1440) meet the A1 contract. This is a visual and IA verdict only. It is not P0-1 or P0-2 acceptance.

## What now reads correctly

- **Setup and Attention are independent.**
  - The header shows "Setup incomplete · 9/10" and "Attention: No open items in current checks" as separate chips at every width.
  - The page subtitle states that setup coverage doesn't replace attention or release approval.
  - Nothing says "paused" or "0 conflicts".
- **Unknown and Missing are distinct.**
  - Review separates "Missing" (Linked source), "Recorded" and "Unknown · recorded" rows.
  - Step 2 explains "Not recorded remains missing and does not complete setup."
  - The rationale field is required per save.
- **Ownership (A1.3) is correct.**
  - The Member create screen has a fixed "Review PM (you)" with no picker.
  - Manage › Ownership gives the owner a strong label.
  - The reason copy reads "Only an admin or Product Lead can change the owner."
  - "View assignment history" is present.
- **The legacy scope string is preserved verbatim** and labelled "(not a controlled context)".
- **Archive is honest.** Its absence is explained ("Only organization administration can archive or restore"), and there is no delete control.
- **Mobile layout works.** Actions sit in normal flow, the 390 radios stack, there's no overflow, and the Attention chip wraps rather than truncating.

## Remaining issues

**1. Should-fix (near-major). The Scope/phase block is ambiguous about which item satisfies R6.**
- **Where:** setup-current-* and manage-current-*, Scope / phase.
- **What the block shows, in order:**
  - a bold "Synthetic merchant pilot"
  - "Legacy scope: 'Synthetic merchant pilot' (not a controlled context)"
  - a "Create scope context" button
  - "Synthetic merchant pilot · Current"
  - Rename / Retire
- **Why it matters:** a reader can't tell whether a controlled context already exists or whether only the legacy string exists. The first case is implied by "Current", Rename/Retire and Review marking the row "Recorded". The second case is implied by the Create button sitting right under the legacy line. A1.5 says legacy alone must not satisfy R6, so the UI has to make it unmistakable which one counts.
- **Fix:** split the block into two labelled rows.
  - **"Current context: Synthetic merchant pilot"**, with Rename/Retire.
  - **"Legacy scope (read-only): '…'"**, with "Create context from this" shown only when no controlled context carries that label.
  - Label the general create action "New context".
  - Remove the duplicate bold label above the helper text.

**2. Minor. Mobile tab strip (390, all initiative screens).** "Commitm…" is clipped and there's no scroll affordance. Add an edge fade or scroll-snap so users know more tabs exist.

**3. Minor. Next meaningful step (390/768 Setup and Review).** Only the link "Linked source →" shows. The descriptive line "Map a source to this initiative" appears at 1024+ only. Show it at every width.

**4. Minor. Manage › Delivery summary.** It shows only "Target Live · Explicitly unknown". Next milestone is also Unknown · recorded in Review but is omitted here. List every recorded delivery fact, or add "+1 more".

**5. Minor. Spacing and alignment.**
- **Adjacent buttons:** "Add source" and "Open recorded evidence" touch with no gap at all widths.
- **Create form, owner helper:** the helper "Responsible for this initiative…" butts against "Lifecycle stage *" with no gap.
- **Create form, 390 Cancel:** Cancel is top-aligned beside the full-width Create button. Stack it or centre-align it.

**6. Minor. Header chips.** The underline under the Setup and Attention chips reads as a hyperlink. Either make them actual links (Setup chip to Review, Attention chip to its list) or drop the underline.

## Not demonstrated by these screenshots (separate acceptance work, not inferred)

- **Server-side behaviour:**
  - the authorization matrix (A1.12)
  - archive guards on legacy entry points
  - `clientRequestId` idempotency and concurrency
  - rationale enforcement
- **Other states:**
  - Admin/PL owner picker and the Change-owner panel
  - PLATFORM_OWNER create
  - "No owner recorded"
  - assignment history content
  - Ready card
  - Needs-attention and Not-assessed states
  - Archived read-only view and restore
  - Register dual columns and filters
  - validation and error states
  - Sources step (3)
  - Viewer view

The local create/owner/Unknown/archive/restore flow plus the axe and overflow passes are noted as supporting evidence only.

**Final acceptance** needs the Ready and history journey plus the states listed above. Item 1 should land before the Ready journey is recorded.