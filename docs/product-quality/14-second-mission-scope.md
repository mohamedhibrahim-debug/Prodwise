# Frozen Second Mission scope

Status: FROZEN / NOT STARTED. Preserved on 27 September 2026 at the user’s explicit request.

This artifact preserves the complete approved Second Mission text below, without reducing it to a summary. The later execution instruction controls timing: close the Current Mission, obtain its acceptance checkpoint and the user’s confirmation, then begin this frozen scope. Do not begin it or deploy from the Current Mission closure task. Earlier instructions below to continue immediately or not stop between missions are superseded only as to timing by that later instruction; the product scope and quality requirements remain preserved.

Source: user attachment 787e9a62-21af-482a-9e98-50bb2df924a9/Pasted text.txt. Preservation instruction: attachment 3b28530b-cc38-417c-abb1-9fa34c3915c2/Pasted text.txt.

Approved priority: P0 Ownership → Actions/Commitments → Anchored AI Evidence → Stage 2.3 Queue Completeness → Stage 2.4 Minimum Context; integrated UX review; P1 Meeting Intelligence → Relationships/Dependencies → Initiative History → Canonical Risks/Open Questions.

Approved operating loop: Evidence → AI Proposal → Human Confirmation → Product Truth → Decision / Attention → Ownership / Action → Delivery / Dependencies → Weekly Review → Initiative History.

Unknown != Failed. Missing != Zero. Claude leads Product/UX; Codex leads Engineering/Implementation.

## Complete approved scope (verbatim)

SECOND MISSION — COMPLETE THE MISSING CORE PRODWISE OPERATING LOOP
==================================================

The next objective is NOT to add random features.

The objective is to complete the missing pieces of the Prodwise operating model.

The target product loop is:

Evidence
→ AI proposal
→ Human confirmation
→ Product Knowledge / Truth
→ Attention / Decision
→ Ownership / Action
→ Delivery / Dependencies
→ Weekly Review
→ Initiative History

The product must feel like ONE coherent operating system.

==================================================
ABSOLUTE UX/UI RULE
==================================================

UX/UI QUALITY IS CRITICAL.

Do NOT implement these capabilities as generic CRUD.

Do NOT create a series of copied pages with:

- same heading
- same white cards
- same table
- same drawer
- same forms
- same spacing
- same interaction model

for every capability.

If the result looks copied/pasted or bolted onto the existing product, it is NOT complete.

A feature is not complete because:

- the DB exists
- APIs work
- tests are green
- buttons technically work

It is complete only when the user can understand:

- what this area is
- why it matters
- what they should do
- what happens after the action
- where the resulting information appears later

without needing documentation.

==================================================
CLAUDE = PRODUCT / UX DESIGN LEAD
==================================================

For this second mission, Claude is MANDATORY as Product / UX Design Lead.

Codex remains Engineering / Implementation Lead.

For every major capability:

1. Research comparable product patterns
2. Claude defines the UX / interaction model
3. Freeze the UX contract
4. Codex implements it
5. Render the actual result
6. Capture screenshots
7. Claude reviews the RENDERED UI
8. Fix all major UX/design issues
9. Independent red-team reviews it
10. Fix blocker/major findings
11. Test
12. Only then consider it complete

Claude must review screenshots/rendered behavior.

A code review alone does NOT count as UX review.

If the rendered UI looks cheap, repetitive, confusing or copied:

DO NOT SHIP IT.

Rework it.

==================================================
1. INITIATIVE OWNERSHIP
==================================================

Add a real initiative ownership model.

Minimum:

Primary Owner

This should represent the Product Manager / Product Owner primarily responsible for the initiative.

Optional only if genuinely useful:

Contributors / participating members

Do NOT create a complex HR/team-management product.

Ownership must integrate naturally with:

- Home
- Initiatives
- Brief
- Weekly Product Review
- Actions
- attention items
- portfolio filtering

Ownership should answer:

Who is responsible for this initiative?

It should not simply be a random Owner dropdown hidden inside a settings form.

Use ownership to support:

- responsibility
- Weekly Review sections
- action defaults
- portfolio filtering
- attention routing
- accountability context

