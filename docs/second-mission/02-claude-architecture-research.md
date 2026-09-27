# Prodwise Second Mission: UX Contract, P0‑1 Setup & Lifecycle, plus Loop Architecture

**Author:** Claude, Product/UX Design Lead
**Engineering counterpart:** Codex
**Baseline:** `4623810d`
**Status:** Freeze candidate for P0‑1. Capabilities 2–10 are specified at contract level and are frozen per capability before each is implemented.

**Scope of this document**

- This is a specification. It is not a rendered review.
- No UI has been rendered or inspected. Nothing here claims completion.
- The comparable‑product patterns (Linear project overview, Linear initiatives, Jira Product Discovery delivery and insights) come from the research ledger that Codex supplied. I did not browse them independently.
- All examples are synthetic Prodwise Demo content.

---

## 0. Conflicts and source‑of‑truth risks found in existing code and direction

| # | Finding | Risk | Contract decision |
|---|---|---|---|
| C1 | `workspace/setup.ts` `deriveSetup()` computes evidence, record and confirmation coverage, and calls it "setup" (`mode: "setup" \| "operating"`, `complete`). | There would be two meanings of "setup complete". A user could see "complete" coverage while the new checklist says Incomplete. | Rename the UI concept to **Evidence coverage**. `deriveSetup` becomes an *input* to two readiness requirements (R7 source, R8 confirmed fact). It is never shown as a second setup status. The new pure function is `deriveReadiness()`. Both functions are pure and neither persists a completion flag. |
| C2 | Owner is a revisioned `OWNER` delivery fact, validated against active scoped membership and consumed by Home, Brief, filters and Weekly. | Adding `initiatives.owner_id` would create duplicate truth that drifts. | **The existing canonical `OWNER` fact is the only owner storage.** Create writes an initial `OWNER` fact revision in the same transaction as the initiative row. No owner column, no contributor table and no cached owner field on sources or actions. Actions have their own *action assignee* (§5); that is a different fact. |
| C3 | Create persists `knownReferences` as free text. | These look like sources but are not. | Show legacy references as **"Unmapped references (from creation)"** inside Sources, with a "Map as source" affordance. They never count toward R7. New creation no longer collects free‑text references. |
| C4 | No initiative update or archive contract exists. Stage has a guarded mutation `updateInitiativeStage({expectedUpdatedAt,…})`. | Adding a parallel stage writer would split authority. | Lifecycle Stage edits **reuse `lib/workspace/stage.ts`**. Other basics get one new guarded mutation per section (§1.8), all using the same `expectedUpdatedAt`/revision pattern. |
| C5 | Existing Knowledge has risk and dependency *claim types*. | A new Risk table would duplicate truth (P1‑10). | Decided in §10: structured risk and question status is a *record over* a confirmed claim, not a second statement of it. |
| C6 | Findings are OPEN/RESOLVED only. | Mapping Deferred to Resolved would corrupt history. | §6 adds distinct outcomes that participate in the digest. |
| C7 | Canonical writes cross repository boundaries. | A partial AI confirmation could appear successful. | Every multi‑record confirmation is one server transaction, or an idempotent command with a recoverable "Partially applied" state that is shown honestly. Never a client write sequence. |
| C8 | Stage authority is "org admin, platform authority, or assigned PM". | New writes might invent a different rule. | "Assigned PM" is interpreted as **the current canonical Primary Owner**. The same rule extends to metadata (§1.7). |
| C9 | Readiness depends on a *confirmed fact*, which requires evidence plus a human. | A user may expect that adding a Jira key makes the initiative "ready". | The copy states that a mapped reference is not evidence until its content is added and confirmed (§1.4 R8). |
| C10 | The scope's example says "6 of 9". Its requirement list has 10 items. | Inconsistent counts. | **Ten requirements**, listed in §1.3. The count is always derived from that list and never hard‑coded. |

---

## 1. P0‑1 Initiative Setup & Lifecycle (deepest detail)

### 1.1 Explicit MVP choices

- **No hard delete.** No delete control exists anywhere in the UI or API. Archive is the only removal path, and it is reversible by authorized roles.
- **Lifecycle status: Active | Archived.** "Paused" is out of MVP. It is not shown, not even disabled, to avoid a dead control.
- **Sources are manual structured references only.** There are no connectors, no browse or search of external systems and no "Sync" button. The status vocabulary never implies a connection.
- **Setup status is derived and never persisted.** The only persisted lifecycle field is `archivedAt/archivedBy/archiveReason`.
- **Unknown is a recorded human assertion** (who, when, optional note). An empty or never‑set value is *Missing*. Missing never satisfies a requirement.
- Creation is a server‑side record from Step 1 onward. Steps 2–4 edit an existing initiative, so "Save and continue later" is always true.

### 1.2 Status model (three orthogonal axes, never merged into one badge)

| Axis | Values | Source |
|---|---|---|
| Lifecycle Stage | Existing stage enum (e.g. Discovery, Definition, Delivery, Live) | Existing stage mutation |
| Setup status | `Setup incomplete` (n of 10) · `Ready for intelligence` · *(hidden when archived)* | `deriveReadiness()` |
| Record status | `Active` · `Archived` | Persisted archive fields |

**Display rule.** When the record is Archived, the setup chip is replaced by `Archived · 12 Oct 2026`. Readiness is still computable and shown in Manage as "Setup at archive: 8 of 10", but it never generates attention.

