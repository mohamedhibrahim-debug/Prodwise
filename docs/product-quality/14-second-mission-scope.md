# Second Mission canonical scope

## Final execution clarifications — binding

1. **Initiative management discoverability.** Editing and setup management must be clearly discoverable. A user must never guess where to edit basics, change owner, update scope/phase, manage delivery facts, manage sources or archive. Claude must define a clear Initiative Settings / Manage Initiative entry point within the initiative experience. No obscure menus or undocumented actions.
2. **Permissions / authorization.** Every new write respects existing organization-scoped RBAC. Define and test who may create initiatives, edit metadata, assign/change owners, link/unlink sources, archive, create/complete actions, confirm AI proposals, defer/dismiss decisions, confirm dependencies and resolve risks/open questions. Reuse PLATFORM_OWNER / ORG_OWNER / ADMIN / MEMBER / VIEWER; no new RBAC model. Document the final permission matrix. Viewer remains read-only. Enforce authorization server-side, not just by hiding UI.
3. **Concurrency / safe editing.** Canonical edits must not overwrite newer changes silently. Use appropriate updated_at/version checks, deterministic conflict handling, immutable history and safe concurrent writes. Protect Target Live, ownership, decision state, source mapping, AI confirmation and Action status changes. No silent last-write-wins loss of trusted state.
4. **Search / cross-navigation.** Integrate new canonical objects with existing navigation/search where useful. Users must move naturally between Source, Initiative, Decision, Action, Weekly Review and History. No dead ends or objects accessible only from their creation screen. Use contextual links/search while preserving focused global navigation.

Authoritative execution prompt approved 27 September 2026. Supersedes earlier scope versions. Accepted starting SHA: 4623810ddcb28382e79cbb3dcae8c01b7d966f3e. No deployment until final checkpoint approval.

PRODWISE — SECOND MISSION EXECUTION PROMPT
CANONICAL SCOPE + UX GOVERNANCE + CLAUDE APPROVAL + EXECUTION ORDER

Proceed from the current paused state.

Do NOT wait for another attachment or prompt.

Use the current stable baseline as the starting point:

Stable Current Mission commit:
4623810ddcb28382e79cbb3dcae8c01b7d966f3e

Current Mission is accepted and CLOSED locally.

Do NOT deploy that commit by itself.

Now prepare and execute the SECOND MISSION.

Before implementation, update the canonical scope file:

docs/product-quality/14-second-mission-scope.md

This file must become the single source of truth for the entire Second Mission.

Do NOT leave important scope only in chat.

==================================================
CLAUDE APPROVAL AND DATA-SAFETY RULE
==================================================

I APPROVE using Claude as Product / UX Design Lead for this mission.

You may send Claude ONLY:

- non-secret product/UX specifications
- relevant UI code snippets
- architecture / interaction descriptions
- synthetic Prodwise Demo content
- synthetic screenshots
- redacted examples

DO NOT send Claude:

- real AMAN initiative/business data
- production customer data
- passwords
- API keys
- auth/session secrets
- private credentials
- confidential emails/documents
- production database contents

If any material contains real AMAN data:

redact it
or
replace it with synthetic equivalents

before sending it to Claude.

Claude = Product / UX Design Lead.
Codex = Engineering / Implementation Lead.

==================================================
MISSION OBJECTIVE
==================================================

Complete the missing Prodwise core operating loop.

Target operating model:

Create Initiative
→ Complete Setup
→ Connect / Map Sources
→ AI Proposes Understanding
→ Human Confirms
→ Product Truth
→ Attention / Decision
→ Ownership / Action
→ Delivery / Dependencies
→ Weekly Review
→ Initiative History

This mission is NOT about adding random features.

The goal is to make Prodwise a coherent Product Intelligence operating system.

==================================================
ABSOLUTE UX/UI RULE
==================================================

UX/UI QUALITY IS NON-NEGOTIABLE.