==================================================
2. ACTIONS / COMMITMENTS
==================================================

Current Next Step text is not enough.

Create a first-class Action / Commitment model.

This is NOT Jira.

Prodwise Actions exist to track commitments emerging from product intelligence.

Minimum fields:

- Title
- Initiative
- Owner
- Due date, optional
- Status:
  - Open
  - In Progress
  - Done
  - Cancelled
- Origin:
  - Weekly Review
  - Meeting
  - Decision
  - Human Entry
  - Confirmed AI Proposal
- created by
- created at
- completed at
- linked source/evidence when relevant

Example:

Finance to confirm settlement approach

Owner:
Mariam

Due:
30 Sep

Status:
Open

Origin:
W39 Weekly Review

==================================================
ACTION INTEGRATION
==================================================

HOME

Show useful action attention such as:

- overdue commitments
- due soon
- blocked commitments

Do not turn Home into a task board.

BRIEF

Show relevant open commitments in initiative context.

WEEKLY REVIEW

A structured next step must not disappear as review-only text.

If a PM records:

Finance to confirm settlement approach by Wednesday

Prodwise should support creating/updating the canonical Action after explicit human confirmation.

NEXT WEEKLY REVIEW

Open actions should carry forward intelligently.

Completed actions should appear as meaningful changes/history where relevant.

==================================================
3. ANCHORED AI EVIDENCE INGESTION
==================================================

This is a CORE Prodwise AI capability.

Do not reduce AI to Weekly Review summarization.

Build the smallest reliable end-to-end evidence ingestion flow first.

Initial input:

Paste evidence / text

Examples:

- meeting notes
- stakeholder notes
- email excerpt
- BRD text
- document excerpt
- product discussion

Claude analyzes the evidence and PROPOSES structured records.

Possible proposal types:

- Requirement
- Decision
- Business Rule
- Risk
- Dependency
- Delivery Fact
- Action
- Open Question

Every proposal must be anchored to the evidence that supports it.

The user must be able to:

- Show evidence
- Confirm
- Reject
- Add my own entry

AI must NOT directly update Product Truth.

Required flow:

Evidence
→ AI Proposal
→ Human Confirmation
→ Canonical Product Record

Confirmed proposals then enter the correct domain.

Examples:

Requirement → Knowledge

Decision → Decision Truth

Target Live → Delivery Facts

Action → Actions

Risk → Initiative context

==================================================
AI TRUST RULES
==================================================

Preserve the approved principle:

AI proposes.
Humans confirm.

No unconfirmed proposal may become canonical truth.

Do not create vague “AI confidence” as a substitute for evidence.

Show the actual supporting evidence.

==================================================
VALUE EDIT SAFETY
==================================================

Preserve the previously approved behavior.

Cosmetic normalization:
allowed.

Material value editing:
must NOT silently mutate an AI proposal into a different claim.

Use the existing principle:

VALUE_EDIT_REQUIRES_NEW_ENTRY

Then:

Add my own entry

creates a Human Entry / Direct Knowledge record.

Do not pretend the newly written human value was contained in the original source.

==================================================
4. MEETING INTELLIGENCE
==================================================

Build Meeting Intelligence ON TOP OF the anchored evidence system.

Do NOT build a separate disconnected meeting-summary product.

MVP:

Paste:
- meeting notes
or
- transcript

Claude proposes:

- Decisions
- Actions
- Risks
- Changed requirements
- Delivery date changes
- Open questions

Each proposal must show:

the supporting excerpt.

User confirms/rejects individually.

Confirmed items flow into canonical Prodwise domains:

Decision
→ Decisions

Action
→ Actions

Risk
→ Initiative context

Delivery change
→ Delivery facts

Requirement / business rule
→ Knowledge

Open question
→ unresolved attention / initiative context

The original meeting note/transcript remains a Source.

Do not create another data island.

==================================================
5. TRUST ENGINE COMPLETION — STAGE 2.3
==================================================

Implement the previously approved Queue Completeness scope.

Decision/review item states:

OPEN
RESOLVED
DEFERRED
DISMISSED

Important:

Deferred and Dismissed are intentional human outcomes.

They must not be treated as equivalent to Resolved.

