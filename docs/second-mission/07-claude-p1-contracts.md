# Prodwise Second Mission: Contract Freeze for P1‑7 to P1‑10

**Author:** Claude, Product/UX Design Lead · **To:** Codex · **Baseline:** `4623810d`

**Authority.** P0‑1 through P0‑6, A1, G1–G10 and the §1 navigation plan in doc 06 remain binding. This document only extends them. It adds no global navigation. It is a specification only, and **no rendered review is claimed**. Each capability still needs screenshots at 390, 768, 1024 and 1440, my rendered review and the red team before it can be marked complete. All examples are synthetic Demo content.

---

## 0. Additional shared rules (H1–H5)

**H1. Explicit commands.** Only the named human commands below write canonical rows. Evaluators, AI output and page loads never write canonical rows. Derived values, such as risk default status or dependency impact, are computed at read time and never stored as truth.

**H2. Proposals.** Proposals always follow P0‑4:
- They are stored in `evidence_proposals`.
- Each has a verified anchor.
- Confirmation is single‑use.
- Authority belongs to the target domain.
- No confidence score is shown.

**H3. Revision‑checked writes.**
- Every mutable row added here carries `revision`, and every write sends `expectedRevision`.
- Conflicts use the G4 panel with **[Use my value]** / **[Keep theirs]** and preserve the user's input.
- Every create takes `clientRequestId`.

**H4. Read scoping.**
- A reference to another initiative is shown only if the viewer can read it.
- Otherwise it displays "An initiative you can't access", with no name or link.
- Cross‑org references are impossible, enforced by FK plus an org check.

**H5. Finals.**
- Weekly Finals are never rewritten.
- New sections enter snapshots only under the next `schemaVersion` (G10).

---

## 1. P1‑7 Meeting Intelligence

### 1.1 Canonical schema decision

**No new truth store and no meeting domain.** A meeting is an evidence submission with `kind = MEETING_NOTES`, plus one metadata row.

**New table `meeting_notes`** (1:1 with the submission):

| Column | Notes |
|---|---|
| `submission_id` | PK/FK |
| `organization_id` | |
| `title` | 1–160 characters |
| `meeting_date` | date, required, no timezone |
| `attendees_text` | optional free text; never resolved to members |
| `revision` | |

**Source item.** Each meeting creates or links a source item of type `MEETING_NOTES`, which follows the A1.6 identity rules. The reference is `meeting:<date>:<title-slug>` within the initiative container. The default role is General evidence.

**Text immutability.** The submission text is immutable (P0‑4). Only title, date and attendees can be corrected, with a revision check. Corrections are history‑evented.

**Proposal types and targets.** Each type reuses a P0‑4 or P1 target; none are new.

| Meeting proposal | Canonical target (existing command) |
|---|---|
| Decision | Knowledge `DECISION` claim. Never resolves a queue finding. |
| Action | `actions`, origin `MEETING`, `origin_ref` = proposal |
| Risk | Knowledge `RISK` claim, which then becomes trackable (P1‑10) |
| Changed requirement | Existing Knowledge **supersede** command against a named existing claim id plus `expectedRevision`. If that claim changed, the proposal becomes Outdated. |
| Delivery date change | Delivery‑fact command, with the rationale prefilled as "From [title], [date]" and editable. Stale base means Outdated (P0‑4 §3.4). |
| Open question | `open_questions` (P1‑10). Never a claim. |

Owner, stage and relationship proposals are discarded from meeting notes, the same as in P0‑4.

### 1.2 UX

**Entry points**
- Brief **[Add evidence ▾]** → "Meeting notes"
- Setup R8
- Source detail for a meeting source → "Add another meeting"
- Route: `/initiatives/[slug]/evidence/new?kind=meeting`

**No connector promises.** The intake shows a persistent line: "Paste notes or a transcript. Prodwise doesn't join calls or read calendars, Drive or email." The P0‑4 honesty and 20,000‑character lines also apply.