Do NOT implement generic CRUD.

Do NOT create copied pages using the same:

- title
- white card
- table
- drawer
- form
- spacing
- component hierarchy

for every new capability.

If the UI looks:

- copied
- generic
- bolted-on
- developer-designed
- like an internal admin utility
- like a form collection
- visually disconnected from Prodwise

then the feature is NOT complete.

Passing tests does NOT mean UX is accepted.

For every major capability:

1. Research interaction patterns
2. Claude defines the UX contract
3. Freeze the contract
4. Codex implements it
5. Render actual UI
6. Capture screenshots
7. Claude reviews rendered UI
8. Fix major findings
9. Independent red-team reviews it
10. Fix Blocker / Major findings
11. Test
12. Then mark complete

Claude must review the RENDERED product, not only code/specs.

==================================================
P0 — 1. INITIATIVE SETUP & LIFECYCLE MANAGEMENT
==================================================

This is FIRST priority.

The current Initiative Creation / Setup UX is below the required quality bar.

It is too sparse and too developer-oriented.

The redesign must answer:

- What information is required?
- What is optional?
- What does “created” mean?
- Is the initiative ready for intelligence?
- What setup is missing?
- How are sources linked?
- How are Jira / Docs / Emails mapped?
- How does the user edit the initiative later?
- How is history preserved?
- How is the initiative archived?

==================================================
CREATION != COMPLETE
==================================================

Do NOT treat:

Fill a few fields
→ Save
→ Done

as a valid product model.

Prodwise must distinguish:

A. INITIATIVE CREATED

from

B. INITIATIVE READY FOR INTELLIGENCE

A user may create an initiative with minimum information.

But if critical setup is incomplete:

show:

Setup Incomplete

and guide the user through the remaining work.

==================================================
MINIMUM FIELDS TO CREATE
==================================================

Suggested minimum:

- Initiative Name
- Business Line
- Primary Owner
- Lifecycle Stage

Research may refine this.

Do NOT make everything mandatory.

Do NOT force users to enter low-quality data just to satisfy validation.

==================================================
READY FOR INTELLIGENCE MODEL
==================================================

Define setup readiness.

Recommended requirements:

- Initiative Name
- Business Line
- Primary Owner
- Lifecycle Stage
- Objective / Problem Statement
- Current Scope / Phase
- at least one linked Source
- at least one confirmed Knowledge / Fact
- Target Live:
  known OR explicitly Unknown
- Next Milestone:
  known OR explicitly Unknown

Important:

Unknown must be explicit.

Missing must NOT silently count as complete.

Example:

Setup incomplete
6 of 9 setup requirements completed

CTA:

Complete setup

==================================================
SETUP STATUS
==================================================

At minimum support:

- Setup Incomplete
- Ready for Intelligence
- Archived

Do NOT mix:

Lifecycle Stage

with:

Setup Readiness

Example:

Lifecycle Stage:
Delivery

Setup:
Incomplete

must be possible.

==================================================
CREATE INITIATIVE UX
==================================================

Do NOT build one giant vertical form.

Use progressive setup.

Suggested structure:

STEP 1 — BASICS

- Initiative Name
- Business Line
- Primary Owner
- Lifecycle Stage
- Objective / Problem Statement
- Current Scope / Phase

STEP 2 — DELIVERY CONTEXT

- Development Start if known
- Target Live if known
- Next Milestone
- milestone date

Unknown must be explicitly selectable.

STEP 3 — SOURCES

Connect evidence.

STEP 4 — REVIEW SETUP

Show:

- what is complete
- what remains
- what the next meaningful action is

Allow:

Save and continue later

Do NOT force full setup before the initiative record can exist.

==================================================
SOURCE MAPPING — REDESIGN REQUIRED
==================================================

Do NOT use primitive fields such as:

Jira URL
Google Docs URL
Email URL

Sources must be structured product objects.

Use:

Add Source

Then choose source type.

