# Prodwise Second Mission: Contract Freeze for P0‑3 to P0‑6 and P1‑7 to P1‑10

**Author:** Claude, Product/UX Design Lead · **To:** Codex
**Baseline:** `4623810d`
**Authority:** P0‑1, P0‑2 and Binding Amendment A1 remain authoritative. Where this document touches them, it only extends them. It does not replace them.

**Status of this document**
- This is a specification only. **No rendered review is claimed.**
- Each capability still requires screenshots at 390, 768, 1024 and 1440, followed by my rendered review and the red team, before it can be marked complete.
- All examples are synthetic Prodwise Demo content.

---

## 0. Shared rules for all eight capabilities

These rules apply to every capability. Per‑capability sections refer to them as G1–G10 and do not repeat them.

**G1. No autonomous canonical writes.**
- Every canonical write requires a named human command, executed server‑side in one transaction.
- AI output lives only in non‑canonical proposal tables.
- Weekly commentary never writes facts.

**G2. Target‑service authority.**
- Every confirmation calls the target domain's existing command, with no elevation:
  - Knowledge create
  - Knowledge verify
  - delivery fact
  - stage
  - decision
  - `OWNER` (A1.3)
- Ordinary Knowledge creation keeps its existing policy: any business writer (MEMBER and above, not VIEWER).
- The *verified outcome* of a claim (for example, whether it lands ACTIVE/verified or unverified) is whatever the Knowledge service returns for that actor. Prodwise shows that result verbatim, for example "Added to Knowledge · Awaiting verification". It never assumes the claim was verified.
- The UI never re‑derives permission. It asks the server for `can*` flags and shows reasons in place of controls (A1.12).

**G3. Archive guard.** Every write below is blocked on an archived initiative with the message "Archived — restore to edit. Nothing was changed." (A1.8).

**G4. Concurrency.**
- Every mutable canonical row carries an integer `revision`.
- Every mutation takes `expectedRevision`. A mismatch returns `409 CONFLICT` with the current value, actor and time.
- The conflict panel pattern from §1.8 applies: the user's input is preserved, and the choices are **[Use my value]** (resubmit on the new revision) or **[Keep theirs]**.
- Create commands take `clientRequestId`, with `(org, clientRequestId)` unique. A replay returns the original result.

**G5. History.** Every canonical write appends an `initiative_events` row in the same transaction. See P1‑9.

**G6. Org scoping.**
- All reads and writes filter by `organization_id` from the session membership.
- Cross‑org IDs return `404`, never `403`, so existence does not leak.

**G7. Honest states.**
- Missing ≠ 0. Unknown ≠ failed.
- Every count derives from rows. There are no hard‑coded counts.

**G8. Accessibility.**
- Status is always conveyed by text and icon, never colour alone.
- Dialogs and drawers trap focus and restore it on close.
- Errors appear inline and in a summary with `role="alert"`.
- Touch targets are 44px.
- Reduced motion disables span‑scroll animation.

**G9. Mobile.**
- Designed per surface, not a stacked desktop layout.
- No horizontal overflow at 390.
- Sticky action bars never cover the focused input: the bar uses `scroll-padding-bottom`.

**G10. Snapshot safety.**
- New fields entering Weekly snapshots are gated by `schemaVersion`.
- Existing Finals are never re‑hashed, rewritten or re‑rendered with new semantics.

---

## 1. Cross‑capability navigation plan (one plan, no new global tabs)

**Global navigation is unchanged.**

**Initiative tab set.** The existing tabs stay. Two initiative‑level tabs are added:

```
Brief · Knowledge · Decisions · Roadmap · Weekly (existing) · Actions (new) · History (new)
```

These are initiative tabs, not global navigation. They satisfy the scope rule that nothing is added to global navigation.

**Contextual routes (reachable, with no nav item):**

| Route | Purpose |
|---|---|
| `/initiatives/[slug]/evidence/new` | Evidence workbench: paste or meeting notes |
| `/initiatives/[slug]/evidence/[submissionId]` | Resume a submission, retry, review proposals |
| `/initiatives/[slug]/actions/[actionId]` | Action detail, rendered as a drawer over the Actions tab (deep‑linkable) |
| `/initiatives/[slug]/context` | Risks & open questions full list, reached from the Brief section "View all" |
| `/initiatives/[slug]/manage#relationships` | Relationships (Manage section, P1‑8) |
| `/sources/[id]` | Existing contextual route (A1.6) |