**Layout**
- A compact meeting header sits above the paste box: title, date (required), attendees (optional).
- After submit, the standard P0‑4 workbench opens. The left pane holds the notes; the right pane holds proposals.
- Proposals are grouped in meeting order: **Decided · Commitments · Risks · Changed requirements · Date changes · Open questions**. Each group header shows its count, and empty groups are hidden.
- Changed‑requirement cards show "Current: … → Proposed: …" with the current claim linked.
- The workbench header reads "Steering sync · 6 Oct 2026 · 7 proposals · 2 confirmed".
- **Wrap‑up strip:** "4 confirmed · 1 rejected · 2 pending — pending items stay here; nothing is added until you confirm."

**Where meetings appear later**
- The Source detail lists meetings newest first.
- History records "Meeting notes added" and each confirmed item, with "from Steering sync, 6 Oct".
- Action origin chips read "From 6 Oct steering notes".
- There is no meetings tab and no meetings register.

**States.** P0‑4 states apply, plus:
- Missing date: "Add the meeting date so decisions and dates are placed correctly."
- Archived: read‑only.

**Mobile.** P0‑4 tabs "Notes | Proposals (n)". The meeting header is a single collapsible summary row. Group headers are sticky within the Proposals tab.

### 1.3 Permissions and concurrency

- **Submit:** MEMBER and above.
- **Correct metadata:** the submitter, the initiative OWNER or an admin.
- **Confirm/reject:** target domain (G2, A1.10).
- **Viewer:** ✗. Archive guard (G3) applies.
- Proposals use P0‑4 versioning. Metadata uses H3. A supersede against a changed claim becomes Outdated with **[Propose again from current]**.

### 1.4 Acceptance

- **M‑1.** Synthetic steering notes produce Decision, Action, Risk, Date change and Question proposals, each with a verified quote. Confirming the action creates `actions.origin = MEETING`, with the origin chip linking to the span.
- **M‑2.** Confirming the date change as a MEMBER who is not the owner is denied server‑side. The owner's confirmation writes a delivery revision with a rationale. The Roadmap reflects it.
- **M‑3.** A changed requirement whose target claim was superseded after proposal becomes Outdated. No write occurs.
- **M‑4.** The meeting is a `MEETING_NOTES` source item reachable from `/sources/[id]`. Rejected and pending items appear nowhere canonical. At 390 there is no overflow.

**P1‑7: FREEZE APPROVED.**

---

## 2. P1‑8 Relationships / Dependencies

### 2.1 Canonical schema decision

**New table `initiative_relationships`**

| Column | Notes |
|---|---|
| `id`, `organization_id` | |
| `from_initiative_id`, `to_initiative_id` | same org (FK plus check); not equal |
| `type` | `PART_OF`, `DEPENDS_ON` or `RELATED_TO` |
| `rationale` | required, trimmed, nonblank |
| `provider_fact_kind` | nullable: `TARGET_LIVE` or `NEXT_MILESTONE`, on the "to" side |
| `provider_context_id` | nullable |
| `needed_by_fact_kind`, `needed_by_context_id` | nullable, on the "from" side |
| `evidence_anchor_id` | nullable |
| `status` | `ACTIVE` or `ENDED` |
| `created_by`, `confirmed_by`, `confirmed_at` | |
| `ended_by`, `ended_at`, `end_reason` | |
| `revision` | |

**Direction and invariants**
- `DEPENDS_ON` reads "from depends on to". **Blocks** is derived as its inverse and is never stored.
- `RELATED_TO` is stored with normalized id order.
- There is a partial unique constraint on active `(from, to, type)`.
- `PART_OF`: at most one active parent, and no cycles (checked in the transaction).
- `DEPENDS_ON` cycles are rejected with "This would create a circular dependency."

**Human creation.** A manual create is itself the human confirmation: `confirmed_by = created_by`.

**AI path.** P0‑4 `Dependency` proposals still create Knowledge `DEPENDENCY` claims only. A separate proposal type, `RELATIONSHIP`, is emitted only when the quote names an initiative that exists in the same org by exact normalized name. The user must pick or confirm the target and type and enter a rationale before **[Confirm relationship]**. Unconfirmed relationships never appear in the Brief, Roadmap or Home.