Source types:

- Jira
- Google Docs / Drive
- Email
- Meeting Notes
- Uploaded / Pasted Evidence
- Other URL / External Source

==================================================
SOURCE MODEL
==================================================

Each source should support structured metadata such as:

- Source Type
- Source Reference
- Display Name
- Initiative mapping
- Source Role
- Status
- Added By
- Added At
- Last Checked / Last Synced when applicable

Possible Source Roles:

- Requirements
- Delivery
- Decisions
- Risks
- Business Rules
- Research
- General Evidence
- Primary
- Supporting

Research and simplify where appropriate.

Do not create unnecessary taxonomy.

==================================================
JIRA MAPPING
==================================================

The UX should be mapping-oriented.

NOT:

paste one Jira URL.

Future-ready interaction:

Select:
Jira

Then:

- choose/identify workspace/project
- browse/search when connector exists
- multi-select one or more mapped items
- support:
  Epic
  Initiative
  Story
  Task
  supported work items
- optionally assign source role

Example:

Jira
Project: PAYMENTS

Mapped items:
✓ PAY-102 Merchant settlement
✓ PAY-118 Validation readiness
✓ PAY-131 Production rollout

Role:
Delivery

The data model must support multiple mapped records.

If there is no live Jira connector:

DO NOT fake one.

Use honest structured manual references / issue keys.

==================================================
GOOGLE DOCS / DRIVE MAPPING
==================================================

Same principle.

Do NOT use one Google Doc URL field.

Future-ready behavior:

- browse/search documents if connector exists
- multi-select documents
- map to initiative
- assign role when useful

Examples:

- BRD
- approved scope
- decision log
- meeting notes

Until connector exists:

support structured manual document references.

Do NOT fake Drive integration.

==================================================
EMAIL MAPPING
==================================================

Same structured model.

Future-ready behavior:

- select/search thread or message if connector exists
- multiple email references
- link to initiative
- assign context/role

Examples:

- business approval
- launch confirmation
- scope clarification
- stakeholder decision

Until connector exists:

use structured manual evidence/reference.

Do NOT fake mailbox access.

==================================================
MULTI-SOURCE / MANY-TO-MANY
==================================================

One initiative can have:

- multiple Jira items
- multiple Docs
- multiple email threads
- multiple meeting notes
- multiple evidence records

Do NOT assume:

1 Initiative = 1 Jira link = 1 Document

Support many-to-many mapping.

==================================================
SOURCE-CENTRIC + INITIATIVE-CENTRIC UX
==================================================

Support both directions.

INITIATIVE-CENTRIC:

Inside initiative:

- Add Source
- Link Jira work
- Attach document
- Add email evidence

SOURCE-CENTRIC:

Inside Sources:

- open source
- see which initiative(s) it supports
- map/unmap if authorized

Do not duplicate the same source unnecessarily.

Preserve provenance.

==================================================
EDIT INITIATIVE
==================================================

Add proper editing.

Authorized users must be able to edit:

BASICS

- Name
- Business Line
- Primary Owner
- Lifecycle Stage
- Objective / Problem
- Scope / Phase

DELIVERY

- Development Start
- Target Live
- Actual Live
- Next Milestone
- milestone planned date

SOURCES

- add
- unlink
- map more records
- modify role where safe

RELATIONSHIPS

when implemented:

- Part of
- Depends on
- Related to

STATUS

- Active
- Paused if supported
- Archived

Do NOT put everything into one giant Edit modal.

Claude must design the interaction model.

==================================================
EDITING MUST PRESERVE HISTORY
==================================================

Do not destroy canonical history.

Example:

If Target Live changes:

preserve:

- previous value
- new value
- changed by
- changed at
- rationale if available

If Owner changes:
preserve meaningful ownership history.

If Lifecycle Stage changes:
record meaningful timeline event.

If Source is unlinked:
do not erase historical evidence that already supported confirmed Product Truth without proper safeguards.