**Attention axis.** The existing Needs Attention signal is independent. The Register column shows the combined operational label using this precedence:

1. Archived (only in the Archived filter)
2. Setup incomplete
3. Needs attention
4. Ready
5. Not assessed

"Not assessed" means the initiative is Ready but the checks have not yet run. It never shows "0 conflicts" or a neutral dash as though the initiative were healthy. When an initiative is Setup incomplete, the attention cell reads "Checks paused until setup is complete". It does not read "0".

### 1.3 Readiness requirements (the checklist)

| ID | Requirement | Satisfied when | Can be "Unknown"? |
|---|---|---|---|
| R1 | Initiative name | Non‑empty (always true after create) | No |
| R2 | Business line | Set (always true after create) | No |
| R3 | Primary owner | Current `OWNER` fact points to an **active scoped member** | No. A deactivated owner makes R3 unmet ("Owner no longer active") |
| R4 | Lifecycle stage | Set (always true after create) | No |
| R5 | Objective / problem | ≥ 20 chars of trimmed text | No |
| R6 | Current scope / phase | Phase label chosen from controlled list, plus optional scope note | No |
| R7 | Linked source | ≥ 1 **active** initiative–source mapping | No |
| R8 | Confirmed product fact | ≥ 1 `ACTIVE` claim on this initiative (from `deriveSetup.facts.confirmed`) | No |
| R9 | Target Live | Delivery fact has a date **or** explicit Unknown | Yes |
| R10 | Next milestone | Name plus (date **or** explicit Unknown date), **or** milestone explicitly Unknown | Yes |

**Behaviour rules**

- Ready requires all ten.
- Readiness can **regress**. If a source is unlinked, the owner is deactivated or the last claim is superseded, the status returns to Setup incomplete.
- **Stale‑state rule.** If the initiative was previously Ready, the chip becomes `Setup incomplete · was ready`. The checklist row names the cause, e.g. "Primary owner Sam Ortiz is no longer an active member. Assign an owner." This is derived by comparing against the latest `readiness_reached` history event. No flag is stored.

### 1.4 Create Initiative: progressive setup

**Route:** `/initiatives/new`. This is Step 1 only. Submitting it creates the record and routes to `/initiatives/[slug]/setup?step=delivery`.

**Creation minimum (all required, all enforced server‑side)**

- Name
- Business line
- Primary owner (member picker; defaults to the creator if the creator is an active non‑viewer member, and remains visible and changeable)
- Lifecycle stage (no default; the user must choose)

**Optional in Step 1:** Objective / problem, Current scope / phase.

**Stepper**

```
Basics · Delivery context · Sources · Review
```

- It is an ordered list (`<ol>`, `aria-current="step"`).
- After Step 1, any step is directly navigable because the initiative exists.
- Each step saves independently.

**Desktop 1440 (content column 720, context rail 320, inside existing shell gutter x≈288)**

```
Initiatives / New initiative
Create an initiative                                   
You only need four things to create it. Setup continues afterward.
[1 Basics ●]──[2 Delivery context]──[3 Sources]──[4 Review]
┌ Basics ─────────────────────────────────┐ ┌ What "created" means ──────┐
│ Initiative name *        [____________] │ │ The initiative exists and   │
│ Business line *          [Select…   ▾]  │ │ appears in Initiatives as   │
│ Primary owner *          [You (Demo…)▾] │ │ Setup incomplete.           │
│   Responsible for this initiative.      │ │ Prodwise starts checking it │
│ Lifecycle stage *        (○Discovery    │ │ once setup is complete —    │
│   ○Definition ○Delivery ○Live)          │ │ 10 requirements, shown on   │
│ ─ Optional now, needed for readiness ─  │ │ the next steps.             │
│ Objective / problem      [textarea   ]  │ └─────────────────────────────┘
│ Current scope / phase    [Phase 1 ▾] [note]                             │
└─────────────────────────────────────────┘
[Create initiative]   Cancel
```

**Tablet 768.** The rail collapses into a one‑line note under the title ("Creating adds it as Setup incomplete. You'll finish setup next."). The stepper shows all four labels.

**Mobile 390**

```
← Initiatives
Create an initiative
Step 1 of 4 · Basics
[name]
[business line]
[owner]
Stage  (radio list, full-width 44px rows)
▸ Optional now: objective, scope     (disclosure, collapsed)
┌ sticky bottom bar ─────────────────┐
│ [Create initiative]                │
└────────────────────────────────────┘
```

The stepper appears as "Step n of 4 · Name" text with a Steps disclosure. It does not shrink into a horizontal bar.

**Copy**

- Required marker: "*" plus the visually hidden text "required". The legend reads "* Required to create".
- Owner hint: "Responsible for this initiative. Shown on Home, Weekly Review and Actions."
- Errors appear inline and in a summary (`role="alert"`, with focus moved to the summary):
  - "Choose a lifecycle stage."
  - "An initiative named ‘Merchant Insights’ already exists in Prodwise Demo." The message links to it.
  - "Sam Ortiz can't be owner: not an active member of this organization."
- Button pending text: "Creating…". The command is idempotent via a `clientRequestId` hidden field, so a double submit returns the same initiative.

**Post‑create landing (Step 2, with a one‑time banner)**

> **Merchant Insights was created.** It's listed as **Setup incomplete · 4 of 10**. Next: add delivery context, then map sources.

