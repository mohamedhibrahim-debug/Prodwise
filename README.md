# Prodwise

**Product Intelligence, from evidence to action.**

Prodwise gives Product Managers a continuously updated, evidence-backed understanding of where an initiative really stands, what is unresolved, and what should happen next. Its core capability is **Initiative Intelligence**: a structured Product Initiative Workspace that reconstructs scattered product truth — Jira, documents, decisions, approvals — into persistent Product Memory, evidence-backed Current State, Readiness, and one recommended Next Best Action.

Prodwise is **not** a chatbot. Reasoning surfaces in the workspace itself.

> **`CLAUDE.md` in this repository is the product constitution.** Read it before making product, UX, data-model or architecture decisions.

---

## Status — Phase 1

Phase 1 delivers the foundation, initiative management and the core application shell. It contains **no AI reasoning and no external integrations**.

| Area | State |
|---|---|
| Initiatives list, ordering, navigation | Functional |
| Create Initiative (name, description, known references) | Functional |
| Initiative Workspace — Overview / Review / Product Memory / Evidence / Readiness | Functional shells |
| Activity logging | Functional |
| Review findings, Product Memory, Evidence, Readiness, domain states, Next Best Action | **Synthetic fixtures** |
| Jira / Google Drive / claim extraction / conflict detection / readiness AI | Not built |
| Authentication | Not built (by design — see §18 of `CLAUDE.md`) |

An initiative **you create** has no connected evidence, so it correctly shows honest empty states everywhere. The **seeded demo initiatives** carry the synthetic narrative and are labelled *Demo data* in the UI.

---

## Running it

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. No configuration is required — with no environment set, the app serves the in-repo fixture repository.

To create initiatives locally, copy `.env.example` to `.env.local` and set:

```
DEMO_WRITE_ENABLED=true
```

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

---

## Architecture

```
src/
  app/                     Routes (App Router)
    initiatives/           List · new · [slug] workspace + 5 tabs
  components/
    primitives/            StatePill, SeverityMark, InitiativeArc, EmptyState, …
    shell/                 NavRail, WorkspaceHeader, WorkspaceTabs, ConsultantPanel
    initiative/            InitiativeRow, FindingRow, ClaimRow, EvidenceRow, …
  lib/
    domain/                Types, labels, ordering — the shared vocabulary
    data/                  One Repository interface, two implementations
      fixtures/            Synthetic demo data, keyed by initiative slug
    env.ts                 Server-only env access and the write guard
  styles/
    tokens.css             The single source of visual truth
    global.css             Reset and shared utilities
supabase/
  migrations/              Phase 1 schema
  seed.sql                 Synthetic demo data
```

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · CSS Modules · Supabase PostgreSQL.

### Data access

One `Repository` interface with two implementations that return **identical domain shapes**:

- **`supabaseRepository`** — used when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set.
- **`localRepository`** — in-memory fixtures, used otherwise. Zero configuration.

`getRepository()` in `src/lib/data/index.ts` is the only place that knows which is active. UI code cannot tell.

### Security in Phase 1

Phase 1 has no authentication. That must not leave an open write surface, so:

- **RLS is enabled on every table with no policies** — deny by default. `anon` and `authenticated` can read and write nothing.
- **All access is server-side.** No Supabase client ships to the browser; the service-role key is never prefixed `NEXT_PUBLIC_`.
- **`DEMO_WRITE_ENABLED` gates every mutation**, enforced in the repository layer rather than the UI — a disabled button is not a security control. It defaults to `false`.

Full detail in `CLAUDE.md` §18.

---

## Reference files

`Aman - Presentation Deck 3.0 (1).pptx` is **visual inspiration only**. `claude-code-palybook final.html` is a **development workflow reference only**. Neither overrides `CLAUDE.md`, and neither should be moved, renamed or deleted.