**Impact (derived, H1)** is shown only when all of the following hold:
- The relationship is `DEPENDS_ON`.
- Both fact kinds are specified.
- Both current fact revisions are **known dates** in the specified contexts.
- The provider date is later than the needed‑by date.

Any Unknown, Missing or unspecified input yields "Impact not assessed: [reason]". This is neutral and is never shown as a risk or as healthy.

### 2.2 UX

**Entry point.** Manage initiative → **Relationships** section (`/manage#relationships`). No new tab.

**Layout (Relationships section)**
- Three plain‑language groups: "Depends on", "Blocks (derived)", "Part of / Contains", "Related".
- Each row shows: initiative name, archived tag if applicable, rationale excerpt, confirmed by and date, and an impact line.
- **[Add relationship]** opens a drawer with these fields:
  - Type, written as sentences, e.g. "Merchant Insights depends on…"
  - Initiative search (org‑scoped, readable only)
  - Rationale
  - Optional "Which dates matter?" disclosure with a provider fact and a needed‑by fact, each with a context picker
- **End relationship** requires a reason. Ended relationships move to a collapsed "Ended (n)" group. There is no delete.

**Where relationships surface**
- **Brief band:** "Depends on Instant Settlement Payout · 1 impact".
- **Roadmap:** a connector marker on B's needed‑by marker reads "Instant Settlement Payout Target Live 29 Oct is after this milestone (22 Oct)", linking to both facts.
- **Home:** a capped row for B's owner reads "Dependency impact · Merchant Insights".
- **History:** confirmations and endings appear on both initiatives.

**States**
- None: "No relationships recorded."
- Target archived: row kept with an "Archived" tag; new links to it are disallowed.
- Inaccessible target: shown per H4.

**Mobile.** Groups become cards. The drawer becomes a full sheet, and initiative search is a full‑screen picker. The impact line wraps and never truncates dates.

### 2.3 Permissions and concurrency

- **Create, confirm or end:** admin, existing PL, or the OWNER of the `from` initiative.
- **Target‑side authority:** creating a link to an initiative requires read access only. The target's owner sees the result, not a request.
- **Viewer:** ✗. The archive guard applies to the `from` initiative.
- Ending and editing the rationale or facts use H3. A concurrent duplicate create hits the unique constraint, and the second request receives the existing row with "Already recorded by Alex Kim."

### 2.4 Acceptance

- **R‑1.** Merchant Insights DEPENDS_ON Instant Settlement Payout, with the provider TARGET_LIVE (Phase 1) and the needed‑by NEXT_MILESTONE. The dates are 29 Oct and 22 Oct, so the impact appears on the Brief, Roadmap and Home for B's owner. When the provider date is set to 20 Oct, the impact disappears.
- **R‑2.** When the provider Target Live is Unknown, the UI shows "Impact not assessed". No Home row appears.
- **R‑3.** Self, duplicate‑active, PART_OF‑cycle and cross‑org inserts are all rejected server‑side. A RELATIONSHIP proposal left unconfirmed is absent from the Brief and Roadmap.
- **R‑4.** A MEMBER who is not the owner is denied a crafted create. Ending a relationship preserves the row and emits history on both initiatives.

**P1‑8: FREEZE APPROVED.**

---

## 3. P1‑9 Initiative History

### 3.1 Canonical schema decision

**New table `initiative_events`** (append‑only; no UPDATE or DELETE grants at the DB role level):

| Column | Notes |
|---|---|
| `id`, `organization_id`, `initiative_id`, `seq` | `seq` is per initiative |
| `type` | controlled enum, listed below |
| `subject_ref_type`, `subject_ref_id` | |
| `summary_json` | display‑safe from/to; no raw payloads |
| `rationale` | |
| `actor`, `at`, `client_request_id` | |

