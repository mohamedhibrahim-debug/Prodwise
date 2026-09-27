# Prodwise Second Mission: Contract Freeze for P1‑10 Canonical Risks and Open Questions

**Author:** Claude, Product/UX Design Lead · **To:** Codex · **Baseline:** `4623810d`

**Authority.** P0‑1 to P0‑6, A1, G1–G10, doc 06 §1 and H1–H5 are binding. This section only extends them. It adds no global navigation and promises no connector. **No rendered review is claimed.** Screenshots at 390, 768, 1024 and 1440, my rendered review and the red team are still required. All examples are synthetic Demo content.

---

## 4. P1‑10 Canonical Risks / Open Questions

### 4.1 Canonical schema decision

**Risk: tracking extends a claim; there is no second risk store.**
- The risk *statement* remains a Knowledge `RISK` claim.
- **`risk_tracking`** holds status, one row per claim:

| Column | Notes |
|---|---|
| `id`, `organization_id`, `initiative_id` | |
| `claim_id` | UNIQUE. FK to a same‑initiative `RISK` claim that is ACTIVE and confirmed or verified by the Knowledge service at write time. |
| `status` | `OPEN` · `MITIGATING` · `ACCEPTED` · `CLOSED` |
| `owner_member_id` | Nullable. Must be an active, non‑Viewer, scoped member. |
| `mitigation_text` | Nullable, up to 500 characters |
| `mitigation_action_id` | Nullable FK to `actions` in the same initiative |
| `created_by`, `created_at`, `updated_at`, `revision` | |

- **`risk_tracking_events`** is append‑only. It has no UPDATE or DELETE grants.
- **Source** is derived from the claim's provenance and is not copied.
- **Untracked confirmed claims** display a derived "Open · not tracked" state at read time (H1). Nothing is stored for them.
- **Unverified claims** show "Awaiting verification" and cannot be tracked.
- **Superseded claims.** When a claim is superseded, its tracking stays on the old claim. The UI shows "Statement superseded" with **[Carry tracking forward]**, an explicit command that creates tracking on the new claim. Tracking is never moved silently.
- **Moving to `ACCEPTED` or `CLOSED` requires a reason.**
- **Tracking never edits claim text.**

**Open question: an unresolved tracked item, never truth.**
- **`open_questions`** columns:

| Column | Notes |
|---|---|
| `id`, `organization_id`, `initiative_id` | |
| `question` | 1–300 characters |
| `owner_member_id` | Nullable |
| `expected_confirmer_text` | Nullable. Never resolved to a member. |
| `due_date` | Nullable |
| `status` | `OPEN` · `ANSWERED` · `WITHDRAWN` |
| `origin` | `HUMAN_ENTRY` · `CONFIRMED_AI_PROPOSAL` · `MEETING` · `WEEKLY_REVIEW` |
| `origin_ref_type`, `origin_ref_id`, `evidence_anchor_id` | |
| `answer_claim_id` | Nullable FK |
| `answer_note` | Nullable |
| `created_by`, `created_at`, `resolved_by`, `resolved_at`, `revision` | |

- **`question_events`** is append‑only.
- `UNIQUE(origin_ref_type, origin_ref_id)` applies to proposal and Weekly‑line origins.
- **Answering** is always an explicit command, by one of two routes:
  - **Answer note.** Shown as "Answer note — not in Knowledge". It never feeds conflicts, delivery or the Brief truth.
  - **Linked answer.** `answer_claim_id` must point to a claim that is confirmed or verified by the Knowledge service. **Record the answer as a fact** creates that claim through the existing Knowledge command, under verification authority (A1.10), in the same transaction.
  - An unverified claim can never be linked.
- **`WITHDRAWN`** means "no longer relevant" and requires a reason.
- **History enum, additive only.** `QUESTION_WITHDRAWN` and `RISK_TRACKING_STARTED` are added to the P1‑9 enum. P1‑9 semantics are otherwise unchanged.

### 4.2 UX

**Entry points (no new tab, no register beyond the contextual list):**
- Brief section "Risks & open questions", showing up to 3 of each, with **View all →** opening `/initiatives/[slug]/context`.
- The Knowledge `RISK` claim detail, which offers **[Track this risk]**.
- Proposal cards in the P0‑4 workbench and in meeting notes. These use the existing workbench; nothing separate is built.
- A Weekly Draft line offers **Record open question**, which opens a preview followed by **[Confirm question]**.
- Home and Search, as below.

**Context page (desktop).** Two stacked sections. There are no tables.