==================================================
ARCHIVE / DELETE
==================================================

Default lifecycle action:

Archive Initiative

Archive should preserve:

- evidence
- decisions
- history
- Weekly Review references
- Knowledge
- dependencies
- auditability

Hard delete must be heavily restricted.

Research whether hard delete is only allowed when there is no meaningful history.

If hard delete exists:

require:
- strong confirmation
- appropriate authority

Do NOT place casual Delete beside Save.

==================================================
SETUP INTEGRATION
==================================================

INITIATIVES REGISTER

Clearly distinguish:

- Ready
- Needs Attention
- Setup Incomplete
- Not Assessed

Do NOT show:

0 conflicts

as if the initiative is healthy when setup is incomplete.

HOME

Surface setup gaps only when meaningful.

Example:

Merchant Insights
Setup incomplete
Missing source and confirmed product context
Complete setup →

Do not create fake urgency.

BRIEF

Show:

- owner
- lifecycle stage
- current scope/phase
- delivery context
- setup status
- source coverage

Do NOT build a wall of metadata cards.

==================================================
POST-CREATION NEXT STEP
==================================================

After creation:

do NOT leave user at:

Saved successfully.

Use a guided next-step model:

Initiative Created
→ Add Sources
→ Review / Confirm Initial Knowledge
→ Ready for Intelligence

User must always understand:

What should I do next?

==================================================
P0 — 2. INITIATIVE OWNERSHIP
==================================================

Add a real ownership model.

Minimum:

Primary Owner

Optional only if genuinely useful:

Contributors / participating members

Do NOT build a complex team-management system.

Ownership must integrate with:

- Home
- Initiatives
- Brief
- Weekly Product Review
- Actions
- portfolio filtering
- attention routing

Ownership should answer:

Who is responsible for this initiative?

Do not hide ownership in random settings.

==================================================
P0 — 3. ACTIONS / COMMITMENTS
==================================================

Next Step text is not enough.

Create a first-class Action / Commitment model.

This is NOT Jira.

Actions track commitments emerging from Product Intelligence.

Minimum fields:

- Title
- Initiative
- Owner
- Due Date optional
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

HOME

Show useful attention such as:

- overdue commitment
- due soon
- blocked commitment

Do NOT turn Home into task management.

BRIEF

Show relevant current commitments in context.

WEEKLY REVIEW

A structured next step must not die as review text.

Example:

Finance to confirm settlement approach by Wednesday

should be able to become a canonical Action after explicit confirmation.

NEXT WEEKLY REVIEW

Open actions carry forward intelligently.

Completed actions appear as meaningful changes/history when useful.

==================================================
P0 — 4. ANCHORED AI EVIDENCE INGESTION
==================================================

This is a CORE Prodwise AI capability.

Do NOT reduce AI to summarization.

Initial input:

Paste evidence / text

Examples:

- meeting notes
- email excerpt
- BRD text
- stakeholder note
- product discussion
- document excerpt

Claude proposes structured records.

Possible proposal types:

- Requirement
- Decision
- Business Rule
- Risk
- Dependency
- Delivery Fact
- Action
- Open Question

Every proposal must be anchored to supporting evidence.

User actions:

- Show Evidence
- Confirm
- Reject
- Add My Own Entry

AI must NOT update Product Truth directly.

Required flow:

Evidence
→ AI Proposal
→ Human Confirmation
→ Canonical Product Record

Examples:

Requirement → Knowledge
Decision → Decisions
Target Live → Delivery
Action → Actions
Risk → Initiative Context

==================================================
AI TRUST RULES
==================================================

AI proposes.
Humans confirm.

No unconfirmed proposal becomes canonical truth.

Do not use vague confidence as substitute for evidence.

Show actual supporting evidence.

==================================================
VALUE EDIT SAFETY
==================================================

Preserve:

VALUE_EDIT_REQUIRES_NEW_ENTRY