**Controlled `type` values**
- CREATED, STAGE_CHANGED, OWNER_CHANGED, CONTEXT_CHANGED
- DELIVERY_FACT_CHANGED, ACTUAL_LIVE_RECORDED
- SOURCE_LINKED, SOURCE_UNLINKED
- KNOWLEDGE_CONFIRMED, DECISION_FINALIZED, FINDING_DEFERRED, FINDING_DISMISSED, FINDING_REOPENED
- ACTION_CREATED, ACTION_COMPLETED, ACTION_CANCELLED
- BLOCKER_SET, BLOCKER_CLEARED
- MEETING_ADDED
- RISK_STATUS_CHANGED, QUESTION_OPENED, QUESTION_ANSWERED
- RELATIONSHIP_CONFIRMED, RELATIONSHIP_ENDED
- WEEKLY_FINALIZED, ARCHIVED, RESTORED

**How events are written**
- Events are written in the same transaction as their command (G5).
- `FINDING_REOPENED` is derived at read time from `effectiveDisposition`. It is not written by an evaluator.

**Baseline history.** There is **no backfill and no rewrite**. Pre‑mission stage changes, delivery revisions, decisions and Finals are surfaced through read‑time adapters over their existing immutable tables, merged by `at` and de‑duplicated on subject reference.

**Excluded from product history:** raw audit logs, reads, proposal creation, rejections, retries and cosmetic edits.

### 3.2 UX

**Entry points**
- Initiative **History** tab (doc 06 §1)
- Brief "Recent history" (last 5 events) → "Full history →"
- Links from every object detail

**Layout**
- A vertical timeline grouped by week ("Week 41 · 6–12 Oct").
- Each event row shows:
  - Icon plus a text type label
  - A sentence, e.g. "Target Live moved 15 Oct → 22 Oct 2026 (Phase 1)"
  - Actor and time
  - Rationale in a quote style
  - A link to the object
  - Provenance: "from Steering sync, 6 Oct"
- Filter chips (multi‑select, AND with text): Delivery · Decisions · Knowledge · Commitments · Risks & questions · Sources · Relationships · Lifecycle.
- A Weekly Final event links to the Final exactly as stored.
- Loading is paginated at 50 events per page with **[Load earlier]** (cursor on `seq`). There is no infinite load of full payloads.

**States**
- New initiative: "Created by Jordan Lee, 1 Oct. Changes will appear here."
- Filtered empty: "No events match these filters. [Clear]"
- Load error: "Couldn't load history. [Retry]"
- Archived: history remains fully readable, with the archive event at the top.

**Mobile.** A single‑column timeline. Week headers are sticky. Filters open in a sheet showing an active count ("Filters · 2"). Rationale is collapsed to 2 lines with "More".

**Accessibility.** The timeline is an ordered list. Each item has a type label as text, not icon‑only.

### 3.3 Permissions and concurrency

- **Read:** anyone who can read the initiative.
- **Write:** no user write command exists. Events are written only by the host command.
- Each event is linked to the host's committed revision, so a conflict in the host command writes no event.
- `seq` is allocated under the initiative row lock, so there are no gaps or duplicates under concurrency.

### 3.4 Acceptance

- **H‑1.** An end‑to‑end run produces, in order: CREATED, SOURCE_LINKED, KNOWLEDGE_CONFIRMED, DELIVERY_FACT_CHANGED (with rationale), ACTION_COMPLETED, RELATIONSHIP_CONFIRMED and WEEKLY_FINALIZED. Pre‑mission stage events appear through the adapter without duplicates.
- **H‑2.** A rejected proposal, a retried reading and a 409 conflict produce no events.
- **H‑3.** An UPDATE or DELETE on `initiative_events` fails at the DB role level. The linked Final is byte‑identical.
- **H‑4.** With 300 events, the first page returns 50 within the performance baseline. Filters and keyboard navigation work at 390 with no overflow.

**P1‑9: FREEZE APPROVED.**

---


Editorial note: Output stopped during P1-10. Only complete P1-7/8/9 freeze verdicts retained. P1-10 pending separate response.