**Risks**
- Grouped as **Open · Mitigating · Accepted · Closed (collapsed)**.
- Each card shows:
  - The claim text, linked to the claim
  - A status chip with icon and text
  - The owner, or "No owner recorded"
  - The mitigation line with its commitment link, or "No mitigation recorded"
  - The source chip, linked to the evidence span
  - "Updated 6 Oct"

**Questions**
- Grouped as **Open (overdue first) · Answered · Withdrawn (collapsed)**.
- Each card shows:
  - The question text
  - The owner or expected confirmer
  - The due date, e.g. "Overdue 2 days"
  - Its origin chip
  - When answered: the answer, labelled either "Verified fact →" or "Answer note — not in Knowledge"
- The composer reads "Ask an open question…".

**Integration**
- **Home:** overdue open questions only, routed to the question owner, or to the initiative OWNER when unassigned. These rows fall under the doc 06 cap of 5.
- **Weekly Draft:** a "Risks & questions" delta covering status changes, questions opened or answered, and overdue open questions. Finals carry this delta only under the next `schemaVersion` (H5).
- **Meeting Intelligence:** an Open question proposal creates `open_questions` with origin `MEETING`. A confirmed Risk claim then offers **[Track this risk]** as a separate explicit click.
- **Search:** risk claim text and question text are indexed, per doc 06.

**States**

| State | Copy |
|---|---|
| Empty | "No risks recorded." / "No open questions." Neither is ever shown as healthy. |
| Load error | "Couldn't load risks and questions. [Retry]". Other Brief sections still render. |
| Save error | Inline "Not saved — [Retry]". The user's input is kept. |
| Archived | Read‑only, per G3 |
| Viewer | Read‑only, with reasons shown |

**Mobile**
- A segmented control: "Risks (n) | Questions (n)".
- Full‑width cards.
- Status changes and answering open bottom sheets with 44px options.
- The composer is a sticky "Ask a question" button that opens a full sheet.
- No horizontal overflow at 390.

### 4.3 Permissions and concurrency

| Write | Allowed |
|---|---|
| Start or carry tracking; set risk owner or mitigation | Admin, existing PL, initiative OWNER |
| Risk status | Admin, PL, risk owner, initiative OWNER |
| Create question | MEMBER and above |
| Edit question text, owner or due date (while `OPEN`) | Admin, PL, creator, initiative OWNER |
| Answer (note), withdraw or reopen | Admin, PL, question owner, initiative OWNER |
| Record answer as a fact, or link a claim | Existing Knowledge verification authority |

- Record owners gain no Knowledge write (A1.10).
- Viewer ✗. The archive guard applies (G3). Authorization is enforced server‑side with fresh checks.
- Every mutation sends `expectedRevision`. Creates send `clientRequestId`.
- On conflict, the G4 panel appears, for example: "Alex Kim marked this **Answered** at 14:02. Your change wasn't saved." with **[Use my value]** / **[Keep theirs]**. The user's input is preserved.
- A concurrent **Track this risk** hits `UNIQUE(claim_id)` and returns the existing row.
- Events and history are written in the host transaction (G5). A 409 writes nothing.

### 4.4 Acceptance

- **Q‑1.** Synthetic steering notes pasted in the workbench yield a Risk proposal and an Open question proposal. Confirming the question creates `open_questions` (origin `MEETING`) and no claim. Confirming the risk creates a `RISK` claim. **Track this risk**, done by the OWNER, creates `risk_tracking` with status `OPEN` and writes `RISK_TRACKING_STARTED`. Rejected items appear nowhere canonical.
- **Q‑2.** A question answered by note shows "Answer note — not in Knowledge" and affects no conflict or delivery fact. Linking an unverified claim is rejected server‑side. **Record as fact**, done by a verifier, creates a verified claim, sets `answer_claim_id` and `resolved_at`, and writes `QUESTION_ANSWERED`.
- **Q‑3.** Two tabs change a risk's status at the same time. The second tab gets the conflict panel with no silent overwrite. A crafted VIEWER POST and a status POST from a non‑owner MEMBER are denied with no row or event created. Writes on an archived initiative return the archive copy.
- **Q‑4.** An overdue question appears on Home for its owner only. The W41 Draft shows the "Risks & questions" delta, and the W40 Final is byte‑identical. Superseding the risk claim shows **[Carry tracking forward]** and makes no automatic move. At 390 there is no overflow, and the sheets are keyboard‑ and screen‑reader operable.

**P1‑10: FREEZE APPROVED.** This covers the schema, UX, permission, concurrency and acceptance decisions above, including the additive P1‑9 enum values. Rendered review remains outstanding.