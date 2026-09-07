# Prodwise — Phase 3 review screenshots

**Product Memory**, plus the Phase 2 evidence-form fix.

Captured from the **production build** (`next build` + `next start`) over the Chrome DevTools Protocol, using `Emulation.setDeviceMetricsOverride` so 375 px is genuinely 375 CSS px, and `Page.captureScreenshot` with `captureBeyondViewport` for true full-page output. Device scale factor 2, so each image is 2× the CSS size listed.

| # | Route | Viewport | File | CSS page size |
|---|---|---|---|---|
| 01 | `…/memory` (Decisions) | 1440 px | `01-product-memory-decisions-desktop-1440.png` | 1440 × 900 |
| 02 | `…/memory?view=claims` | 1440 px | `02-product-memory-claims-desktop-1440.png` | 1440 × 2083 |
| 03 | `…/memory/new` | 1440 px | `03-add-claim-desktop-1440.png` | 1440 × 1460 |
| 04 | `…/memory/c-2/edit` | 1440 px | `04-edit-claim-desktop-1440.png` | 1440 × 1651 |
| 05 | `…/memory?view=requirements` | 1440 px | `05-superseded-claim-with-replacement-desktop-1440.png` | 1440 × 1155 |
| 06 | `…/memory?view=risks` | 1440 px | `06-claim-with-multiple-evidence-desktop-1440.png` | 1440 × 900 |
| 07 | `…/evidence/new` | 1440 px | `07-evidence-boundary-help-desktop-1440.png` | 1440 × 1185 |
| 08 | `…/memory?view=requirements` | 1440 px | `08-excluded-evidence-preserved-desktop-1440.png` | 1440 × 1155 |
| 09 | `…/memory?view=claims` | 375 px | `09-product-memory-mobile-375.png` | 375 × 3457 |
| 10 | `…/memory/new` | 375 px | `10-add-claim-mobile-375.png` | 375 × 1969 |
| 11 | `…/memory/c-2/edit` | 375 px | `11-edit-claim-mobile-375.png` | 375 × 2172 |

No page has horizontal overflow at either viewport.

---

## What is now real, and what is still synthetic

| Layer | State |
|---|---|
| **Evidence** | Real, persisted, human-owned (Phase 2) |
| **Product Memory** | **Real, persisted, human-owned (Phase 3)** |
| Review — including the 27-vs-30 conflict | Still a synthetic fixture |
| Readiness · Current State · Needs Your Attention · Next Best Action | Still synthetic fixtures |

**There is no AI extraction, and no inference of any kind.** Every claim on screen is either one of the 14 migrated demo records or something a person typed into the form. Nothing was generated from evidence, and nothing derived from Product Memory feeds anything else.

The clearest demonstration is in screenshot 05/08: the two Daily Repayment claims — divisor **27** and divisor **30** — sit next to each other as plain `ACTIVE` requirements. **The product says nothing about them being in tension.** Review still shows that conflict, from its Phase 1 fixture. Deriving it from the claims belongs to a later phase, and until then asserting it here would be a conclusion nothing established.

---

## What the screenshots demonstrate

**Structured knowledge, not a document store (01, 02, 09).** Five approved views with unchanged semantics — Decisions `DECISION`; Requirements `REQUIREMENT + BUSINESS_RULE`; Risks `RISK`; Dependencies `DEPENDENCY`; Claims all types, with `ASSUMPTION` visible there. Counts are preserved from Phase 1 exactly: **3 / 5 / 2 / 2 / 14**. Each row leads with subject · attribute · value, then type, status, domain, phase; provenance and confidence follow.

**Evidence provenance (06).** A claim may cite zero, one or many evidence records, and one record may support several claims. The Repayment Reconciliation risk cites both MFF-133 and MFF-118. Directly above it, Merchant Concentration honestly reads **"No evidence linked"** — never *"no evidence exists"*. An unlinked claim is unverified, not wrong.

A link records only *"this claim is linked to this evidence."* There is deliberately **no role taxonomy** — no SUPPORTS / CONTRADICTS / INVALIDATES. Characterising a relationship is interpretation, which this phase does not do.

**Supersession (05).** *Traditional + Islamic Financing* is struck through, marked `SUPERSEDED`, and shows **Superseded by Islamic Financing Only**. The reverse relation is derived, not stored twice. Nothing is deleted — there is no Delete anywhere in the UI. A claim may be superseded with **no** known replacement; the system never invents a successor.

**Excluded evidence is preserved, not erased (08).** MFF-118 was excluded *after* the divisor-27 claim already cited it. The link survives, is marked **Excluded evidence**, and the claim's status is untouched. Excluded evidence cannot be chosen as a *new* link, but removing an existing one is only ever a deliberate human unlink — dropping it automatically would rewrite provenance history.

**Human correction (03, 04, 10, 11).** Add Claim asks only for the knowledge: type, subject, attribute, value, domain, optional phase and evidence. No status picker and no confidence — a new claim is always `UNVERIFIED`, because nobody has checked it yet. Edit adds status, superseded-by and link management. Confidence is shown read-only on migrated records; it is never assigned by hand.

**Phase 2 fix (07).** The boundary help text under Add/Edit Evidence now follows the selected boundary. It previously showed the Current Scope wording for all five values.

---

## Integrity

Claim mutations and evidence links both prove initiative ownership **server-side at the mutation boundary**, extending the guard proven in the Phase 2 hotfix. `claimId`, `evidenceId` and the initiative slug all arrive from client-controlled input and none is trusted. Verified by driving the real Edit form with a tampered hidden `claimId` and an injected foreign evidence checkbox: both were rejected, nothing was written, and no activity was logged.

## Local persistence limitation

Persistence is the local JSON store (`.data/prodwise.json`), used because the Supabase free-plan project limit is still in force. It is **local demo persistence only** — single-process, last-write-wins, and not distributed, serverless or multi-instance safe. It survives a local server restart and nothing more. Migrations for the same schema are committed under `supabase/`, and the Supabase adapter implements the identical interface.