**Brief composition.** The Brief is the hub. It has one identity band and then these sections, in order:
1. Attention (existing)
2. Commitments rail: open actions, maximum 5, "All actions →"
3. Risks & open questions: maximum 3 each, "View all →"
4. Dependencies line in the band: "Depends on Instant Settlement Payout · 1 impact"
5. Recent history: last 5 events, "Full history →"
6. **[Add evidence]** as the primary contextual button beside Manage initiative

**Home** receives capped, owner‑routed rows only (each detailed per capability):
- overdue or due‑soon actions
- a supported dependency impact
- overdue open questions

The combined cap is 5 rows, followed by "and N more in Initiatives".

**Search.** The existing search gets these additional org‑scoped result types, each with an initiative breadcrumb and an Archived tag when applicable:
- action titles
- open question text
- risk claim text
- source item references (existing)
- decision subjects

Proposals are **not** indexed because they are non‑canonical.

**Crosslink invariant.** Every object detail shows its initiative breadcrumb, its **origin** link and its **downstream** links, so there are no dead ends. The per‑capability "Crosslinks" rows below list these links.

---

## 2. P0‑3 Actions / Commitments

### 2.1 UX contract

**Placement**
- Brief Commitments rail
- Actions tab: `/[slug]/actions`
- Weekly Draft "Next steps"
- Home (capped)
- Action detail drawer

**Actions tab layout (desktop)**
- Grouped lists, not a table:
  - **Overdue**
  - **Due this week**
  - **Later**
  - **No due date**
  - collapsed **Done & cancelled (n)**
- A single inline composer sits at the top: "Add a commitment…" plus a *Commitment details* expansion with assignee, due date, and optional evidence link. The origin is Human Entry automatically.
- Helper line: "Commitments from reviews, meetings and decisions — not delivery tickets."

**Row content**
- Title
- Assignee avatar and name
- Due date shown relative and absolute: "Due Wed 8 Oct · in 2 days" or "Overdue 2 days" (with a warning icon)
- Status menu button
- Origin chip: "From W40 review" / "From 6 Oct steering notes" / "From decision: Settlement cut‑off" / "From evidence" / "Added by hand"

**Status values:** Open · In progress · Done · Cancelled.
- **Done** takes an optional completion note and no confirmation dialog.
- **Cancelled** requires a reason.
- **Reopen** (Done/Cancelled → Open) requires a reason.
- There is no *Blocked* status. **Blocked** is an optional flag with a required blocker note, and it can be set on Open or In progress. This keeps the scope's four statuses while supporting Home's "blocked commitment" row.

**Detail drawer**
- Editable fields: title, assignee, due date, evidence link
- Origin block with a link
- Event timeline, read from immutable events

**Not Jira.** There are no priorities, boards, subtasks, estimates or custom fields.

**Weekly integration**
- Each Draft "Next steps" line gets a **Make commitment** control.
- It opens a preview with title, assignee (defaults to the initiative `OWNER`) and due date (parsed hints such as "by Wednesday" are shown as a *suggestion* the user must accept).
- **[Confirm commitment]** creates the Action with origin = WEEKLY_REVIEW and `origin_ref` = draft review id plus line key.
- The line then shows "✓ Commitment created" and a link.
- The next Draft shows "Carried forward: 2 open" and "Completed since W40: 1", derived from action rows and events at Draft build time.
- The Final snapshot stores action ids, titles and statuses per G10. Finals are never mutated when actions change later.

**Home rows** are visible to the assignee, and to the initiative owner for unassigned or admin‑portfolio actions:
- overdue
- due in ≤ 3 days (evaluated against the org‑local date)
- blocked

Each type is capped at 3.

### 2.2 Canonical persistence (exact)

**Table `actions`** holds the current‑state projection:

| Column | Notes |
|---|---|
| `id`, `organization_id`, `initiative_id` | |
| `title` | 1–200 characters, trimmed |
| `assignee_member_id` | nullable = unassigned; must be an active, non‑Viewer, scoped member at write time |
| `due_date` | date, nullable |
| `status` | `OPEN`, `IN_PROGRESS`, `DONE` or `CANCELLED` |
| `blocked_note` | nullable; non‑null = blocked |
| `origin` | `WEEKLY_REVIEW`, `MEETING`, `DECISION`, `HUMAN_ENTRY` or `CONFIRMED_AI_PROPOSAL` |
| `origin_ref_type`, `origin_ref_id` | |
| `evidence_submission_id`, `evidence_anchor_id` | nullable |
| `created_by`, `created_at`, `completed_at` | `completed_at` set on DONE |
| `cancelled_at`, `revision` | |

**Table `action_events`** is append‑only. It has no UPDATE or DELETE grants at the DB role level. Columns:
- `id`, `action_id`, `organization_id`, `seq`
- `type`: CREATED, TITLE_CHANGED, ASSIGNEE_CHANGED, DUE_CHANGED, STATUS_CHANGED, BLOCKED_SET, BLOCKED_CLEARED, EVIDENCE_LINKED
- `from_json`, `to_json`, `note`, `actor`, `at`, `client_request_id`

**Write and uniqueness rules**
- Every mutation updates `actions` with `revision = expectedRevision` and inserts the event in one transaction.
- The projection must be reproducible from events. Codex adds a test that replays events and compares the result with the row.
- `UNIQUE(origin_ref_type, origin_ref_id)` applies for WEEKLY_REVIEW lines and CONFIRMED_AI_PROPOSAL, which prevents double conversion.

### 2.3 Permissions (A1.12, unchanged)

| Operation | Who may do it |
|---|---|
| Create | MEMBER and above |
| Edit title, due date or evidence link | admin, existing PL, initiative OWNER, creator |
| Change assignee | admin, existing PL, initiative OWNER, creator. The assignee may *release* the action to unassigned (with a note). |
| Status and blocked flag | admin, PL, assignee, initiative OWNER, creator |
| All writes | Viewer ✗; blocked on archive (G3) |

Unauthorized users see reasons, for example "Only the assignee, the initiative owner, the creator or an admin can update this commitment."

### 2.4 Concurrency and conflict UX

- Status and edits carry `expectedRevision`.
- On conflict: "Taylor marked this **Done** at 14:02. Your change to **In progress** wasn't saved." with **[Reopen as In progress]** and **[Keep Done]**.
- Double‑clicking Done is idempotent through `clientRequestId`.

### 2.5 States

| State | Copy / behaviour |
|---|---|
| Empty tab | "No commitments yet. Commitments you confirm from Weekly Review, meetings or evidence appear here — or add one." Composer visible to authorized users. |
| Empty rail | "No open commitments." |
| Load error | "Couldn't load commitments. [Retry]". Other Brief sections still render. |
| Save error | Inline on the row: "Not saved — [Retry]". The value is kept. |
| Unassigned | "No assignee", neutral |
| No due date | "No due date", never overdue |
| Archived | Rows read‑only, banner per A1.8 |
| Assignee deactivated | "Assignee no longer active — reassign", shown to authorized users |

**Mobile**
- Groups become stacked cards.
- The status menu becomes a bottom sheet with four 44px options plus "Mark blocked".
- The composer is a sticky "Add commitment" button that opens a full sheet.
- The drawer becomes a full‑screen view with a back arrow.

### 2.6 Crosslinks

- **Action → origin:** Weekly Draft or Final line, meeting evidence span, decision, or proposal submission.
- **Action → evidence span.**
- **Decision → "Commitments from this decision (n)".**
- **Weekly line → action.**
- **History event → action.**
- **Home row → action drawer.**

### 2.7 Acceptance