Preserve:

- invalidation semantics
- digest semantics
- re-emergence behavior
- immutable decision history

UX should clearly communicate the difference between:

Resolved
Deferred
Dismissed

Do not just put all three under “Closed”.

==================================================
6. TRUST ENGINE COMPLETION — STAGE 2.4
==================================================

Implement Minimum Context.

Add:

- Effective Date
- controlled Initiative Phase / Context
- chronology where needed

Purpose:

avoid false conflicts between facts applying to different times/scopes/phases.

Example:

Phase 1 Target Live

must not automatically conflict with:

Phase 2 Target Live

if the contexts are different.

Conflict comparison must remain conservative.

Preserve the existing rules:

same initiative
same normalized subject
same normalized attribute
compatible explicit context
active claims
different normalized values
no supersession

==================================================
IMPORTANT DIGEST REQUIREMENT
==================================================

Effective Date / context must affect BOTH:

- TypeScript contentDigestOf
- SQL decision_hash

Do NOT change only one implementation.

Add regression tests.

==================================================
7. INITIATIVE RELATIONSHIPS / DEPENDENCIES
==================================================

Add a lightweight relationship model.

Minimum types:

PART_OF
DEPENDS_ON
RELATED_TO

BLOCKS should be derived from DEPENDS_ON where appropriate.

Relationship fields:

- From Initiative
- To Initiative
- Relationship Type
- rationale/note
- created by
- confirmed by
- confirmed at

AI may PROPOSE relationships.

A human must confirm them before they affect Product Truth.

==================================================
RELATIONSHIP INTEGRATION
==================================================

Integrate naturally into:

- Brief
- Roadmap
- Home attention
- future Portfolio Analysis

Do NOT create a complex dependency management product.

ROADMAP

Dependencies should be visually understandable where relevant.

Example:

Initiative B depends on Initiative A.

If A's delivery moves beyond a meaningful milestone/target for B:

Prodwise may surface the dependency risk.

But:

Do NOT invent scheduling impact when facts are insufficient.

==================================================
8. INITIATIVE HISTORY
==================================================

Add a meaningful Initiative History / Timeline.

This must NOT be a raw technical audit log.

The purpose is to answer:

“What happened to this initiative over time?”

Show meaningful events such as:

- stage changed
- Target Live changed
- Actual Live recorded
- Decision finalized
- blocker added/removed
- Knowledge confirmed
- Action completed
- Weekly Review finalized
- scope/phase changed
- relationship/dependency confirmed

Keep raw technical audit data separate.

Do not add History as a new global navigation item.

It belongs naturally in the initiative experience.

==================================================
9. CANONICAL RISKS / OPEN QUESTIONS
==================================================

Do NOT build a giant separate risk-management application.

But Risks and Open Questions must not remain random free-text paragraphs.

RISK minimum:

- Title
- Initiative
- Status
- Owner if known
- Mitigation / Next Action if recorded
- Source
- Updated at

OPEN QUESTION minimum:

- Question
- Initiative
- Owner / expected confirmer if known
- Status
- Source / context
- Created at
- Resolved at

Integrate them into:

- Home attention
- Brief
- Weekly Review
- Meeting Intelligence

Only create a dedicated register if research strongly proves it is needed.

==================================================
10. CONNECT THE WHOLE OPERATING LOOP
==================================================

These features must NOT become separate mini-products.

Do NOT create five new global nav items:

Actions
Meetings
Relationships
Risks
Questions

Keep global navigation focused.

Use:

- initiative context
- progressive disclosure
- contextual rails
- drawers
- workbenches
- meaningful cross-links

based on actual UX research.

The user should experience ONE loop:

SOURCE / EVIDENCE

↓
AI understands the evidence

↓
Human confirms

↓
PRODUCT TRUTH

↓
Decision / Attention

↓
Owner / Action

↓
Delivery / Dependency

↓
Weekly Review

↓
History

==================================================
11. VISUAL / INTERACTION QUALITY
==================================================

This is NON-NEGOTIABLE.

Do NOT:

- clone one page five times
- use cards everywhere
- create forms that look like internal admin/debug tools
- add tables without interaction reasoning
- stack everything vertically on mobile
- hide critical actions inside tiny links
- use Help text to compensate for bad UX
- create a “functional but ugly” result

Each new capability must have its own appropriate interaction model.

Examples:

Evidence ingestion
should feel like:
evidence → proposals → review/confirmation

not:
textarea + button + giant output paragraph

Actions
should feel like:
commitments in product context

not:
generic task manager

Relationships
should feel like:
initiative context/dependency understanding

not:
From dropdown + To dropdown + Save button as the main UX

History
should feel like:
meaningful product evolution

not:
database audit logs

Meeting Intelligence
should feel like:
review extracted product intelligence

not:
AI summary page

==================================================
12. PRODUCT COMPREHENSION TEST
==================================================

For each new capability ask:

Within 10 seconds can a Product Manager answer:

- What is this?
- Why is it here?
- What should I do?
- What happens after I do it?
- Where will I see this information again?

If not:

the UX is not finished.

==================================================
13. EXECUTION PRIORITY
==================================================

Finish the CURRENT active mission first.

Then execute this second mission in this order.

P0 — REQUIRED CORE LOOP

1. Initiative Ownership
2. Actions / Commitments
3. Anchored AI Evidence Ingestion
4. Stage 2.3 Queue Completeness
5. Stage 2.4 Minimum Context

Then perform an integration / UX review of that loop.

P1 — COMPLETE THE OPERATING MODEL

6. Meeting Intelligence
7. Initiative Relationships / Dependencies
8. Initiative History
9. Canonical Risks / Open Questions

Do not move to broad external integrations until this loop is coherent.

==================================================
14. DO NOT EXPAND INTO THESE YET
==================================================

Do NOT turn this mission into:

- full Jira integration
- Google Drive integration
- Gmail integration
- Slack integration
- Figma sync
- ClickUp sync
- generic Notification Center
- Market Intelligence
- Product Challenger
- standalone UAT Calendar
- complex resource planning
- generic task/project management
- broad new RBAC redesign

These remain future scope unless later explicitly requested.

==================================================
15. DEMO INTEGRATION
==================================================

Extend the existing coherent Prodwise Demo dataset to demonstrate the new scope.

Do NOT fabricate AMAN data.

Synthetic demo should include enough examples to demonstrate:

- initiative owners
- open actions
- one overdue or due-soon commitment
- AI evidence proposals
- confirmed/rejected proposal examples where useful
- a meeting-derived decision
- a meeting-derived action
- Deferred or Dismissed decision
- phase/context example
- initiative dependency
- meaningful history
- risk
- open question

All Demo information must remain:

- fictional
- coherent
- internally consistent
- isolated from AMAN

No disconnected hard-coded dashboard data.

==================================================
16. END-TO-END CORE PRODUCT TEST
==================================================

Test at least one complete story:

1. User pastes evidence
2. Claude proposes structured understanding
3. Evidence is visible
4. Human confirms selected items
5. Knowledge updates
6. Decision/attention appears where applicable
7. Action is created where applicable
8. Owner is clear
9. Confirmed delivery change affects delivery truth
10. Roadmap reflects confirmed delivery facts
11. Dependency impact appears only when supported
12. Weekly Review sees the resulting changes
13. Human finalizes Weekly Review
14. Next Weekly Review uses it as baseline
15. Initiative History shows the meaningful events

Verify:

- no duplicate truth
- no AI proposal changes truth without confirmation
- no context-incompatible false conflicts
- Deferred/Dismissed semantics remain correct
- action carry-over works
- ownership filtering works
- relationships remain organization-scoped
- no cross-org leakage
- Demo stays coherent

==================================================
17. RESPONSIVE + ACCESSIBILITY
==================================================

For every new major interaction test:

390
768
1024
1440+

Do NOT build desktop first and merely stack everything on mobile.

Use intentional mobile interaction patterns.

Validate:

- keyboard navigation
- focus
- forms
- proposal review
- tables/lists
- drawers
- dialogs
- timeline/history
- action controls
- relationship controls
- contrast
- status clarity
- reduced motion

==================================================
18. PERFORMANCE
==================================================

Do not undo the performance improvements from the current mission.