Cosmetic normalization:
allowed.

Material value change:
do NOT mutate proposal silently.

Use:

Add My Own Entry

This creates:

HUMAN_ENTRY / DIRECT_KNOWLEDGE

Do not falsely attach original evidence to a materially different human value.

==================================================
P0 — 5. STAGE 2.3 QUEUE COMPLETENESS
==================================================

Implement:

OPEN
RESOLVED
DEFERRED
DISMISSED

Deferred and Dismissed are intentional human outcomes.

Do NOT treat them as generic Closed.

Preserve:

- invalidation semantics
- digest semantics
- re-emergence behavior
- immutable decision history

UX must clearly distinguish:

Resolved
Deferred
Dismissed

==================================================
P0 — 6. STAGE 2.4 MINIMUM CONTEXT
==================================================

Implement:

- Effective Date
- Controlled Initiative Phase / Context
- chronology where needed

Purpose:

avoid false conflicts across different phases/time contexts.

Example:

Phase 1 Target Live

must not automatically conflict with:

Phase 2 Target Live

Conflict comparison remains conservative.

Preserve:

same initiative
same normalized subject
same normalized attribute
compatible context
active claims
different normalized values
no supersession

==================================================
DIGEST REQUIREMENT
==================================================

Effective Date / Context must affect BOTH:

- TypeScript contentDigestOf
- SQL decision_hash

Do NOT update one side only.

Add regression tests.

==================================================
P1 — 7. MEETING INTELLIGENCE
==================================================

Build on top of Anchored AI Evidence.

Do NOT build a disconnected AI meeting summary app.

MVP:

Paste:

- meeting notes
or
- transcript

Claude proposes:

- Decisions
- Actions
- Risks
- Changed Requirements
- Delivery Date Changes
- Open Questions

Each proposal must show supporting evidence.

User confirms/rejects individually.

Confirmed items flow into canonical domains:

Decision → Decisions
Action → Actions
Risk → Initiative Context
Delivery Change → Delivery
Requirement → Knowledge
Open Question → unresolved context/attention

Meeting note/transcript remains a Source.

Do NOT create another data island.

==================================================
P1 — 8. INITIATIVE RELATIONSHIPS / DEPENDENCIES
==================================================

Add a lightweight relationship model.

Minimum:

PART_OF
DEPENDS_ON
RELATED_TO

BLOCKS may be derived as inverse of DEPENDS_ON where appropriate.

Relationship fields:

- From Initiative
- To Initiative
- Relationship Type
- rationale
- created by
- confirmed by
- confirmed at

AI may propose relationships.

Human confirmation required before they affect Product Truth.

Integrate into:

- Brief
- Roadmap
- Home attention
- future Portfolio Analysis

Do NOT build complex dependency management.

ROADMAP

Show meaningful dependency impact.

Example:

B depends on A.

If A moves beyond a relevant B milestone:

surface supported dependency risk.

Do NOT invent impact without evidence.

==================================================
P1 — 9. INITIATIVE HISTORY
==================================================

Add meaningful Initiative History.

Purpose:

What happened to this initiative over time?

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
- relationship confirmed

Do NOT expose raw technical audit logs as product history.

Do NOT add History as top-level global navigation.

Keep it within initiative context.

==================================================
P1 — 10. CANONICAL RISKS / OPEN QUESTIONS
==================================================

Do NOT build a giant standalone risk system.

But Risks and Open Questions must become structured product objects.

RISK minimum:

- Title
- Initiative
- Status
- Owner if known
- Mitigation / Next Action if recorded
- Source
- Updated At

OPEN QUESTION minimum:

- Question
- Initiative
- Owner / Expected Confirmer if known
- Status
- Source / Context
- Created At
- Resolved At

Integrate into:

- Home
- Brief
- Weekly Review
- Meeting Intelligence

Only create a dedicated register if research proves it is necessary.

==================================================
NAVIGATION RULE
==================================================