- **A3‑1.** A W40 Draft line "Finance to confirm settlement approach by Wednesday" becomes an action through Make commitment: assignee Finance lead, due 8 Oct, origin WEEKLY_REVIEW. Converting the same line again returns the existing action.
- **A3‑2.** On 6 Oct it appears on the Brief rail and on Home as due soon for the assignee. It does not appear on Home for an unrelated MEMBER.
- **A3‑3.** It is marked Done on 7 Oct: `completed_at` is set, and CREATED and STATUS_CHANGED events exist. The W41 Draft lists it under "Completed since W40". The W40 Final is byte‑identical.
- **A3‑4.** Two tabs change status at the same time. The second tab gets the conflict panel, and no silent overwrite occurs.
- **A3‑5.** A VIEWER sends a crafted POST and receives a denial, with no row or event created. An unrelated MEMBER who is not the assignee, owner or creator is denied a status change.
- **A3‑6.** An `action_events` UPDATE fails at the DB role level.
- **A3‑7.** Writes on an archived initiative are rejected with the archive copy.
- **A3‑8.** At 390 there is no overflow, and the status sheet is keyboard‑ and screen‑reader operable.

**P0‑3: FREEZE APPROVED.**

---

## 3. P0‑4 Anchored AI Evidence Ingestion

### 3.1 UX contract

**Intake (only two modes; no upload, no connector):**
- **Paste text.** Source is either an existing linked source item or "New pasted evidence", which creates a `PASTED_EVIDENCE` source item linked to this initiative. The role defaults to General evidence.
- **Meeting notes.** See P1‑7.

The intake shows these lines persistently:
- "Paste text only. Prodwise doesn't read files, Drive or email."
- "Up to 20,000 characters."
- The A1.7 honesty line: "Your text is saved. If you leave this page, reading may stop. You can return and retry. Nothing is added to truth until you confirm."

**Workbench (desktop)**
- **Left pane:** stored evidence text, read‑only after submit, with numbered highlighted spans.
- **Right pane:** proposal list grouped by type.
- **Header:** submission status plus source chip.

**Status machine:** `Saved` → `Reading…` → `Proposals ready` | `Timed out` | `Failed` | `Stopped`.
- Every failure state shows **[Retry reading]** and "Your text is saved."
- A retry creates a new *attempt* and never re‑saves the text.
- The page shows no spinner‑only screen. The text pane renders immediately.

**Proposal card**
- Type chip: Requirement · Decision · Business rule · Risk · Dependency · Assumption · Delivery fact · Action · Open question
- Proposed statement
- Destination line, for example:
  - "Confirming adds a Requirement to Knowledge."
  - "Confirming updates Target Live 15 Oct → 22 Oct 2026 · rationale required."
  - "Confirming creates a commitment for Finance lead."
  - "Confirming records an open question — not a fact."
- Exact quote in a blockquote, with span number
- **[Show evidence]** · **[Confirm]** · **[Reject]** (optional reason) · **[Add my own entry]**
- No confidence score anywhere.

**Type → canonical target mapping (reuses Knowledge types; no new truth store)**

| Proposal type | Target | Command reused |
|---|---|---|
| Requirement / Decision / Business rule / Risk / Dependency / Assumption | Knowledge claim of type `REQUIREMENT` / `DECISION` / `BUSINESS_RULE` / `RISK` / `DEPENDENCY` / `ASSUMPTION` | Existing Knowledge create. Verified outcome per G2. |
| Delivery fact (Target Live, Next milestone, Dev start, Actual Live) | Delivery fact revision | Existing delivery‑fact command with `expectedRevision` plus a required rationale (A1.4), prefilled as "From evidence: [source name]" and editable |
| Action | `actions` (origin CONFIRMED_AI_PROPOSAL, or MEETING when the submission is meeting notes) | P0‑3 create |
| Open question | `open_questions` (P1‑10) | P1‑10 create. **Never** a claim. |

Owner and stage proposals are **not produced** in MVP. The server discards those types, so there is no path around A1.3 or `stage.ts`.

