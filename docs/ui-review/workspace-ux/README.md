# Workspace UX implementation evidence — 26 September 2026

Track B implements the corrected workspace contract on an isolated branch from live baseline `2596b72094ef6edcaf9ffd5f895d87b6043f479f`. These screenshots are the actual local Next application with explicitly labelled synthetic fixtures; they are not production screenshots or the earlier wireframe.

## Result

Home leads with actual open decisions, then recorded changes and incomplete setup. The initiative register preserves unknown states. One shared initiative title and compact identity header remain across Brief, Decisions, Knowledge and edit forms. Roadmap and Weekly Review links connect to the separately owned delivery implementation. Analysis explicitly states that outcome data is unavailable. The former Reporting destination redirects to Roadmap.

Knowledge is a ledger with visible value, phase, confirmation history, linked source references and replacement lineage. Full source context and existing edit/confirmation flows remain accessible. Decisions keeps its mature workbench and action forms; the competing values and source references appear together before expandable full source inspectors, including on mobile. Shell search keeps keyboard focus inside the dialog and restores it on dismissal.

## Verification

- TypeScript, ESLint and 95 existing unit tests passed.
- Production builds passed with Webpack and the project's default Turbopack compiler.
- `run-regression.mjs` retains the existing Stage 2.2 browser workflow assertions. All gates passed with Turbopack: confirmer refresh, existing/corrected value decisions, stale refusal without writes or lost controlled inputs, duplicate corrected-value prevention, domain/server refusals, standing/re-emerged decisions, notes/reopening, read-only paths, replacement/provenance, deep links, keyboard navigation and isolated multi-item form inputs. See `browser-turbopack-regression.log`.
- The route matrix passed all 56 checks: Home, Initiatives, Analysis, Brief, incomplete setup, Decisions, Knowledge and Sources at 375, 390, 768, 1024, 1280, 1440 and 1920 pixels. Checks require no horizontal overflow and one visible h1. Decisions additionally requires the 27/30 pair at the same vertical position. See `viewport-results.json` and the assertions in the harness.
- Legacy redirects, terminology, desktop/mobile search, drawer focus and dismissal passed in the same browser run.
- `git diff --check` passed. No action, domain, repository, actor, schema, dependency or deployment configuration was changed.

## Local compiler observation

The authorized dependency junction sits outside the checkout. Default Turbopack therefore needed a temporary broader `turbopack.root` during the build; `next.config.ts` was restored byte-for-byte afterward and has no diff. No installation was required. The browser harness uses the already installed headless Chromium and fixed local port 3202, with disposable synthetic data.

The initial Webpack browser run reached all responsive checks but failed when the saved confirmer did not refresh. The save reported success; the generated server output contained separate local-store cache modules. The same unmodified workflow passed with the default Turbopack build. `browser-regression.log` preserves the failed compiler-specific run. The two earlier logs preserve copy-gate corrections. This does not certify deployment or production persistence. Authenticated integrated checks remain owned by the integration stream.

## Selected screenshots

- `home-responsive-1440.png`, `home-responsive-375.png`
- `initiatives-responsive-1440.png`, `initiatives-responsive-375.png`
- `brief-responsive-1440.png`, `brief-responsive-375.png`
- `decisions-responsive-1440.png`, `decisions-responsive-375.png`
- `knowledge-responsive-1440.png`, `knowledge-responsive-375.png`
- `knowledge-expanded-desktop-1440.png`, `source-details-1440.png`
- `analysis-responsive-1440.png`, `analysis-responsive-375.png`

## Integration limits

Account/session controls are integrated by Auth. Delivery owns Roadmap, initiative delivery facts and Weekly Review; those new destinations do not exist on this UX-only branch. Home cannot infer deadlines, health, executive escalation or outcomes from mismatch/setup counts. Its current log cannot establish every metadata edit's effect on support, and only recorded event types are displayed. Analysis has no fabricated metrics. No production deployment or remote push was performed.