Do NOT create new global navigation items for:

- Actions
- Meetings
- Relationships
- Risks
- Questions

Use:

- initiative context
- progressive disclosure
- context rails
- drawers
- workbenches
- cross-links

Global navigation should remain focused.

==================================================
END-TO-END PRODUCT LOOP
==================================================

The final experience must connect:

Create Initiative
→ Complete Setup
→ Map Sources
→ AI Proposal
→ Human Confirmation
→ Product Truth
→ Decision / Attention
→ Owner / Action
→ Delivery / Dependency
→ Weekly Review
→ History

Nothing should become an isolated data island.

==================================================
DEMO INTEGRATION
==================================================

Extend Prodwise Demo only.

Do NOT fabricate AMAN data.

Demo must include enough examples to demonstrate:

- incomplete setup
- Ready for Intelligence
- initiative owners
- multiple linked sources
- Jira manual structured mapping
- Docs mapping
- Email reference
- open actions
- due-soon / overdue commitment
- AI evidence proposals
- confirmed proposal
- rejected proposal where useful
- meeting-derived decision
- meeting-derived action
- Deferred or Dismissed decision
- phase/context example
- dependency
- meaningful initiative history
- risk
- open question

All Demo data must be:

- synthetic
- coherent
- internally consistent
- isolated from AMAN

No disconnected hard-coded counts.

==================================================
RESPONSIVE DESIGN
==================================================

Test:

390
768
1024
1440+

Do NOT build desktop and stack it on mobile.

Mobile must be intentionally designed.

Pay particular attention to:

- Create Initiative
- progressive setup
- source mapping
- proposal review
- actions
- edit initiative
- history
- dependency interactions

No horizontal overflow.

==================================================
ACCESSIBILITY
==================================================

Validate:

- form grouping
- required field indication
- validation errors
- keyboard flow
- step navigation
- source multi-select accessibility
- dialogs
- archive confirmation
- focus restoration
- proposal review
- tables/lists
- timeline/history
- status not color-only
- contrast
- reduced motion

Fix blockers.

==================================================
PERFORMANCE
==================================================

Do not regress the accepted performance baseline.

Watch for:

- repeated session fetches
- repeated initiative fetches
- serial waterfalls
- oversized AI payloads
- route remounts
- large history payloads
- slow proposal rendering

Use progressive loading where appropriate.

Do not block entire pages while Claude processes evidence.

==================================================
END-TO-END TEST
==================================================

Test at least one full scenario:

1. Create initiative
2. Setup is incomplete
3. Complete required setup
4. Add/map sources
5. Paste evidence
6. Claude proposes structured understanding
7. Evidence is visible
8. Human confirms selected items
9. Knowledge updates
10. Decision/attention appears if relevant
11. Action is created if relevant
12. Owner is clear
13. Confirmed delivery change updates canonical delivery fact
14. Roadmap reflects confirmed fact
15. Dependency impact appears only if supported
16. Weekly Review sees the resulting delta
17. Human finalizes review
18. Next review uses it as baseline
19. Initiative History shows meaningful evolution

Verify:

- no duplicate truth
- no AI proposal changes truth without confirmation
- no false cross-phase conflicts
- Deferred/Dismissed semantics survive reevaluation
- Action carry-over works
- ownership works
- relationships stay org-scoped
- no cross-org leakage
- Demo stays coherent

==================================================
CLAUDE FINAL REVIEW
==================================================

Before completion:

Give Claude actual rendered screenshots.

Required review:

DESKTOP
- Create Initiative — Basics
- Create Initiative — Source Mapping
- Setup Incomplete
- Ready for Intelligence
- Edit Initiative
- Source Management
- Archive Confirmation
- Ownership
- Actions
- AI Proposal Review
- Meeting Intelligence
- Deferred/Dismissed states
- context/effective date UX
- dependencies
- history
- risks/open questions

