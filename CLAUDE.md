# PRODWISE — Project Memory & Product Constitution

> **This file is the persistent context for every Claude Code session in this repository.**
> Read it fully before making product, UX, data-model or architecture decisions.
> It outranks convenience, habit, and anything you infer from the reference files in the repo root.

---

## 1. Identity

| | |
|---|---|
| **Product name** | **Prodwise** |
| **Tagline** | Product Intelligence, from evidence to action. |
| **Core capability** | **Initiative Intelligence** — the engine concept, *not* the product name |

**Initiative Intelligence** is the reasoning capability: a structured Product Initiative Workspace that reconstructs scattered product truth across Jira, documents, decisions and approvals into persistent Product Memory, evidence-backed Current State, Readiness, and one recommended Next Best Action.

All user-facing branding, page metadata, `package.json`, and documentation say **Prodwise**. "Initiative Intelligence" may be used to describe the capability, never as the product's name.

### Vision

Give Product Managers a continuously updated, evidence-backed understanding of where an initiative really stands, what is unresolved, and what should happen next.

### Job To Be Done

> "Tell me the current evidence-backed state of this initiative, show me what needs my attention, and recommend the most important next action."

### Prodwise is not a chatbot

The primary experience is a **structured Product Initiative Workspace**. AI reasoning surfaces through:

- Current State
- Product Memory
- Review Findings
- Evidence
- Readiness
- Next Best Action

An **AI Consultant** may exist later as a secondary side panel only. **Chat must never become the main product experience, and there must never be a chat homepage.**

---

## 2. The problem

Product truth is fragmented across Jira, requirement documents, meeting notes, decisions, approvals, future phases and implementation work.

A Jira status alone does not tell a Product Manager whether a product is actually **Defined, Approved, Built, Tested, Release Ready, Live or Healthy**.

Prodwise reconstructs that scattered evidence into persistent **Product Memory** and a **Current Product State**.

---

## 3. Target user

**Primary:** Product Manager / Product Owner in complex enterprise environments.

**Best fit:** Fintech · Banking · Enterprise Software · Regulated Products.

**Typical characteristics:** multiple teams; multiple stakeholders; Jira-based delivery; business/product documentation; Finance / Security / Compliance / Risk dependencies; multiple phases and releases.

**Do not optimise the MVP for small startup teams.**

---

## 4. Core differentiation

The differentiation is **not** "multiple AI personalities". It is:

1. Persistent Product Memory
2. Initiative Reconstruction
3. Cross-Artifact Consistency
4. Evidence-Based Readiness
5. Multi-Dimensional Product State
6. Human-Correctable AI Reasoning
7. Next Best Action

All reasoning must operate over the **same persistent Product Context**.

---

## 5. Golden user flow

Every MVP feature must support this workflow:

```
Create Initiative
 → Add / Discover Evidence
 → System identifies potentially related artifacts
 → User confirms Initiative Boundary
 → System reconstructs Product Context
 → System extracts structured Product Memory
 → System detects material conflicts, gaps, unknowns and superseded information
 → System evaluates readiness
 → System determines Current State
 → System recommends ONE primary Next Best Action
 → User resolves or corrects findings
 → Product Memory updates → Readiness updates → Next Best Action updates
```

---

## 6. Scope

### MVP scope (the eventual whole — built in phases, not now)

1. Initiative Workspace
2. Evidence Management
3. Jira Evidence
4. Google Drive Evidence
5. Initiative Boundary / Evidence Classification
6. Structured Product Memory
7. Product Review Engine
8. Current State
9. Readiness Engine
10. Next Best Action
11. Human Override / Resolution
12. Secondary AI Consultant

### Strictly out of scope — do not add without explicit approval

Figma integration · GitHub semantic implementation analysis · Gmail · Slack · Microsoft Teams · meeting recording · meeting transcription · production monitoring integration · BI integrations · Jira automatic write-back · autonomous multi-agent conversations · portfolio analytics · complex workflow automation · graph database · microservices · Kafka or complex event infrastructure.

