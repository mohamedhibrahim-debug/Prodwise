# Binding Amendment A1 to the Prodwise UX Contract (Baseline `4623810d`)

**Author:** Claude, Product/UX Design Lead · **To:** Codex
**Status:** Binding. Where A1 conflicts with the original contract, A1 wins. This is a specification only; nothing has been rendered or reviewed.

---

## A1.1 Phase and context comparison (replaces §7 comparison rule; amends §1.3 R6, §1.4 and §12 step 5)

- Keep the **existing conservative comparison**. Two claims are compared only when both have no context, or both have the **same explicit controlled context**.
- A missing context is **not** compatible with an explicit context. The original §7 sentence "A missing phase is compatible with anything" is deleted.
- Different or unknown effective applicability never creates a contradiction. Where the system cannot compare two claims, it shows "Not compared: applicability differs or is not recorded". This must not read as healthy.
- No change may broaden which claims are matched.

## A1.2 Setup and attention are independent (replaces §1.2 precedence, the "Checks paused" copy and §1.4 Ready copy)

- **Setup status** and **Attention** are two separate columns and chips. Setup incomplete never hides, suppresses or delays existing conflicts, blockers or deterministic checks. The existing checks keep running and keep displaying exactly as they do today.
- **"Not assessed"** means no evaluation has run for this initiative yet. It is unrelated to readiness.
- The Register shows both columns. The combined precedence list and the attention cell text "Checks paused until setup is complete" are both deleted.
- Filters are independent: Setup (Incomplete · Ready) × Attention (Needs attention · No open items · Not assessed), plus Archived.

**Copy replacements**

| Location | Replacement copy |
|---|---|
| §1.4 creation rail | "The initiative exists and appears in Initiatives as Setup incomplete. Existing checks apply immediately. Setup adds the context Prodwise needs to reason about it." |
| Ready card | "**Ready for intelligence.** Prodwise has enough context to begin deeper analysis. This isn't an all‑clear. Open items still appear in Attention. [Open Brief]" |

**Amended S1:** Attention shows whatever the existing checks produce, or "Not assessed". It never shows "0 conflicts" and never shows "paused".

## A1.3 Ownership authority (replaces §1.7 owner rows, §1.4 owner picker, §3 and §12 step 9)

**Who may assign or change the `OWNER`:** org or platform admin, or a holder of the existing **Product Lead** capability. No one else.

**A Member who owns an initiative may not hand off ownership.** This capability is not expanded.

**Owner selection at create.** This is the only exception to the rule above, and it applies only inside create, never to general owner updates.

| Creator | Owner picker behaviour |
|---|---|
| MEMBER (no Product Lead capability) | Owner is fixed to self. Shown as "You (Demo Reviewer)", with no picker. |
| Admin or Product Lead | May self‑assign, or choose another active, non‑Viewer, scoped member. |
| PLATFORM_OWNER without membership in the org | Must choose an existing active, non‑Viewer, scoped member. Self is not offered. |

**R3 wording:** R3 is met when the current `OWNER` fact points to an **active, non‑Viewer, scoped member**.

**Change owner panel (§3).** Shown to authorized users only. Others see the reason "Only an admin or Product Lead can change the owner."

**Unassigned state:** "No owner recorded". R3 is unmet. The original line "attention goes to admins" is dropped unless existing routing already does this.

**Corrections to examples**

- **§3 acceptance:** an ADMIN or Product Lead changes the owner to Taylor.
- **§12 step 9:** "An admin hands ownership to Taylor Morgan with a reason."
- **§11 risk 3:** amended to match this ownership rule.

## A1.4 Rationale and objective (amends §1.3 R5, §1.4 Step 2 and §1.6)

- **Stage changes and every delivery‑fact write require a rationale.** This covers set, change, mark Unknown and clear. The requirement is retained exactly as it exists today; the original "optional rationale" wording is deleted.
- Step 2 gets one required field per save: "Why / where this comes from". The same applies to Unknown, e.g. "Vendor hasn't committed a date".
- **Owner change requires a rationale.** Basics edits (name, business line, objective) do not.
- **R5** is met by a **nonblank trimmed deliberate problem statement**. The 20‑character threshold is removed. Whitespace‑only or placeholder‑only text is Missing.

## A1.5 Controlled contexts, replacing the phase list (amends §1.3 R6, §1.4, §1.6 and §7)