**Value safety**
- Inline edits are allowed only when they are cosmetic: whitespace, case, punctuation, or date *format* with the same calendar date.
- The server re‑normalizes and compares. If the normalized value differs from the proposed normalized value, the server returns `VALUE_EDIT_REQUIRES_NEW_ENTRY`, and the UI says: "This changes the meaning. Use **Add my own entry** — it's recorded as your entry, not linked to this evidence."
- **Add my own entry** opens the target's standard create form, prefilled and editable. Its provenance is `HUMAN_ENTRY / DIRECT_KNOWLEDGE` with **no anchor**. The proposal is marked `SUPERSEDED_BY_HUMAN_ENTRY` and linked to the new record for traceability, so the evidence is not falsely attached.

**Batch confirm**
- "Confirm selected (3)" runs one independent server command per proposal. Each command is individually transactional.
- The results panel lists per‑item outcomes: "2 confirmed · 1 not applied: Target Live changed since proposal (now 29 Oct) — review."
- A partial result is never labelled success. Failed items stay pending with a reason.

### 3.2 Canonical persistence (exact)

**`evidence_submissions`**

| Column | Notes |
|---|---|
| `id`, `organization_id`, `initiative_id`, `source_item_id` | |
| `kind` | `PASTED` or `MEETING_NOTES` |
| `text` | immutable after insert |
| `text_sha256` | |
| `char_length` | ≤ 20,000, enforced server‑side |
| `created_by`, `created_at` | |

**`evidence_attempts`**
- `id`, `submission_id`, `status` (READING, READY, TIMED_OUT, FAILED, STOPPED), `started_at`, `ended_at`, `error_code`, `model_id`, `prompt_version`
- A stale READING attempt older than the server timeout is reported as TIMED_OUT on read. There is no background job.

**`evidence_anchors`**
- `id`, `submission_id`, `start_offset`, `end_offset`, `quote`
- Offsets are UTF‑16 code‑unit indices into `text`, matching JS string semantics.
- The server verifies `text.slice(start, end) === quote` on insert, and re‑verifies it on confirm against the stored text and `text_sha256`.
- Proposals whose quote fails verification are discarded before persistence and never shown (A1.10).

**`evidence_proposals`** (non‑canonical)
- `id`, `attempt_id`, `submission_id`, `anchor_id`, `type`, `payload_json` (normalized proposed value), `payload_sha256`
- `version`: starts at 1 and increments on cosmetic edit
- `base_revision_json`: target revision observed at proposal time, for delivery facts
- `status`: PENDING, CONFIRMED, REJECTED, SUPERSEDED_BY_HUMAN_ENTRY or OUTDATED
- `decided_by`, `decided_at`, `reject_reason`, `result_ref_type`, `result_ref_id`

**`evidence_confirmations`**
- `proposal_id` is UNIQUE, which makes confirmation single‑use.
- Other columns: `proposal_version`, `actor`, `at`, `result_ref`, `client_request_id`.

**Confirm command (one transaction)**
1. Lock the proposal row.
2. Require `status = PENDING` and `version = expectedVersion`. Otherwise return `409 "This proposal changed or was already handled."`
3. Re‑verify the anchor quote.
4. Call the target command, passing `evidence_anchor_id` as provenance.
5. Insert the confirmation.
6. Set CONFIRMED and `result_ref`.
7. Append the history event.
8. Set the source link status to "Evidence added".

A target conflict aborts the whole transaction and sets the proposal to OUTDATED only when the base revision is stale.

**Retention.** Submissions and proposals are never deleted, including rejected ones, which keeps the audit trail. They are not indexed in search.

### 3.3 Permissions

| Operation | Rule |
|---|---|
| Submit evidence | MEMBER and above (same as source link) |
| Confirm / Reject | Target domain per G2 and A1.10 |
| Reject when the actor lacks target authority | Blocked. The card shows the reason, e.g. "Only the owner or an admin can confirm delivery changes." |
| Add my own entry | Target domain create authority |
| All writes | Viewer ✗; archive guard (G3) |

### 3.4 Concurrency

- Proposal `version` plus single‑use confirmation handles concurrent confirmers. The second confirmer sees "Already confirmed by Alex Kim at 14:02 · View record."
- Delivery proposals whose base revision is stale become **Outdated** and show "Current value is 29 Oct (set by Alex Kim)." They offer **[Propose again from current]**, which creates a new proposal version against the current revision. Confirming still requires an explicit click.

### 3.5 States

