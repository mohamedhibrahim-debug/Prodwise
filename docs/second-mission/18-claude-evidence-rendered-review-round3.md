**REVISE**

Most round 2 fixes land. Pending items come first, history is collapsed and demoted, the empty state has a human-entry CTA, handled links are styled, the batch bar shows at zero selection, and the 248px rail is settled. Two visible issues remain.

**1. The batch bar covers the first pending card at 768, 1024 and 1440.**
- In the full-page captures, the sticky or fixed bar sits over the Receipt card.
- At 768 and 1024 it fully hides the "Matches an already confirmed proposal… View unverified Knowledge record" warning and clips the top of the quote. At 1440 it covers the gap between the warning and "Highlight in original evidence".
- If this is only a full-page-capture artifact of a fixed element, confirm it with a viewport-height capture scrolled to the first card.
- Either way, a bottom-pinned bar needs to meet two conditions:
  - Content gets bottom padding at least as tall as the bar, so the last card's Confirm/Reject and the Handled toggle are never obscured.
  - The bar never overlays the duplicate warning when the card is scrolled into view.
- At 390, the inline placement works. Mirror that non-overlapping behavior on wider layouts, or dock the bar to the top of the proposals column.

**2. Duplicate warnings appear only for the Receipt card, not for the other two pending proposals that visibly duplicate handled ones.**
- **Business rule:** Pending "Pilot repayment divisor = 27" repeats the handled "Repayment divisor = 27", which was superseded by a human entry. It shows no "matches your existing human entry / Knowledge record" warning.
- **Action:** Pending "Pilot receipt wording" has the same quote and body as the confirmed "Receipt wording". It shows no warning.
  - This is the riskier case, because confirming creates a second initiative commitment.
- Matching appears to be keyed on title. It should also catch the same kind plus the same quote or value, or a near-identical body.
- Each warning needs a styled link to its result:
  - "View unverified Knowledge record" for the business rule.
  - "View action record" for the action.
- Show the same "confirming again creates another record" wording used on the Receipt card, at all widths.

Nothing else major is visible. Intake and empty states are clean at all four widths.