MOBILE
- Create Initiative
- Setup State
- Edit Initiative
- Source Management
- AI Proposal Review
- Actions

Claude must explicitly evaluate:

- Does this feel coherent?
- Is the next action obvious?
- Is anything copy/pasted?
- Is anything generic CRUD?
- Does source mapping make sense?
- Is Created vs Ready clear?
- Is edit discoverable?
- Is mobile intentional?
- Does every action clearly explain what happens next?

If Claude returns REVISE:

fix major findings
and repeat review.

==================================================
INDEPENDENT RED TEAM
==================================================

Use a fresh independent reviewer after Claude approval.

Test as:

- Product Manager
- Product Lead
- first-time user
- Demo reviewer

Require them to complete the full workflow without instructions.

Fix all Blocker / Major findings.

==================================================
EXECUTION ORDER
==================================================

P0:

1. Initiative Setup & Lifecycle Management
2. Initiative Ownership
3. Actions / Commitments
4. Anchored AI Evidence Ingestion
5. Stage 2.3 Queue Completeness
6. Stage 2.4 Minimum Context

Then perform integration review.

P1:

7. Meeting Intelligence
8. Initiative Relationships / Dependencies
9. Initiative History
10. Canonical Risks / Open Questions

Do not move into broad external integrations.

==================================================
DO NOT ADD YET
==================================================

Do NOT expand into:

- full Jira connector
- Google Drive connector
- Gmail connector
- Slack connector
- Figma sync
- ClickUp sync
- notification center
- Market Intelligence
- Product Challenger
- standalone UAT Calendar
- complex resource planning
- generic task management
- broad RBAC redesign

These remain future scope unless explicitly requested later.

==================================================
CANONICAL SCOPE REQUIREMENT
==================================================

Before implementation:

write ALL of the above into:

docs/product-quality/14-second-mission-scope.md

Do NOT keep important requirements only in chat.

Update the P0/P1 order in the file.

Then continue directly into implementation.

Do NOT pause again merely to confirm the scope was saved.

Only pause if there is a genuine blocker requiring my action.

==================================================
FINAL PRE-DEPLOYMENT CHECKPOINT
==================================================

Do NOT deploy automatically.

When the full Second Mission is complete:

stop at a final pre-deployment checkpoint.

Report:

1. Implemented capabilities
2. Claude final UX verdict
3. Red-team verdict
4. Build result
5. Unit tests
6. DB/migration tests
7. Browser/E2E
8. Accessibility
9. Responsive
10. Performance vs accepted baseline
11. Demo consistency
12. Org isolation
13. AI safety / confirmation behavior
14. Exact candidate SHA
15. Working tree status
16. Migration status
17. Known remaining non-blocking issues
18. Whether candidate is ready for Production

Use one final verdict:

READY FOR PRODUCTION CHECKPOINT

READY WITH ONE MANUAL STEP

BLOCKED — exact blocker

Do NOT deploy until I approve the final checkpoint.

==================================================
FINAL PRINCIPLES
==================================================

Do not optimize for feature count.

Do not optimize for tests only.

Optimize for a coherent Product Intelligence operating system.

Creation is not completion.

Setup must be explicit.

Sources are structured evidence, not random URLs.

AI proposes.

Humans confirm.

Canonical facts preserve history.

Weekly Review is not a parallel database.

Actions are commitments, not Jira.

Meeting Intelligence feeds Product Truth.

Dependencies are evidence-backed.

History explains product evolution.

Unknown != Failed.

Missing != Zero.

No fabricated AMAN data.

No generic CRUD.

No copy/paste UI.

If the UI feels cheap or disconnected:

REWORK IT.

Now:

1. update the canonical Second Mission file
2. complete Claude UX planning
3. execute P0
4. execute P1
5. complete integration testing
6. run Claude final rendered review
7. run independent red-team
8. stop at final pre-deployment checkpoint

Do not pause again unless there is a genuine blocker requiring my action.
