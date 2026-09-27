# APPROVE (visible state only)

## Fix 1: Batch toolbar placement ✅
- At every width (390, 768, 1024, 1440), the toolbar sits directly under "Proposed understanding", inside the proposals column and above "Needs your decision."
- It is no longer detached from the content it acts on.
- The disabled "Confirm 0 selected proposals" and "Clear selection" controls, plus the independence and unassigned-action note, read clearly.
- At 390 it lives inside the Proposals tab, which is correct.
- Scroll margin cannot be verified from static screenshots. Leave that to red-team.

## Fix 2: Duplicate warnings ✅
- The handled history shows the matches are independent of titles:
  - "Pilot repayment divisor" matches prior "Repayment divisor" (superseded): the warning names the supersession and points to the human entry.
  - "Pilot receipt wording" matches prior "Receipt wording" (confirmed action): the warning shows with "View action record."
  - "Receipt" matches prior "Receipt" (same title): the warning shows with "View unverified Knowledge record."
- All three explicitly say "confirming again creates another record."
- Each warning names the correct destination type: Knowledge for the requirement and business rule, action record for the action.

## Minor nits (non-blocking)
1. **Link affordance:** At screenshot resolution, "View unverified Knowledge record" / "View action record" inside the warnings don't look visibly distinct from the surrounding grey text. Confirm they are underlined or colored and focusable.
2. **Spacing:** "1 unsupported candidate discarded before saving." sits tight under the toolbar box. A few pixels of top margin would help.
3. **Wording consistency:** Receipt and action warnings say "May match an already confirmed proposal," while the superseded warning is assertive. This is acceptable if it is intentional (for example, quote match vs. value match), but make sure the copy logic is deliberate.

## Not assessed
- Link targets, functional duplicate detection, batch behavior, and the 248px sidebar measurement are not verifiable from the images.
- These go to independent red-team as planned.