> **Do not silently add features because they seem useful.** If something feels missing, say so and ask. Scaling scope up is the user's call, not yours.

---

## 7. Product lifecycle

```
DISCOVERY · DEFINITION · ALIGNMENT · DELIVERY · VALIDATION
RELEASE_PREPARATION · LIVE_VALIDATION · MONITORING
```

**Do not implement this as a rigid waterfall wizard.** An initiative may move backward, reopen, split into phases, contain multiple delivery streams, or have technical implementation complete while release remains blocked.

---

## 8. Product truth rules

These are the product's conscience. Violating one is a defect, not a style choice.

**RULE 1 — Jira is a System of Execution, not the whole Product Truth.**
A Jira item marked *Done* or *Ready For Deployment* does not automatically mean Approved, Release Ready, Live, or Healthy.

**RULE 2 — Backlog Scope is not Release Scope.**
An unfinished Jira item only blocks the current release when it belongs to the **active release scope**.

**RULE 3 — UNKNOWN is a valid state.**
If evidence is insufficient, say `UNKNOWN`. Never manufacture certainty.

**RULE 4 — Absence of evidence is not evidence of absence.**
Never write *"Compliance approval is missing."* when the system only knows *"No Compliance approval evidence was found in connected sources."* This distinction must survive into UI copy.

**RULE 5 — Historical information stays available.**
If a requirement changes, do not delete the old one. Mark it `SUPERSEDED` when appropriate.

**RULE 6 — AI conclusions must be human-correctable.**
Users must eventually be able to correct: Initiative Boundary · Evidence classification · Phase · Conflict classification · Supersession · Readiness assumptions. Corrections become structured Product Memory.

**RULE 7 — Conflict detection must be conservative.**
Different values may mean true contradiction, supersession, a different phase, environment, customer segment or channel, draft vs approved, or simply historical information. **Do not flood the user with false conflicts.**

**RULE 8 — AI should feel native.**
Do not scatter "Analyze with AI" buttons. The application itself is already intelligent. No AI-sparkle iconography.

---

## 9. Initiative resolution

**Do not assume Initiative = Jira Epic.** A single business initiative may contain a Portfolio Item, Jira Epic, Change Request, Story, Bug, Requirement Document, Meeting Note, Decision, or Future Phase.

Resolution may eventually use exact references, Jira relationships, aliases, semantics, shared systems, dates and terminology. **The user must always be able to confirm the Initiative Boundary.**

**Evidence relationship classifications:**
`CURRENT_SCOPE` · `FUTURE_PHASE` · `HISTORICAL` · `RELATED` · `EXCLUDED`

---

## 10. Product Memory

Structured knowledge extracted from evidence.

**Claim types:** `REQUIREMENT` · `DECISION` · `BUSINESS_RULE` · `RISK` · `DEPENDENCY` · `ASSUMPTION`

**Claim statuses:** `ACTIVE` · `SUPERSEDED` · `DRAFT` · `REJECTED` · `DEFERRED` · `UNKNOWN` · `UNVERIFIED`

A claim should eventually support: subject · attribute · value · domain · source · source date · effective date · phase · status · confidence · relationships.

```
Subject: Daily Repayment   Attribute: Calculation Divisor   Value: 27
Domain: Finance            Phase: Phase 2                   Status: ACTIVE
```

Product Memory must read as **structured knowledge, not a document browser**.

---

## 11. Review engine

**Finding types — exactly these five. Do not grow the taxonomy.**
`CONFLICT` · `GAP` · `UNKNOWN` · `SUPERSEDED` · `RISK`

A `CONFLICT` is only raised after establishing **all** of: same subject · same attribute · same relevant context · same active phase · both active · incompatible values. Always evaluate possible supersession or scope difference **first** (Rule 7).

---

## 12. Product state

State is **multi-dimensional**. Possible domains: Product · Technical · Delivery · QA · Finance · Security · Compliance · Risk · Operations · Data · External Partner · Release.

**Only relevant domains appear.** Do not render every possible domain for every initiative.