Every new capability must preserve the fast-feeling navigation model.

Watch for:

- repeated session fetching
- repeated initiative fetching
- serial waterfalls
- oversized AI payloads
- unnecessary rerenders
- route remounts
- large history payloads
- slow proposal rendering

Use progressive loading where useful.

Do not block the full page while Claude is processing.

The user should still be able to understand what is happening.

==================================================
19. CLAUDE FINAL VISUAL REVIEW
==================================================

Before calling the second mission complete:

Give Claude the actual rendered screenshots / product.

Require Claude to independently review:

- Initiative ownership
- Action experience
- evidence ingestion
- AI proposal review
- Meeting Intelligence
- Decision states
- context/effective date UX
- dependencies
- history
- risks/open questions

Ask specifically:

Does any part look:

- copied/pasted?
- generic CRUD?
- disconnected?
- developer-designed rather than product-designed?
- inconsistent with Prodwise?
- confusing without instructions?

Fix all major findings.

==================================================
20. INDEPENDENT RED TEAM
==================================================

Then use a FRESH independent high-capability reviewer that did NOT design these features.

Test as:

- Product Manager
- Product Lead
- first-time user
- Demo reviewer

Ask them to complete the full evidence-to-action workflow without instructions.

Fix blocker/major usability failures.

==================================================
21. FINAL DEPLOYMENT
==================================================

Only deploy after:

- current mission fully complete
- second mission complete
- UX contract respected
- Claude rendered review passed
- red-team passed
- tests passed
- accessibility passed
- performance remains acceptable
- Demo consistency passed

Do not deploy half-completed new workflow states.

Deploy the exact tested SHA.

Do not:

- delete production data
- weaken RBAC
- expose secrets
- fabricate AMAN data
- bypass confirmation rules

==================================================
FINAL REPORT
==================================================

Do not return to me between Mission 1 and Mission 2.

Return ONE final completion report when both are done.

Report:

1. CURRENT MISSION COMPLETION
- what was completed
- screenshots
- tests
- performance
- deployment

2. NEW CORE SCOPE
- Ownership
- Actions
- Anchored AI Evidence
- Meeting Intelligence
- Queue Completeness
- Minimum Context
- Dependencies
- History
- Risks/Open Questions

3. UX / UI QUALITY
- Claude UX contracts
- rendered Claude reviews
- important changes after critique
- confirmation that generic CRUD/copy-paste patterns were removed

4. END-TO-END OPERATING LOOP
Demonstrate:

Evidence
→ AI Proposal
→ Human Confirmation
→ Product Truth
→ Decision
→ Action
→ Delivery
→ Weekly Review
→ History

5. DEMO SCENARIO
- canonical synthetic data
- consistency results

6. TEST RESULTS
- unit
- database
- browser
- AI
- responsive
- accessibility
- performance
- org isolation
- production smoke

7. RED-TEAM
- findings
- fixes
- remaining non-blockers

8. PRODUCTION
- URL
- final SHA
- deployment ID
- Ready / Production / Current

9. FINAL VERDICT

Use exactly one:

READY FOR DEMO

READY WITH ONE MANUAL STEP

BLOCKED — exact blocker

==================================================
FINAL WORKING PRINCIPLES
==================================================

Do not optimize for feature count.

Do not optimize for passing tests.

Optimize for a coherent Product Intelligence operating system.

AI proposes.
Humans confirm.

Unknown != failed.
Missing != zero.

Actions are commitments, not a Jira clone.

Meeting Intelligence feeds Product Truth; it does not create another data island.

Weekly Review consumes and records Product Truth; it is not a parallel database.

History explains product evolution; it is not an audit-log dump.

Dependencies are evidence-backed relationships; do not invent schedule impact.

UX/UI quality is a hard product requirement.

If a feature looks copied/pasted, generic or cheap:

REWORK IT.

Claude owns Product / UX quality.

Codex owns engineering quality.

Research
→ Design
→ Build
→ Render
→ Critique
→ Fix
→ Red-team
→ Test
→ Deploy.

Continue the work you are currently doing now.

Finish it completely.

Then immediately execute this second mission.

Do not stop between them.