The banner uses `role="status"`. Focus moves to the Step 2 heading.

**Step 2: Delivery context**

Each field is a tri‑state segmented control: `Date known` · `Unknown` · (unset). Unset is shown as "Not recorded".

```
Target Live       ( Date known | Unknown )   [date]   Note (optional)
Development start ( Date known | Unknown )   [date]           (not required)
Next milestone    [name]  ( Date known | Unknown ) [date]
                  or [ ] No milestone is known yet — record as Unknown
Actual Live       (shown only when stage = Live)
```

- Copy under the controls: "Choosing **Unknown** records that nobody knows yet. It's different from leaving it blank. Blank counts as missing."
- Actions: **[Save delivery context]** · "Save and continue later" (text link, returns to the Brief) · "Skip to Sources →".
- Each save writes delivery fact revisions through existing delivery‑fact authority with `expectedRevision`.

**Step 3: Sources.** See §1.5.

**Step 4: Review setup.** This page is also the persistent resume target, `/initiatives/[slug]/setup`.

```
Setup · Merchant Insights                 Setup incomplete · 7 of 10
Created 3 Oct 2026 by Demo Reviewer · Delivery stage
┌ Next meaningful action ───────────────────────────────────────────┐
│ Add evidence content and confirm your first product fact.         │
│ Mapped references aren't evidence until their content is added.   │
│ [Add evidence from a source]                                       │
└───────────────────────────────────────────────────────────────────┘
Done (7)   ✓ Name ✓ Business line ✓ Owner: Demo Reviewer ✓ Stage: Delivery
           ✓ Objective ✓ Scope: Phase 1 ✓ Source: 1 Jira project, 3 items
Remaining (3)
   ○ Confirmed product fact — none yet            [Add evidence]
   ○ Target Live — not recorded                    [Set or mark Unknown]
   ◐ Next milestone — named, date not recorded     [Finish]
```

**Checklist semantics**

- Remaining items come first on mobile and "Done" is collapsed.
- Status is shown by icon plus text; colour is never the only signal.
- The "Next meaningful action" card uses this fixed priority order: owner inactive → objective → scope → source → target/milestone → confirmed fact.
- When all ten are met, the card becomes:

  > **Ready for intelligence.** Prodwise now checks this initiative for conflicts and changes. Checks start with the next evaluation. [Open Brief]

### 1.5 Source mapping (manual, structured)

**Data invariants**

| Object | Contents |
|---|---|
| `Source` (org‑scoped) | type ∈ {JIRA, DOCUMENT, EMAIL, MEETING_NOTES, PASTED_EVIDENCE, OTHER_URL}; container reference (Jira project key / document title / thread subject); display name; addedBy/At |
| `SourceItem` | reference (issue key / doc URL or title / message ID or date+subject); item kind (Epic, Initiative, Story, Task, Other for Jira); optional URL |
| `InitiativeSourceLink` (many‑to‑many) | initiativeId; sourceItemId; role; linkedBy/At; unlinkedBy/At/reason; `revision` |

- **Roles (simplified):** Requirements · Delivery · Decisions · General evidence. Default is General evidence. "Primary/Supporting" is dropped as redundant.
- **Status vocabulary (honest):** `Manual reference` (no content in Prodwise) · `Evidence added` (≥1 EvidenceRecord captured from it). There is **no** "Synced", "Connected" or "Last checked". "Last checked" is omitted because no check is performed.
- **Dedupe.** `(org, type, normalized reference)` is unique. Adding an existing reference offers "Already in Sources: PAY‑102 — link it to this initiative". No duplicate is created.
- An unlink sets `unlinkedAt`. It never deletes the source, items or evidence.

**Add Source flow**

This is a side drawer on desktop and 768, and a full‑screen sheet on 390.

1. **Choose type.** Six large option rows, each with a one‑line description:
   - "Jira — map epics, stories or tasks by key"
   - "Document — BRD, scope, decision log"
   - "Email — approvals, confirmations"
   - "Meeting notes"
   - "Pasted evidence"
   - "Other link"

   A persistent line appears under the heading: "Prodwise doesn't connect to Jira, Drive or email yet. You're recording references by hand."

2. **Identify container** (Jira: Project key `PAYMENTS`; Document: title plus optional link; Email: thread subject plus sender plus date).

3. **Map items.**
   - Jira uses a multi‑line key entry ("PAY‑102, PAY‑118"). Keys are parsed into a token list, and each token gets a kind select and a title field.
   - The list is a `role="list"` of removable rows with labelled remove buttons ("Remove PAY‑118").
   - Keys are validated against the project prefix. The copy is "PAY‑9X isn't a valid key for PAYMENTS". It never says "not found", because nothing is looked up.

4. **Role**, which applies to all items and can be changed per item later.

5. **[Link 3 items to Merchant Insights].**

Result toast: "Linked 3 Jira items. Source requirement met (7 of 10). To use them as evidence, add their content." Plus the action [Add evidence].

**Sources on the initiative (Manage › Sources and Setup Step 3)**

Sources are grouped by type, and each group is a compact list:

```
Jira · PAYMENTS                         Delivery      Manual reference
  PAY-102 Merchant settlement (Epic)
  PAY-118 Validation readiness (Story)                [Change role] [Unlink]
Document · Merchant Insights BRD v1     Requirements  Evidence added · 2 facts
```