**Assessment states:** `READY` · `AT_RISK` · `BLOCKED` · `UNKNOWN`

**Never generate arbitrary percentage readiness** such as "83% Ready". Factual gate counts are acceptable.

### Initial domain activation

| Archetype | Domains |
|---|---|
| **Lending** | Product · Technical · QA · Finance · Risk · Compliance · Operations |
| **Payments / Wallet** | Product · Technical · QA · Finance · Security · Operations |
| **Internal tool** | Product · Technical · QA · Operations |
| **Reporting** | Product · Data · QA · Finance *(only if financially relevant)* |

---

## 13. Readiness

Readiness must be **evidence-backed, not checkbox theater**. Finance readiness may depend on fund flow, settlement, reconciliation, fees, repayment, reversals, accounting, exception handling and reporting.

Each domain presents: **Status · Evidence Satisfied · Open Issues · Unknown · What Would Make This Ready.**

**Approval and readiness are not always the same thing.**

---

## 14. Next Best Action

Recommend **ONE** primary next action.

**Ranking:** 1. Critical blocker → 2. Mandatory unresolved unknown → 3. High material risk → 4. Blocking dependency → 5. Improvement.

Every recommendation explains: **Action · Why Now · Evidence · Impact if Ignored · Suggested Owner / Domain · Confidence.**

Avoid generic advice such as *"Align with stakeholders."*

---

## 15. Information architecture

```
Initiatives  (main level)
└── Initiative Workspace
    ├── Overview
    ├── Review
    ├── Product Memory
    ├── Evidence
    └── Readiness

AI Consultant — secondary side panel only
```

**Never create Chat as the primary screen.**

---

## 16. Design law

### Reference material

`Aman - Presentation Deck 3.0 (1).pptx` in the repo root is **visual inspiration only** — never a brand template. `claude-code-palybook final.html` is a **development workflow / skills reference only**. Neither overrides this constitution. **Never move, rename, overwrite or delete either file.**

Extracted from the deck (source palette, for inspiration): navy `#002A47` / `#091A33`, cyan `#00AEC7`, light cyan `#99DBE9`, pale `#CAE1E8`, orange `#DC6B2F`; typeface **Inter**; a dramatic 50pt→6pt type range; thin rule dividers; numeric section markers; `blockArc` / `pie` / `ellipse` geometry.

### The 30 / 70 rule

Approximately **30% AMAN visual DNA, 70% brand-neutral enterprise Product Intelligence design.** Prodwise must work inside AMAN, outside AMAN, and for other fintechs, banks and enterprises.

**Retain as inspiration:** deep navy structural surfaces · bright cyan/teal identity accent · restrained warm orange accent · clean white working surfaces · strong typography · generous whitespace · thin separators · bold section hierarchy · rounded status pills · dark navigation against a light working canvas · subtle circle / arc / ring geometry.

**Never use:** the AMAN logo · the Raya logo · AMAN proprietary marks · merchant/POS photography as product identity · AMAN layouts copied directly · any treatment that makes Prodwise look like an AMAN internal portal.

### Colour: brand identity and semantic status are different concepts

| Role | Value |
|---|---|
| Primary brand accent | cyan / teal `--accent-500` |
| Secondary brand accent | warm orange — **decoration only** |
| `READY` | green |
| `AT_RISK` | amber |
| `BLOCKED` | red |
| `UNKNOWN` | neutral grey |

**Brand orange never carries status meaning.** It is restricted to non-semantic decoration (the arc motif, section numerals). The `AT_RISK` amber is deliberately a different hue from the brand orange so the two are never confused. **Status must be legible independently of branding**, and never encoded by colour alone — always colour + text (+ severity glyph).

### The Initiative Arc — original visual signature

A thin concentric ring of eight segments, one per lifecycle stage; the current stage in cyan, the remainder in rule-grey. It reinterprets the deck's arc geometry as something *information-bearing*.