| State | Copy |
|---|---|
| Empty (no proposals) | "Prodwise didn't find records to propose in this text. Nothing was added. You can add entries yourself." [Add my own entry] |
| Timed out / Failed / Stopped | Status plus "Your text is saved. [Retry reading]" |
| Over the limit | "This is 24,310 characters. Split it into submissions of up to 20,000." The text is kept in the field. |
| Some proposals discarded | "3 possible records were left out because their quote couldn't be matched exactly." No detail on the discarded content. |
| Viewer | Read‑only workbench, no buttons, reasons shown |
| Archived | Read‑only |

**Mobile**
- Tabs: "Evidence | Proposals (7)".
- **Show evidence** switches tabs, scrolls the span into view and focuses it. A "Back to proposal" chip returns focus to the card.
- Cards are full width. Confirm, Reject and More sit in a card footer. "Add my own entry" lives under More.
- Batch select uses a sticky bar: "3 selected · Confirm".

### 3.6 Crosslinks

- **Proposal → resulting record.**
- **Record provenance → evidence span** (from Knowledge, delivery history, action and question).
- **Submission → source item → `/sources/[id]`.**
- **Source detail → submissions list.**
- **Setup R8 "Add evidence" → workbench.**
- **Brief [Add evidence] → workbench.**

### 3.7 Acceptance

- **A4‑1.** Synthetic BRD text (≤ 20k characters) is saved before reading starts. Killing the model call yields Failed. Retry creates attempt 2 without duplicating the text.
- **A4‑2.** Five proposals are shown, each with a quote that the server verifies equals `text.slice(start, end)`. A seeded proposal with a mismatched quote is never persisted or shown.
- **A4‑3.** Confirming a Requirement creates a `REQUIREMENT` claim through the existing command. Its status equals what the Knowledge service returns for a MEMBER, and the UI copy matches that status.
- **A4‑4.** Confirming the same proposal twice creates one claim and returns the existing result the second time. A cosmetic edit bumps the version, and a confirm with the stale version returns 409.
- **A4‑5.** Changing "early October" to "8 Oct" through inline edit is rejected with `VALUE_EDIT_REQUIRES_NEW_ENTRY`. Add my own entry creates a HUMAN_ENTRY with no anchor, and the proposal becomes SUPERSEDED_BY_HUMAN_ENTRY.
- **A4‑6.** A delivery proposal after a concurrent Target Live change becomes Outdated, with no write.
- **A4‑7.** A MEMBER who is not the owner cannot confirm a delivery proposal (server denial), but can confirm a Requirement.
- **A4‑8.** A rejected proposal is absent from Knowledge, Delivery, Actions and Weekly.
- **A4‑9.** An Open question proposal creates an `open_questions` row and **no** claim.
- **A4‑10.** No owner or stage proposal is ever persisted.
- **A4‑11.** At 390 the tab switch and focus behaviour work by keyboard and screen reader.

**P0‑4: FREEZE APPROVED.**

---

## 4. P0‑5 Queue completeness (dispositions)

### 4.1 UX contract

**Lanes in Decisions:** Open · Deferred · Dismissed · Resolved · History. Each lane shows a live count.

**Decision panel hierarchy is unchanged.** **Make a decision** stays primary and produces a real decision under the existing semantics. The secondary outlined controls are:

- **Defer…** with two choices: "Until a date" or "Until the next Weekly Review". A reason is required.
  - Copy: "Stays on record. Returns to Open on [date] or if the underlying evidence changes."
- **Dismiss…** with a required reason.
  - Copy: "Recorded as not a real conflict for these exact claims. Returns only if they change."

**Chips (icon plus text, never "Closed")**
- Resolved ✓ "Resolved · 3 Oct · decision"
- Deferred ⏸ "Deferred until 10 Oct"
- Dismissed ⊘ "Dismissed · 3 Oct"

**Reopen copy on a card**
- "Reopened: evidence changed since dismissal on 3 Oct"
- "Reopened: deferral ended 10 Oct"
- "Reopened: evidence changed since deferral"

**Undo.** A deferral or dismissal can be withdrawn by an authorized user through **Return to Open** (reason optional). This appends a new disposition and never erases the prior one.