**Source‑centric view.** This lives in the existing Sources library (both URL forms) as `/sources/[id]`. It shows:

- the header
- items
- "Supports: Merchant Insights (Delivery), Instant Settlement Payout (Delivery)"
- evidence records captured from the source
- [Link to another initiative] (authorized only)

**Unlink safeguard.** A dialog appears whenever the link has anchored evidence:

> **Unlink BRD v1 from Merchant Insights?**
> 2 confirmed facts cite evidence from this source. They stay confirmed and keep their evidence; the source just stops being listed for this initiative. If this was the only linked source, setup returns to **incomplete (9 of 10)**.
> Reason (required) [____]
> [Unlink source]  Keep linked

Role change is allowed only when it does not alter any claim. Roles are descriptive only, so a role change is always safe.

### 1.6 Manage Initiative: discoverability and edit model

**Entry point.** A visible outlined button, **"Manage initiative"** (gear icon plus text), sits in the initiative header on every initiative tab, to the right of the title. On mobile it appears as a labelled "Manage" button in the header row. It is not hidden in a kebab menu.

- For Viewers the label reads "Initiative details" and opens a read‑only view.
- A Setup incomplete chip is itself a link to `/setup`.

**Route:** `/initiatives/[slug]/manage`. The section anchors are:

```
Basics · Ownership · Delivery · Sources · Relationships (P1) · Lifecycle
```

Desktop layout: a left section index (sticky, 200px) and a right column of section panels. Each panel is **read‑mode by default** with one "Edit" button. Editing is per section, one section at a time, and is never a giant modal. Each section has its own Save and Cancel and its own concurrency token.

```
Manage · Merchant Insights                     Setup incomplete · 8 of 10 →
┌ index ──┐ ┌ Basics ─────────────────────────────── [Edit] ┐
│ Basics  │ │ Name        Merchant Insights                  │
│ Owner   │ │ Business    Merchant Services                  │
│ Delivery│ │ Stage       Delivery  (changed 1 Oct by D.R.)  │
│ Sources │ │ Objective   Give merchants daily settlement…   │
│ Lifecyc.│ │ Scope       Phase 1 — Card settlement only     │
└─────────┘ └────────────────────────────────────────────────┘
            ┌ Ownership ─ Primary owner Demo Reviewer [Change owner] ┐
            ┌ Delivery ─ Target Live 15 Oct 2026 · Next: UAT signoff… [Edit] ┐
            ┌ Sources ─ 2 sources, 4 items [Add source] ┐
            ┌ Lifecycle ─ Active  [Archive initiative…] (outlined, red text) ┐
```

**Rules for material edits**

- **Stage, Target Live, Owner and Scope** require an **optional rationale** field. It is required for an Owner change and for a Target Live change when a previous date existed.
- Before any Target Live save, a consequence line is shown: "Target Live 15 Oct → 22 Oct 2026 (+7 days). Previous value is kept in history and appears in Weekly Review."
- The **name change** keeps the slug stable. Old links keep working, and history shows "Renamed from …".

**Mobile.** The section index becomes a "Sections (6)" disclosure. Each panel is full width, and Edit opens the section in place with a sticky Save/Cancel bar. No horizontal tables.

### 1.7 Per‑write RBAC matrix (existing roles, server‑enforced)

"Owner" in the table below means the current canonical Primary Owner, who must be a MEMBER or above.

| Write | PLATFORM_OWNER | ORG_OWNER | ADMIN | MEMBER | VIEWER |
|---|---|---|---|---|---|
| Create initiative | ✓ | ✓ | ✓ | ✓ | ✗ |
| Edit basics (name, business line, objective, scope) | ✓ | ✓ | ✓ | Owner only | ✗ |
| Change lifecycle stage (existing stage.ts) | ✓ | ✓ | ✓ | Owner only | ✗ |
| Assign/change Primary Owner | ✓ | ✓ | ✓ | Owner only (hand‑off) | ✗ |
| Edit delivery facts / mark Unknown | ✓ | ✓ | ✓ | Owner only | ✗ |
| Add source / link / change role | ✓ | ✓ | ✓ | ✓ (any member) | ✗ |
| Unlink source | ✓ | ✓ | ✓ | Owner or the linker | ✗ |
| Archive / restore | ✓ | ✓ | ✓ | ✗ | ✗ |
| Create action | ✓ | ✓ | ✓ | ✓ | ✗ |
| Update/complete action | ✓ | ✓ | ✓ | Assignee, initiative Owner or creator | ✗ |
| Confirm/reject AI proposal | ✓ | ✓ | ✓ | ✓, but delivery/owner proposals only if they would pass the delivery row | ✗ |
| Defer/dismiss/resolve decision | ✓ | ✓ | ✓ | Existing decision authority; Product Lead unchanged | ✗ |
| Confirm dependency | ✓ | ✓ | ✓ | Owner of the *dependent* initiative | ✗ |
| Resolve risk/open question | ✓ | ✓ | ✓ | Owner, question confirmer or risk owner | ✗ |

**Enforcement and display rules**

- Guest Demo sessions follow existing Demo guards, meaning business operations are allowed.
- Each check is performed with fresh, non‑cached access in the mutation.
- In the UI, unauthorized controls are **replaced by a reason**, e.g. "Only the owner or an admin can change the owner." The control is not silently hidden.
- A server denial returns: "You don't have permission to do this in Prodwise Demo. Nothing was changed."