It is a **subtle supporting lifecycle/brand motif**. It must **never** compete visually with Current State, Needs Your Attention or Next Best Action, and must **never** become a hero graphic. Maximum ~28px in the workspace header, 16px as the nav-rail product mark, plus one faint oversized arc bleeding off the rail footer. **It must never resemble the AMAN logo.**

### UX character

Should feel: Enterprise · Intelligent · Calm · Confident · Modern · Distinctive · Trustworthy · Information-rich without clutter.

Should **not** feel like: Jira · Power BI · a generic admin dashboard template · a generic AI chatbot · a startup marketing landing page · an AMAN internal portal.

### Layout principles

**Prefer:** dark navy navigation rail · light primary workspace · typography-led hierarchy · large clean working surfaces · structured rows · thin dividers · restrained use of cards · progressive disclosure · compact evidence components · strong information hierarchy · subtle micro-interactions.

**Avoid:** card inside card inside card · giant rounded rectangles everywhere · excessive shadows · excessive gradients · glassmorphism · AI sparkle iconography · excessive dashboards · unnecessary charts.

Structure is carried by **1px rules and whitespace, not cards**.

### The five-second test

The Overview must answer, within about five seconds:
1. Where is this initiative? 2. What needs attention? 3. Why? 4. What should I do next?

### Empty-state language

Careful, honest wording — this is Rule 4 made visible:

| Situation | Copy |
|---|---|
| No evidence | "No related evidence has been confirmed yet." |
| No findings | "No material review issues were detected in the currently connected evidence." |
| Unknown readiness | "Not enough evidence is available to assess this domain." |

**Never say "Everything is perfect."**

### Trust / freshness

Reserve and use UI patterns for **Last Updated · Last Sync · Evidence timestamp · Confidence**. Never fake a live integration. Synthetic/demo data must be visibly labelled as such.

### Responsiveness

Desktop is the primary Product Manager experience; the application must still remain usable on smaller screens.

---

## 17. Technical architecture

**Stack:** Next.js (App Router) · TypeScript · Supabase PostgreSQL · Next.js server functionality / API routes where appropriate · Claude API later · optional pgvector only if semantic retrieval becomes necessary.

**Never introduce:** graph databases · microservices · Kafka · autonomous agent infrastructure · premature distributed architecture.

### Repository conventions

- **Styling:** CSS Modules per component plus a global design-token layer (`src/styles/tokens.css`). **No Tailwind, no component framework.** Tokens are the single source of visual truth — never hard-code a colour, size or radius in a component.
- **Data access:** one `Repository` interface with two implementations (Supabase, local fixtures) returning **identical domain shapes**. UI code must never know, or be able to tell, which implementation is active.
- **Identity:** `initiatives.slug` is the stable public identifier used by routes and fixtures. **Never key fixtures or URLs off generated UUIDs.**
- **Server-side only data access.** No Supabase client ships to the browser.
- **No new dependency without approval.** Ask first.
- Clear component boundaries · reusable status components · typed models · clean naming · sensible folder structure · simple state management · migrations · seed data. **Avoid premature abstraction.**

### Trust / explainability principle

Every important AI conclusion must eventually be traceable to evidence and answer *"Why does the system believe this?"*, preserving evidence · source · date · confidence · user correction/override. Evidence freshness must eventually be visible.

### Security principle

Future evidence must be **permission-aware**. The architecture must not assume every user can see every artifact. Evidence records should conceptually preserve source · workspace/tenant · visibility · source permissions. Full enterprise ACL is not required in the first prototype.

---

## 18. Phase 1 write safety (temporary demo security model)

Phase 1 intentionally has **no authentication**. That must not create an unrestricted public write surface.

- **RLS is enabled on all tables with no policies** — deny by default. The `anon` and `authenticated` roles can read and write nothing.
- **All access is server-side**, via a server-only service-role key. There is no browser Supabase client and **the service-role key is never exposed to the browser** (never prefix it `NEXT_PUBLIC_`).
- **`DEMO_WRITE_ENABLED` gates every mutation.** It defaults to `false` unless explicitly enabled in the intended local/demo environment. Reads remain available; create/update/delete **fail safely** with a clear handled refusal when it is off.
- **The guard is enforced server-side inside the data/repository layer**, not merely hidden in the UI. Disabling a button is not the control.
- **Do not introduce authentication in Phase 1.** Real per-user ACL arrives with evidence permissions in a later phase.