### 4.2 Canonical persistence (exact)

**Existing real decisions are untouched.** Resolved = an existing decision record, with the existing re‑emergence semantics, including the case where the original digest returns.

**New table `finding_dispositions`** (append‑only):

| Column | Notes |
|---|---|
| `id`, `organization_id`, `finding_id` | |
| `kind` | `DEFERRED`, `DISMISSED` or `WITHDRAWN` |
| `underlying_digest` | The finding's existing claim‑content digest at record time. **The disposition is never part of this digest** (A1.9). |
| `defer_until` | date, nullable |
| `defer_until_next_review` | bool |
| `reason`, `actor`, `at`, `client_request_id` | |

**Effective disposition** is a pure function `effectiveDisposition(finding, dispositions, asOf)`. It selects the latest disposition row and reports it as active only if **all** of the following hold:
- It is not WITHDRAWN.
- `underlying_digest` equals the finding's current underlying digest.
- For DEFERRED: `asOf < defer_until`, or the next Weekly Review has not yet been finalized since `at`.

Otherwise the finding reads as Open, and the reopen reason is computed from which condition failed.

**Other rules**
- `asOf` is an explicit parameter passed in by the evaluator or request. Rule comparison never reads the clock.
- An existing real decision always takes precedence over a disposition.
- No finding status column is overwritten. Lanes are derived.

### 4.3 Permissions

- Defer, dismiss and withdraw use the **existing decision authority**, with Product Lead semantics unchanged.
- Viewer ✗. Archive guard applies (G3).

### 4.4 Concurrency

- The command takes `expectedDigest` (the underlying digest shown) and `expectedLatestDispositionId`.
- If the digest changed: "The evidence behind this item changed while you were reviewing. Review the updated claims before deferring." The panel refreshes and the reason text is preserved.
- If another disposition landed first: "Alex Kim dismissed this at 14:02." with **[View]** and **[Return to Open]** (if authorized).

### 4.5 States

| State | Copy |
|---|---|
| Empty Deferred | "Nothing deferred." |
| Empty Dismissed | "Nothing dismissed." |
| Empty Open | Existing copy, never "all clear" unless evaluation ran |
| Error | "Couldn't record this. Nothing changed. [Retry]" |

**Mobile.** Lanes are a scrollable tab strip with an edge fade and counts in the labels. Panel actions sit in a sticky bottom bar. Defer and Dismiss open sheets.

### 4.6 Crosslinks

- **Disposition → claims it was bound to (their evidence).**
- **Reopened card → the changed claim's revision.**
- **History events:** deferred, dismissed, reopened.
- **Weekly Draft:** "Deferred this week (n)" and "Dismissed (n)" as changes, snapshotted per G10.

### 4.7 Acceptance

- **A5‑1.** Dismiss the Merchant Pricing conflict and rerun evaluation with identical claims: it stays Dismissed.
- **A5‑2.** Change one claim value and it reopens with the evidence‑changed copy. Restore the original value: the dismissal is **not** revived automatically, because the latest disposition's digest check re‑passes only if the digest equals the recorded one. **This is intended.** It is documented and tested as "digest returns → dismissal applies again", mirroring the real‑decision return semantics. It is covered by a regression test.
- **A5‑3.** Defer until 10 Oct. With `asOf` = 9 Oct it is Deferred; with `asOf` = 10 Oct it is Open. The test uses no wall‑clock time.
- **A5‑4.** An existing real decision and its re‑emergence behave exactly as they do at baseline (snapshot test of the existing suite).
- **A5‑5.** A disposition never changes `underlying_digest`, and there is no self‑invalidation loop.
- **A5‑6.** A VIEWER and a non‑authorized MEMBER are denied server‑side.
- **A5‑7.** No UI string "Closed" appears for these outcomes.

**P0‑5: FREEZE APPROVED.**

---

## 5. P0‑6 Minimum context (applicability)

### 5.1 UX contract

**"Applies to" row** appears on Knowledge create, delivery‑fact edit and proposal confirm:
- **Context:** a picker of the initiative's controlled contexts (A1.5) plus "No specific context".
- **Effective date:** optional date.
- The current context is **pre‑filled and visible**. The user can switch it to No specific context.

