# Verdict: **REVISE** (visible state only)

The core safety model reads correctly in these screenshots:

- Original text is saved before AI and marked read-only.
- There are no confidence scores.
- Confirm and Reject are explicit per item.
- "No date or assignee is inferred" is honest.
- "View unverified Knowledge record" keeps Knowledge unverified.
- The 390 width uses Evidence/Proposals tabs.

Several visible issues fall short of enterprise quality and the binding UX, so this cannot be approved yet.

## Major fixes

1. **Proposals are not grouped.** The binding UX requires grouped proposals. What renders is a flat list with small uppercase labels (REQUIREMENT, BUSINESS RULE, ACTION). Add real group headings with counts, e.g. "Requirements (1) · Business rules (1) · Actions (1)." Also separate pending items from resolved ones. The confirmed "receipt" item sits inline with pending work, and its status is only faint right-aligned text.

2. **Status and action hierarchy is inverted.**
   - "Retry reading with Claude" is the strongest dark primary button on a *ready* reading. It visually competes with Confirm. Demote it to secondary or tertiary.
   - "confirmed" and "pending" need distinct, labelled status treatments (text plus shape, not color alone).
   - "Add my own entry" renders as plain text beside buttons. At 390 it wraps into a two-line orphan. Give it a clear control style.

3. **Destination wording is ambiguous.** "Knowledge · added unverified, then verified separately" appears on a *pending* item. It can read as if verification will happen automatically. Use explicit future and current states:
   - Pending: "Confirming adds to Knowledge as **unverified**. Verification is a separate step."
   - Confirmed: "Added to Knowledge · unverified."

   Apply the same pattern to the Action item: "Confirming creates an initiative commitment."

4. **The evidence–quote relationship is weak on desktop.**
   - The evidence pane's right border butts directly against the proposals column with no gutter, so the two panes look collided rather than deliberately split.
   - The evidence pane ends around y≈750, leaving a large dead column beside long proposals. Stickiness cannot be judged from a static capture, so verify that the pane stays pinned while proposals scroll.
   - Quote blocks are faint-bordered small text. Strengthen the quote styling and make "Show evidence" state what it will do (highlight in the original).

5. **Mobile wayfinding.**
   - At 390, roughly 330px of initiative chrome precedes the reading title.
   - The initiative tab row clips "Commitm…" with no scroll affordance.
   - "All saved evidence" floats as unlabelled text above the actions and should read as a back link.
   - The Evidence/Proposals tabs look like two buttons. Confirm they expose tab or selected semantics, not only the filled style.
   - The Show evidence → Evidence tab → back-with-focus flow is **not visible** and must be verified.

6. **Polish and correctness.**
   - "1 unsupported candidates" should be "1 unsupported candidate."
   - The saved timestamp uses 27/09/2026 while the date input shows mm/dd/yyyy. Align locale formats.
   - Titles are lowercase ("receipt", "repayment divisor").
   - The Business rule value "27" floats without a label.
   - At 768 the header meta items carry stray underlines.
   - At 1024 and 1440 the sidebar background stops at about 1000px while the content continues.

## Visible approval vs capability acceptance

- **Visible:** Not approved yet. Fixes 1–4 are required. Fix 5 is required for mobile, and fix 6 is minor.
- **Local checks:** The real Claude read, the unverified Knowledge confirmation, axe 0 and overflow 0 are accepted as passing. However, axe 0 does not prove the tab semantics or focus return.
- **Full capability:** Not accepted. These states remain unseen and unverified:
  - intake
  - read failure (text preserved)
  - empty or no-candidates
  - batch confirmation
  - stale or concurrent editing
  - rejection with note
  - Show evidence highlight and focus return on mobile
  - confirmed-item post state and destination link-through

Re-submit screenshots of the fixed ready state plus these states at all four widths.