---

## 19. Data model direction

The future logical model stays simple. Expected entities may eventually include: `users` · `initiatives` · `initiative_sources` · `evidence` · `claims` · `relationships` · `review_issues` · `assessments` · `actions` · `activity_log`.

**Create only what the current phase requires.** Phase 1 created exactly: `users`, `initiatives`, `activity_log`.

---

## 20. Golden demo initiative — Merchant Flex Finance

A **synthetic** initiative (slug `merchant-flex-finance`) used to demonstrate the experience.

> A merchant working-capital financing initiative allowing eligible merchants to request financing and repay installments from settlement activity.

**Scenario:** original requirement *Traditional + Islamic Financing*; later decision *Islamic Financing Only* → the old requirement is **SUPERSEDED, not a conflict**. Financial requirement *Daily repayment = Monthly installment / 27* vs implementation requirement *= / 30* → a **critical financial CONFLICT**. Delivery: epic in development, several stories complete, some work open. QA partial. Finance: final authoritative calculation confirmation not found. Compliance: approval evidence not found. Future phase: Automated Disbursement.

**Expected interpretation:** Stage `DELIVERY` · Overall `AT_RISK` · Critical: repayment calculation conflict · Superseded: Traditional+Islamic → Islamic-only · Finance `AT_RISK` · Release `BLOCKED` · Unknown: no evidence confirming Compliance approval was found.

**Primary Next Best Action:** *Resolve the daily repayment calculation with the relevant Finance / Lending owner before continuing affected implementation.*

This is **synthetic placeholder data**. Never present it as AI-generated output.

---

## 21. Phase discipline

### Phase 1 — Foundation + Initiative Management + Core Application Shell — **COMPLETE**

Delivered: design token system and shared primitives · application shell (navy rail, light workspace, tab navigation) · Initiatives list · Create Initiative · Initiative Workspace with Overview / Review / Product Memory / Evidence / Readiness · the seeded Merchant Flex Finance demo · `users` / `initiatives` / `activity_log` in Supabase with migrations and seed · the local-fixture repository fallback.

**Real and functional:** listing initiatives, creating an initiative, activity logging, navigation, responsive layout, empty states.

**Deliberately synthetic:** everything on Review, Product Memory, Evidence and Readiness, plus domain states and Next Best Action — static typed fixtures keyed to the demo initiative's slug. Consequently **an initiative you create yourself correctly shows honest empty states**, while the seeded demo shows the full narrative. This is intentional: it satisfies Rule 4 and proves the empty-state paths in real code.

### Not built in Phase 1, and not to be added without explicit approval

Real Jira integration · Google Drive integration · claim extraction · semantic search · AI conflict detection · readiness AI · Next Best Action generation · real domain activation logic · autonomous agents · authentication.

### Rule

**Do not begin a later phase without explicit approval from the user.** When a phase is complete, report and stop.

---

## 22. Working discipline

Adapted from the Karpathy-skills principles referenced by the playbook (that skill is not installed here; its substance is captured directly):

- **Make no silent assumptions.** If a requirement is ambiguous and the readings lead to materially different work, ask. Otherwise state the assumption explicitly in your report.
- **Do not over-engineer.** Build what the phase requires. Avoid premature abstraction, speculative generality and infrastructure the product does not yet need.
- **Do not invent installation commands.** If a skill or tool is not installed, inspect the playbook and the local environment to find the supported procedure before installing anything. Do not halt the whole build over one optional skill.
- **Report faithfully.** If something is mocked, say it is mocked. If a step was skipped, say so. Never dress synthetic data as engine output.

### Available design skills

`frontend-design` and `ui-ux-pro-max` are installed locally and should be used for UI work. `mcp-builder` belongs to a later connector phase.