**Chip on claims and facts:** "Phase 1 — Card settlement · from 1 Jan 2027". When no context is recorded, the claim shows no chip, and comparisons show "Context not recorded".

**Not‑compared state (A1.1)**
- Shown in Knowledge and on the Brief attention area as a neutral informational line: "2 claims about Target Live weren't compared: applicability differs or isn't recorded. [Review]"
- It is never green and never counted as healthy.

**Roadmap** shows context‑labelled Target Live markers.

**Old Finals** render exactly as stored. There is no retroactive chip injection.

### 5.2 Canonical persistence and digest (exact)

**New nullable columns** on claims and on delivery fact revisions:
- `context_id`: FK to `initiative_contexts.id`, same initiative, enforced
- `effective_date`: `date`, no timezone

**Comparison predicate.** This is unchanged except for the added line:

```
same initiative
AND same normalized subject
AND same normalized attribute
AND both ACTIVE
AND different normalized values
AND no supersession
AND (both context_id IS NULL, OR both context_id equal)
AND (both effective_date IS NULL, OR both effective_date equal)
```

- A null context compared with a non‑null context means **not compared**.
- A retired context still compares equal to itself.
- The predicate never broadens matching.

**Digest encoding** (identical in TypeScript `contentDigestOf` and SQL `decision_hash`):
- When **both** `context_id` and `effective_date` are null, the digest input is **byte‑identical to baseline**. Existing digests and existing decisions do not move, so no historical data is re‑hashed.
- Otherwise, append to the existing canonical input string, before hashing:
  ```
  "\u001fctx=" + lower(uuid or "") + "\u001feff=" + (YYYY-MM-DD or "")
  ```
  using the same separator convention as the existing encoder. If the baseline uses a different field separator, reuse *that* separator. Codex must mirror the existing convention exactly.
- `effective_date` is serialized as an ISO calendar date. It never passes through `Date` with a timezone.

**Finals.** Existing Weekly Finals are not rewritten or re‑hashed. New Finals include context under the next `schemaVersion` only (G10).

### 5.3 Permissions

- The Applies‑to row inherits the host write's authority (Knowledge create, delivery facts, proposal confirm).
- Creating or renaming contexts stays per A1.12.

### 5.4 Concurrency

- Changing context or effective date on a claim is a material change. It creates a new claim revision through the existing supersession path with `expectedRevision`, so it can never be a silent in‑place edit.
- Conflict handling follows G4.

### 5.5 States

| State | Copy |
|---|---|
| No contexts exist | Picker shows "No contexts yet — [Create context]" for authorized users, otherwise "No specific context" only |
| Retired context | Shown with a "(retired)" suffix, and not selectable for new records |

**Mobile.** The Applies‑to row is a disclosure, "Applies to: Phase 1 ▸", that opens a sheet.

### 5.6 Crosslinks

- **Context chip → filtered Knowledge view for that context.**
- **Not‑compared line → the two claims.**
- **Roadmap marker → the delivery fact history.**

### 5.7 Acceptance

- **A6‑1.** Phase 1 Target Live 15 Oct and Phase 2 Target Live 31 Mar produce no conflict. Two Phase 1 values produce a conflict.
- **A6‑2.** Phase 1 versus no context produces no conflict and shows the Not‑compared line.
- **A6‑3.** Parity: a fixture set of at least 20 claims gives equal TypeScript and SQL digests, including null/null, context only, date only, both, and a date near a timezone boundary (e.g. 2026‑12‑31).
- **A6‑4.** Every baseline fixture digest (with both fields null) is unchanged from `4623810d`. Existing decisions do not re‑emerge on migration.
- **A6‑5.** Existing Finals are byte‑identical after migration.
- **A6‑6.** A cross‑initiative `context_id` is rejected by FK/check.

**P0‑6: FREEZE APPROVED.** The parity and baseline‑digest tests are a release gate.

---


Editorial note: API output stopped during P1. Only complete, explicit P0-3 through P0-6 freeze verdicts above are retained. P1 is pending a separate response.