- The system never generates a phase list. Each initiative has **simple, initiative‑scoped controlled contexts**. A human creates each label (for example "Phase 1 — Card settlement"), and labels can be renamed or retired, never deleted.
- **R6** is met when the initiative has a **current controlled context** selected. A scope note is optional.
- **Legacy phase strings** are preserved verbatim and shown as "Legacy scope: '…' (not a controlled context)". A single human action, "Create context from this", is allowed. There is no bulk guessing and no auto‑mapping.
- On its own, a legacy string does not satisfy R6. This regression is safe because A1.2 guarantees that setup status suppresses nothing.
- **P0‑1 introduces only the schema and the Setup/Manage UI for contexts.** Trust matching and digest semantics for contexts are delivered in P0‑6, in the correct order, under A1.1.

## A1.6 Sources (amends §1.5 and §2)

**Canonical item identity:** `(organization, provider, workspace/container, normalized reference)` is unique. Two identical keys in different containers are different items.

**Jira fields are separate:**

- Project **key** `PAY`: identity, and used to check key format.
- Project **display name** `PAYMENTS`: a label only.

**Validation copy:** "PAY‑9X doesn't match the key format for project PAY." There is no lookup and no implied external validation.

**Sources are initiative‑local.** They are not an existing global library.

- The phrase "existing Sources library (both URL forms)" is deleted.
- `/sources/[id]` is a **contextual route with no nav item**. It is reached from an initiative's Sources list, from evidence and from search.
- The "Supports:" list on that page shows only same‑org initiatives the viewer can read.

**Amended S4:** reuse happens only on a matching full identity tuple.

## A1.7 Evidence processing honesty (replaces the §5 processing copy)

There are no background‑completion promises unless a durable job with recovery exists. It does not exist for the MVP, and no new infrastructure is required.

**MVP behaviour**

- Submitted text is persisted first.
- Proposals are persisted as they are produced.
- Statuses: `Saved` · `Reading…` · `Proposals ready` · `Timed out` · `Failed` · `Stopped`. Every failure state offers [Retry].

**Copy:** "Your text is saved. If you leave this page, reading may stop. You can return and retry. Nothing is added to truth until you confirm."

## A1.8 Archive (amends §1.9, §1.10 and S10)

**What archive means:** all data is preserved, and the business state becomes read‑only. There is no delete endpoint or control anywhere.

**Read‑only guards apply server‑side to every entry point, including old ones:**

- `stage.ts`
- delivery facts and Unknown
- Knowledge create and confirm
- decision outcomes
- actions
- evidence submit and confirm
- source link, unlink and role change
- owner changes
- context edits

Each guarded write returns "Archived — restore to edit. Nothing was changed."

**Weekly Review**

- Existing Finals remain byte‑identical.
- The next Draft may show the transition ("Archived this week · reason"), carrying the prior state.
- Later Drafts exclude the initiative. Historical entries are never omitted or rewritten.
- The original wording "leaves future Weekly Review drafts" is amended accordingly.

## A1.9 Decision dispositions and digest (replaces the §6 semantics)

- **The outcome is not part of its own source content digest.** This prevents immediate self‑invalidation. The original statement "The digest includes the outcome" is deleted.
- **Dismiss and Defer** are bound to the underlying content digest they were recorded against. A dismissal persists while that digest is unchanged. The finding reopens when the digest changes, with the copy "Reopened: evidence changed since dismissal on 3 Oct".
- **Real decision re‑emergence keeps the existing semantics**, including the case where the original digest later returns.
- **Deferred expiry** is evaluated with an explicit `asOf` time parameter outside the pure rule comparison. Rule comparison never reads the clock.

## A1.10 Confirmation authority (amends §1.7 confirm, risk and action rows, and §5 / §10)

- **Confirm or reject** inherits the target domain's existing policy:
  - Knowledge uses existing Knowledge verification authority.
  - Delivery and stage use their existing authority, plus a rationale.
  - Owner proposals use A1.3.
  - Decisions use existing decision authority.
- **Action assignees and risk or question owners** may update only their own record's status. They gain no Knowledge write.
- **"Record the answer as a fact"** requires existing Knowledge verification authority.
- **No confidence score** is shown anywhere.
- **An exact anchored quote is mandatory.** The server verifies that the quote exactly matches the stored text at its anchor. Proposals without a verified quote are discarded and never shown.