### 1.8 Concurrency, idempotency and history

**Initiative basics.** `initiatives.updated_at` is used as `expectedUpdatedAt`, matching stage.ts. Delivery and owner facts use a fact `expectedRevision`. Source links use a link `revision`. Every create and link command uses a `clientRequestId`, with a unique `(org, requestId)` constraint, so a replayed command returns the original result.

**Conflict UI** (deterministic; the user's input is never lost):

> **Target Live changed while you were editing.** Alex Kim set it to **29 Oct 2026** at 14:02 (was 15 Oct). Your value **22 Oct 2026** was not saved.
> [Use my value — replace 29 Oct] [Keep 29 Oct] 

"Use my value" resubmits with the new token and records both revisions.

**History events** (written in the same transaction; product wording, not audit rows):

- created
- renamed
- business line changed
- stage changed (from→to, by, rationale)
- owner changed
- objective/scope changed (scope change shows from→to)
- delivery fact set / changed / marked Unknown
- source linked / unlinked (with reason)
- readiness reached / readiness lost (derived at write time from before/after readiness)
- archived / restored

### 1.9 Archive safeguards

**Archive dialog** (`role="alertdialog"`, focus on the heading, focus returns to the Lifecycle panel on close):

> **Archive Merchant Insights?**
> Archiving keeps everything: 6 sources, 14 confirmed facts, 3 decisions, 2 Weekly Review Finals and all history. Finals are never changed.
> What changes:
> • It leaves Home attention, the active Initiatives list and future Weekly Review drafts.
> • 2 open actions stay open but read‑only until restored. 
> • 1 initiative depends on it: Merchant Flex Finance. That dependency will show "depends on an archived initiative."
> Reason (required) [____]
> Type the initiative name to confirm [____]
> [Archive initiative] (destructive style)  Keep active

**Archived state**

- The initiative remains fully readable.
- A top banner reads: "Archived 12 Oct 2026 by Alex Kim — ‘Merged into Merchant Flex Finance.’" followed by [Restore] for authorized roles.
- All edit controls are replaced by "Archived — restore to edit".
- It appears in the Register "Archived" filter.
- It is reachable in search with an "Archived" tag.
- **Restore** uses a single confirm with a reason. Readiness is recomputed, and it rejoins the next Weekly Review draft.

### 1.10 Integration surfaces

- **Register.** The Setup column shows the label from §1.2 precedence. Incomplete rows show "Setup incomplete · 7/10". Filters: Ready · Needs attention · Setup incomplete · Not assessed · Archived.
- **Home.** A setup gap appears only when (a) the viewer is the Owner, or an admin viewing their own portfolio, and (b) the initiative is ≥ 2 days old or has an upcoming Target Live. It is a single calm row, not attention‑orange:

  > Merchant Insights · Setup incomplete · Missing confirmed product fact and Target Live · Complete setup →

  At most three rows appear, then "and 2 more in Initiatives".
- **Brief header** is one identity band, not a wall of cards:

  ```
  Merchant Insights   Owner Demo Reviewer · Delivery · Phase 1 · Target Live 15 Oct 2026 · Next UAT signoff 8 Oct
  Setup incomplete 8/10 → · Sources 2 (4 items, 1 with evidence)     [Manage initiative]
  ```

### 1.11 Acceptance criteria: Setup & Lifecycle

- **S1.** A MEMBER creates "Merchant Insights" with the four minimum fields only. The record exists, the Register shows "Setup incomplete · 4/10", attention reads "Checks paused until setup is complete", and there is **no** "0 conflicts".
- **S2.** An `OWNER` fact revision 1 exists for the chosen owner. The `initiatives` table has no owner column.
- **S3.** Target Live left blank means R9 is unmet. Marking it Unknown means R9 is met, and history shows "Target Live marked Unknown by …".
- **S4.** Linking the Jira keys PAY‑102 and PAY‑118 under PAYMENTS creates 1 Source, 2 Items and 2 Links. R7 is met and R8 remains unmet. Adding PAY‑102 again from another initiative reuses the item.
- **S5.** Adding evidence content from the BRD and confirming one claim meets R8. With all ten met, the status is Ready, and a `readiness reached` event is recorded.
- **S6.** Unlinking the only source shows the dialog with its claim count. After unlink, the claims are still ACTIVE, the status is "Setup incomplete · was ready" and the cause names the source requirement.
- **S7.** A VIEWER sees "Initiative details" with reasons in place of controls. A crafted POST to edit returns a denial and nothing changes.
- **S8.** Two tabs edit Target Live. The second save gets the conflict panel with both values, and no silent overwrite occurs.
- **S9.** A double‑click on Create yields exactly one initiative.
- **S10.** An ADMIN archives with name and reason. It leaves Home and the active Register, Finals are byte‑identical, the dependent initiative shows the archived‑dependency note, and Restore reinstates it.
- **S11.** No delete endpoint or control exists.
- **S12.** At 390px there is no horizontal overflow, the stepper renders as "Step n of 4", and the sticky action bar does not cover focused inputs.
- **S13.** Keyboard only: complete Create → Delivery → Source (drawer focus is trapped and restored) → Review.
- **S14.** Axe reports zero violations. Every status is conveyed by text as well as colour.

---

## 2. Cross‑capability interaction architecture (10‑capability loop)

**Global navigation is unchanged.** No new global items are added. All new objects live in **initiative context**, with each capability placed as follows:

| Loop step | Home in the product | Canonical store |
|---|---|---|
| Create/Setup | `/initiatives/new`, `/[slug]/setup`, Manage | initiatives + facts |
| Sources | Manage › Sources; existing Sources library | Source/Item/Link |
| AI proposes | "Add evidence" workbench `/[slug]/evidence/new` | Proposal (non‑canonical) |
| Human confirms | Same workbench, proposal list | Writes to the target domain |
| Truth | Knowledge, Delivery facts | Existing |
| Attention/Decision | Decisions (Deferred/Dismissed lanes) | Findings |
| Ownership/Action | Brief "Commitments" rail; Weekly | OWNER fact; Action |
| Delivery/Dependencies | Brief, Roadmap | Delivery facts; Relationship |
| Weekly Review | Existing Weekly | Snapshots |
| History | Initiative tab "History" (inside the initiative tab set) | Event projection |

**Contextual search and cross‑navigation**

The existing search indexes these additional objects, org‑scoped and with archived items tagged:

- initiatives, sources and items by reference key (e.g. "PAY‑118")
- actions by title
- decisions by subject

Every object shows breadcrumbs back to its initiative plus these links:

- Source ↔ Initiatives it supports ↔ facts citing it
- Proposal → created record → Source excerpt
- Action → origin (Weekly Final, meeting note, decision) and back
- Decision → Actions created from it
- Weekly Final entry → the History event
- History event → the object

**No dead ends:** every object detail links to at least its initiative and its origin.

**Cross‑loop invariants**

1. No proposal writes truth without an explicit per‑item Confirm.
2. Weekly commentary never writes facts.
3. Finals are immutable snapshots.
4. Adding fields to snapshots does not re‑hash existing Finals; the `schemaVersion` digest is gated.
5. Effective context changes both `contentDigestOf` and SQL `decision_hash`, with parity tests.
6. Unknown ≠ failed; Missing ≠ 0 in every count ("—, not recorded").
7. Everything is org‑scoped, with no cross‑org reads.

---

## 3. P0‑2 Ownership

- **Placement.** The Manage › Ownership panel, the Brief band, Register, Home and Weekly all read the same `OWNER` fact.
- **Primary task.** "Who is responsible?" Change owner with a rationale.
- **Change owner** is an inline panel: a member picker (active scoped members only; Viewers are excluded with the note "Viewers can't own initiatives"), a required reason, and the consequence line: "Home attention and new actions without an assignee route to Taylor Morgan. Past history keeps Demo Reviewer."
- **Contributors are out of MVP.** They are not needed for routing.
- **States**
  - Unassigned: "No owner — attention goes to admins". R3 is unmet.
  - Inactive owner: stale warning, per §1.3.
  - Conflict: owner changed concurrently, handled per §1.8.
- **Mobile.** Single‑column picker sheet.
- **Downstream effects.** Portfolio filter "Owner: me" and Weekly index grouping (already existing) update from the new revision on the next read.
- **Acceptance.** Change the owner of Merchant Flex Finance to Taylor. Home for Taylor lists its attention, the Weekly index groups it under TAYLOR MORGAN in the next Draft, the W38 Final still shows the prior owner, and history shows the change with its reason.

## 4. P0‑3 Actions / Commitments

- **Placement.** The Brief right rail "Commitments (3 open)", a full list at `/[slug]/actions` (initiative tab) and Weekly "Next steps". There is no global list. Home shows only overdue, due‑soon (≤ 3 days) and blocked items, each capped at 3.
- **Fields.** As specified in the scope. **Assignee** defaults to the initiative owner. Status: Open · In progress · Done · Cancelled (cancel requires a reason). Origin plus an origin link. Optional evidence link.
- **Composition.** Rows show: title · assignee · due (relative plus absolute: "Due Wed 8 Oct · in 2 days") · status control · origin chip ("From W40 review"). Completing an action asks for an optional note and does not ask for confirmation. Status changes carry `expectedRevision`.
- **Not Jira.** There are no priorities, boards or subtasks. Copy under the add field: "Commitments from reviews, meetings and decisions — not delivery tickets."
- **States**
  - Empty: "No open commitments. Commitments you confirm from reviews or evidence appear here."
  - Overdue uses text and an icon: "Overdue 2 days".
  - Archived initiative: read‑only.
  - No due date: "No due date" (neutral, not overdue).
- **Mobile.** Rows become stacked cards. A status bottom sheet offers the four options with 44px targets.
- **Weekly integration.** Draft "Next steps" lines get "Make commitment". A preview shows title, assignee and due date, and **Confirm** creates an Action with origin = that Weekly review. The next Draft shows "Carried forward: 2 open" and "Completed since W40: 1" as changes.
- **Acceptance.** In W40, "Finance to confirm settlement approach by Wednesday" becomes an Action (assignee Finance lead, due 8 Oct). It appears on the Brief rail and on Home as due soon on 6 Oct. It is marked Done on 7 Oct. The W41 Draft lists it under completed changes, and the W40 Final is unchanged.

## 5. P0‑4 Anchored AI Evidence Ingestion

- **Placement.** Workbench `/[slug]/evidence/new`, reached from Setup "Add evidence", the Source detail and the Brief.
- **Desktop composition** (a two‑pane layout that is distinct from forms):
  - **Left:** the evidence text, read‑only after submit, with highlighted spans.
  - **Right:** the proposal list.
- **Mobile.** Tabs "Evidence | Proposals (7)". "Show evidence" jumps to the span and scrolls it into view with focus.
- **Input.** Choose the source (a linked source item or "New pasted evidence", which creates a PASTED_EVIDENCE source) → paste → **[Propose records]**.
- **Processing is non‑blocking.** The status reads "Reading evidence… you can leave; proposals will wait here." Payloads have a size cap, with the copy "Up to 20,000 characters per submission".
- **Proposal card**
  - type chip (Requirement / Decision / Business rule / Risk / Dependency / Delivery fact / Action / Open question)
  - proposed statement
  - destination line: "Confirming adds to Knowledge" / "…updates Target Live 15 Oct → 22 Oct 2026"
  - **quoted excerpt** with its character anchor
  - buttons: Show evidence · **Confirm** · Reject (optional reason) · Add my own entry

  No confidence scores are shown.
- **Value safety.** Only cosmetic edits (whitespace, case, date format) are allowed inline. A material change triggers "This changes the meaning. Use **Add my own entry** — it will be recorded as your entry, not linked to this evidence." Add my own entry creates HUMAN_ENTRY / DIRECT_KNOWLEDGE with no anchor.
- **Confirm** is one idempotent server command per proposal (and for "Confirm selected (3)"). The result lists each outcome: "3 confirmed · 1 failed: Target Live changed since proposal — review." A partial result is never labelled success. Delivery proposals use fact revisions, so a stale proposal becomes "Outdated: current value is 29 Oct".
- **States**
  - Empty: "No records proposed. Nothing was added."
  - AI error: "Couldn't read this evidence. Your text is saved; try again."
  - Viewer: read‑only.
  - Unanchorable proposals are dropped server‑side.
- **Downstream effects.** Knowledge, Decisions, Delivery, Actions and Risk context. The source status becomes "Evidence added". R8 can be met.
- **Acceptance.** Paste synthetic BRD notes and receive 5 proposals, each with a visible excerpt. Confirm 3, reject 1, and use Add my own entry for 1 with a changed date. Knowledge +2, Target Live revision +1 with an evidence link, the human entry has no anchor, and the rejected proposal is absent from truth.

## 6. P0‑5 Queue completeness

- **Placement.** Existing Decisions lanes, extended to: Open · Deferred · Dismissed · Resolved · History.
- **Actions** in the decision panel keep the existing hierarchy (Make a decision stays primary). The secondary outlined options are:
  - **Defer until…** (date or next review, plus a reason). Copy: "Stays on record; returns to Open on the date or if the evidence changes."
  - **Dismiss** (reason required). Copy: "Recorded as not a real conflict for these claims. Returns only if the claims change."
- **Semantics.** Outcome, reason and actor are stored as immutable decision history. The digest includes the outcome. Re‑emergence happens only when the underlying claim digest changes, and the reopened card reads "Reopened: evidence changed since dismissal on 3 Oct". Deferred items return at the date.
- **Distinction.** Each outcome has its own chip and icon: Resolved ✓, Deferred ⏸ with date, Dismissed ⊘. None of them is labelled "Closed".
- **Mobile.** Lane tabs with an edge fade. Actions appear in a sticky panel.
- **Acceptance.** Dismiss the Merchant Pricing conflict, rerun evaluation with identical claims, and it stays Dismissed. Edit one claim value and it reopens with the reason. Defer another to 10 Oct and it reappears as Open on 10 Oct.

## 7. P0‑6 Minimum context

- **Placement.** An optional "Applies to" row on the claim, fact and proposal confirm: Phase (from the initiative's controlled phase list) plus Effective date.
- **Default.** The initiative's current phase is pre‑filled and visible, never hidden.
- **Conflict comparison** stays conservative. Claims whose phases are both set and different do not conflict. A missing phase is compatible with anything, and the claim is flagged "Phase not recorded" rather than suppressed.
- **Digest.** Context fields enter both the TypeScript `contentDigestOf` and the SQL `decision_hash`, with parity tests. Legacy Finals are not re‑hashed.
- **UI.** A chip on claims ("Phase 2 · from 1 Jan 2027"). The Roadmap shows phase‑labelled Target Live markers.
- **Acceptance.** Phase 1 Target Live 15 Oct and Phase 2 Target Live 31 Mar produce no conflict. Two Phase 1 values produce a conflict.

## 8. P1‑7 Meeting Intelligence

This is not a separate app. It is the evidence workbench with source type Meeting notes and extra fields (meeting date, attendees as free text). Proposal types emphasise Decisions, Actions, Risks, Requirement changes, Delivery changes and Open questions. The transcript remains a Source, so there is no data island.

- **Mobile.** Same tabs as §5.
- **Acceptance.** A synthetic 6 Oct steering note yields a decision "Card‑only Phase 1" (confirmed into Decisions with origin = meeting) and an action "Ops to draft rollout comms" (confirmed into Actions). Both link back to the note's excerpt.

## 9. P1‑8 Relationships / dependencies

- **Placement.** Manage › Relationships, the Brief band ("Depends on Instant Settlement Payout") and Roadmap.
- **Model.** PART_OF, DEPENDS_ON and RELATED_TO. BLOCKS is derived as the inverse of DEPENDS_ON. Required fields: rationale and a confirmer. AI‑proposed relationships go through §5.
- **Impact** is shown only when both dates exist and A's Target Live is later than B's next milestone. The copy is: "Instant Settlement Payout Target Live (29 Oct) is after this initiative's UAT signoff (22 Oct)." Unknown dates produce "Impact not assessed — Target Live Unknown", never a risk.
- **Same‑org only.** Archived targets are labelled.
- **Mobile.** Relationships render as a list rather than a graph.
- **Acceptance.** Confirm Merchant Insights DEPENDS_ON Instant Settlement Payout, then move Payout to 29 Oct. The Roadmap and Home show one supported impact line. With Payout Unknown, no risk line appears.

## 10. P1‑9 History and P1‑10 Risks / Open questions

**History**

- It is an initiative tab: a vertical timeline grouped by week, with a filter (Delivery · Decisions · Setup · Actions · Reviews).
- Events use product wording ("Target Live moved 15 Oct → 22 Oct 2026 (+7 days) · Alex Kim · ‘Vendor slip’").
- It is paginated at 50 events and never shows raw audit JSON. It is accessible as an `<ol>` with time elements.
- **Mobile.** Single column, with the date as a sticky subheader.

**Risks and open questions**

- They are structured records attached to a confirmed claim of type risk, or a question. The status fields are:
  - Risk: Open · Mitigating · Closed
  - Question: Open · Answered
- Owner or confirmer and mitigation are included. There is no standalone register: they appear in the Brief "Risks & open questions" section, Home (overdue questions only) and Weekly.
- Resolving a question offers "Record the answer as a fact", which routes through confirm and never auto‑writes.

**Acceptance**

- The question "Does Phase 1 include refunds?" (confirmer: Finance lead) is answered in the meeting. Confirming the answer creates a Knowledge claim and marks the question Answered.
- History shows both events, and Weekly lists it as a change.

---

## 11. Major risks

1. **Readiness vs coverage confusion.** C1 must be renamed in the UI in the same change.
2. **R8 is hard to reach without AI (P0‑4).** Until §5 ships, R8 can only be met through the existing create‑and‑confirm Knowledge path. Setup must link to that path, or no initiative can reach Ready.
3. **Owner‑only MEMBER edits** may frustrate teams. This is accepted for MVP; admins can reassign.
4. **Manual references look stale.** The honest status vocabulary mitigates this. The UI must never render "Synced".
5. **Archive with dependents.** The dependency note must appear the moment the dependency is archived, not after the next evaluation.
6. **Digest and hash drift (P0‑6).** Parity tests are a release gate.
7. **Partial confirmations.** Partial success must be shown honestly and must be retry‑safe.
8. **Home creep.** Hard caps and owner‑only setup nudges keep Home calm.

## 12. End‑to‑end synthetic story (Prodwise Demo)

1. **3 Oct.** Demo Reviewer (MEMBER) creates **Merchant Insights**: Merchant Services, owner self, stage Delivery. The landing banner reads "Setup incomplete · 4 of 10".
2. The owner adds the objective and scope Phase 1 ("Card settlement only"), sets Target Live 15 Oct and names the next milestone "UAT signoff", date Unknown: **8/10**.
3. The owner adds a Jira source: project PAYMENTS, items PAY‑102 (Epic) and PAY‑118 (Story), role Delivery. They also add the document "Merchant Insights BRD v1" (Requirements) and the email "Finance approval — settlement cut‑off" (Decisions): **9/10**. The review card now says "Add evidence content and confirm your first product fact."
4. The owner pastes BRD excerpts into the workbench. Five proposals arrive with excerpts. They confirm the requirement "Daily settlement file by 06:00", confirm the risk "Bank cut‑off may move", reject a duplicate, and use Add my own entry for a milestone date of 8 Oct, because the paste said "early October". **Ready for intelligence**; the readiness event is recorded.
5. Evaluation finds that Target Live 15 Oct in PAY‑118 notes conflicts with a Phase 2 claim. Minimum context compares them, and no conflict is created because the phases differ. A genuine Phase 1 cut‑off conflict becomes an Open decision.
6. At the **6 Oct steering meeting**, meeting notes yield the decision "Card only in Phase 1" and the action "Finance to confirm settlement approach by Wed 8 Oct". Both are confirmed. The question "Refunds in Phase 1?" is recorded.
7. Merchant Insights DEPENDS_ON Instant Settlement Payout is confirmed. Payout slips to 29 Oct, after UAT signoff on 22 Oct, and the Roadmap shows one supported impact line.
8. The W41 Weekly Draft shows Target Live 15 → 22 Oct (+7 days) from a confirmed proposal, the new decision, 1 open action carried forward and the dependency impact. The Product Lead finalizes W41, and W42 uses it as the baseline.
9. **12 Oct.** Ownership is handed to Taylor Morgan with a reason. The History tab reads, in order: created → sources linked → ready → decision → action → Target Live moved → W41 finalized → owner changed.
10. A separate duplicate initiative, "Merchant Insights (old)", is archived by an ADMIN after typing its name. Its Finals are untouched and it remains searchable under the Archived tag.

**Freeze request.** Approve §1 (S1–S14) and the §1.7 RBAC matrix for implementation of P0‑1. Capabilities 2–10 remain contract drafts, each frozen before implementation. Rendered screenshots at 390, 768, 1024 and 1440 are required for my review before P0‑1 is marked complete.