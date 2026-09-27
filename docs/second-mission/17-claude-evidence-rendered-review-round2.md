# Verdict: **REVISE**

Intake is acceptable. The pending, handled and empty states each have at least one visible blocker.

## Major visible fixes required

1. **Empty result at 1440 has a broken shell.**
   - The sidebar renders at about 138px instead of full width.
   - "Prodwise" is clipped.
   - The org name wraps into "Independ / ent / Review / Lab".
   - The initiative link wraps into five lines.
   - A pale gap sits between the sidebar and the content.
   - The other 1440 captures are fine, so this is a state-specific layout regression. Recapture after the fix.

2. **Pending decisions sit below handled history.**
   - At every width, "Attempt 1 · Handled proposals (3)" comes first.
   - "Attempt 2 · Needs your decision (3)" appears only after a long scroll. At 390 it starts roughly two screens down.
   - Put "Needs your decision" first. Collapse or demote handled history below it.

3. **Duplicate proposals across attempts are not flagged.**
   - Attempt 2 offers "Receipt" and the "Confirm the pilot receipt wording" action as pending.
   - Attempt 1 already confirmed that same requirement and action.
   - The pilot divisor also reappears after being superseded.
   - Nothing warns the user that confirming creates a duplicate Knowledge record or commitment. Show "Matches confirmed record / superseded entry" on those cards, with a link.

4. **Batch selection has no visible batch action.**
   - Each pending card has a "Select … for batch confirmation" checkbox.
   - No "Confirm selected (n)" control appears anywhere in the pending captures.
   - Either show the batch bar (sticky on mobile) or remove the checkboxes.

5. **The empty result has no way to act.**
   - The copy says "You can add your own understanding with a human entry."
   - No "Add my own entry" button is rendered at any width. Add the CTA in that panel.

## Minor issues (fix if cheap)

- **Stale copy on a handled card:** "Repayment divisor" is marked "superseded by human entry" but still says "Confirming adds to Knowledge as unverified." Replace it with a link to the human entry that superseded it.
- **Wrapped links at 390 and 768:** "View unverified / Knowledge record" wraps under the button and looks detached. Stack the button and link, or style the link consistently.
- **Batch result placement (fixed state, 768 and up):**
  - The result box spans outside the proposal column at the page bottom, far from the actions.
  - "Confirmed View action record" needs a separator.
- **Action card field order:** "Edit cosmetic wording" sits directly under "No date or assignee is inferred." Move it above the assignee and date fields, consistent with the other cards.
- **Evidence panel at 1024 and 1440:** it scrolls away while you review long lists. Consider making it sticky so "Highlight" stays visible.
- **Intake "Saved evidence" link:** it has no affordance, unlike the "← Back to saved evidence" link on the other pages.
- **Sidebar background:** it ends near 1000px in the full-page captures. This is likely a capture artifact; confirm in a real scroll.

## Confirmed working

- **Separation and labels:** pending/handled split, type groups with counts, and status chips.
- **Controls:** secondary Retry button, explicit destination wording on pending cards, and visible own-entry controls.
- **Quotes:** gutter and quote styling, plus the highlight focus ring in the evidence panel.
- **Navigation and forms:** "Back to proposal" button, unassigned/unknown date fields with the no-inference note, and honest stopped/ready attempt history.
- **Intake:** reassurance copy and character count are clear.

Functional gates you listed as passed are not contested here. Outage and stale-failure visuals remain unreviewed.