---

## A1.11 Corrected invariants

### Initial creation (one server transaction, idempotent on `(org, clientRequestId)`)

1. The initiative row is created with name, business line and initial stage.
2. `OWNER` fact revision 1 is written per the A1.3 create exception. There is no owner column.
3. An optional objective is saved, and an optional current controlled context, created in the same transaction if new.
4. A `created` history event is written.
5. Readiness is derived and never stored. The Register may show 4 of 10 up to 6 of 10.
6. Initial stage provenance follows existing create semantics unchanged. Later stage changes go through `stage.ts` with a rationale.
7. A replay returns the original initiative. A failure writes nothing.

### Unknown versus Missing

- **Unknown** is a delivery‑fact revision recording who, when and the required rationale.
- **Missing** means no revision, or a cleared value. Missing never satisfies a requirement.
- Unknown is never "0", never "failed" and never an implied risk.

### Scope persistence

- The current context is stored as a reference to an initiative‑scoped controlled context ID.
- Legacy phase or scope strings stay untouched in their existing field.
- Context changes and scope‑note changes create history events (from → to).
- Context labels are never deleted, so historical references always resolve.

---

## A1.12 Corrected per‑write matrix (replaces §1.7 rows; "PL" means the existing Product Lead capability)

| Write | Plat/Org Owner, Admin | PL | Member | Viewer |
|---|---|---|---|---|
| Create initiative | ✓ ¹ | ✓ ¹ | ✓ ¹ | ✗ |
| Edit basics (name, business line, objective) | ✓ | existing | Owner ² | ✗ |
| Stage change | ✓ ³ | existing ³ | Owner ²³ | ✗ |
| Assign or change `OWNER` | ✓ ⁴ | ✓ ⁴ | ✗ | ✗ |
| Delivery facts and Unknown | ✓ ³ | existing ³ | Owner ²³ | ✗ |
| Create, select or rename context | ✓ | existing | Owner ² | ✗ |
| Add or link source, change role | ✓ | ✓ | ✓ | ✗ |
| Unlink source (reason required) | ✓ | existing | Owner or linker | ✗ |
| Archive or restore | ✓ | existing ⁵ | ✗ | ✗ |
| Confirm or reject proposal | target domain ⁶ | target domain ⁶ | target domain ⁶ | ✗ |
| Decision outcomes | existing | existing | existing | ✗ |
| Action status | ✓ | ✓ | assignee, owner or creator ⁷ | ✗ |
| Risk or question status | ✓ | ✓ | record owner or owner ⁷ | ✗ |

**Footnotes**

1. Owner selection at create follows A1.3 only.
2. "Owner" means the current canonical `OWNER`. This mirrors the existing "assigned PM" authority and is not a broadening.
3. A rationale is mandatory.
4. There is no Member hand‑off. The target must be an active, non‑Viewer, scoped member.
5. The existing PL capability applies only if PL already holds it. Otherwise PL is ✗.
6. Target‑domain policy applies with no elevation. The anchor must be verified.
7. This covers record status only and grants no Knowledge write.

**Rules for all rows**

- Every write takes a fresh access check server‑side.
- All rows are blocked on archived initiatives (A1.8).
- Guest Demo sessions follow the existing Demo guards.
- In the UI, a control the user can't use shows its reason instead.

---

## A1.13 Coherence check and decision

- **P0‑1 (§1 as amended, with S1, S4 and S10 corrected per A1.2, A1.6 and A1.8)** is internally consistent:
  - Setup status never gates or masks checks.
  - Ownership authority is not expanded.
  - The rationale requirements are retained.
  - Contexts are human‑created, and P0‑6 semantics come later.
  - Sources carry honest identity and scope.
  - Archive is a guarded, read‑only state.
- **P0‑2 (§3 as amended by A1.3)** has an authority model that is consistent with the matrix and the create exception.
- **Capabilities 3–10 remain drafts.** Each is corrected by A1.7, A1.9 and A1.10 as applicable and must be frozen separately before implementation.
- **No rendered review is claimed.** Screenshots at 390, 768, 1024 and 1440 are still required before P0‑1 or P0‑2 is marked complete.

**FREEZE APPROVED WITH THESE AMENDMENTS** for P0‑1 and P0‑2 only.