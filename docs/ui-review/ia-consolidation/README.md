# IA consolidation review

The browser run captures Home, Brief, setup, Knowledge Record, and Sources at 1440px and 375px. The remaining numbered captures cover the Stage 2.2 decision regression, including stale submissions, both outcomes, Reviewed, Resolved, and History.

## Routes

| Legacy path suffix | New path suffix | Response |
| --- | --- | --- |
| `/memory` | `/knowledge` | 308 |
| `/memory/new` | `/knowledge/new` | 308 |
| `/memory/[id]/edit` | `/knowledge/[id]/edit` | 308 |
| `/memory/[id]/verify` | `/knowledge/[id]/confirm` | 308 |
| `/sources` | `/knowledge/sources` | 308 |
| `/sources/new` | `/knowledge/sources/new` | 308 |
| `/sources/[id]/edit` | `/knowledge/sources/[id]/edit` | 308 |
| `/readiness` | Brief | 308 |

Every path is under `/initiatives/[slug]`. The browser regression checks all eight redirects.

## Read budget review

Static inspection of the Supabase adapter gives the following request counts on a populated initiative. Request scoped caching shares the initiative lookup between metadata, layout, and page. Knowledge uses the existing aggregate snapshot with nested source links and decision states.

| Screen | Reads | Count |
| --- | --- | ---: |
| Home | portfolio snapshots, recent activity | 2 |
| Brief | initiative, snapshot, activity | 3 |
| Knowledge Record | initiative, aggregate snapshot | 2 |
| Knowledge Sources | initiative, aggregate snapshot | 2 |
| Decisions | initiative, claims, sources, source links, decision states | 5 |

The milestone brief names an approved IA query budget but does not provide numeric ceilings. These are inspected counts, not a claim that an unspecified ceiling was met. No per-initiative activity query or portfolio N+1 loop was introduced.

## Verification

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and the browser regression pass. The browser run checks visible terminology on portfolio and initiative routes, setup, Decisions, and the create/edit/confirm forms; it also checks the three initiative tabs, 375px overflow, keyboard search, and decision deep-link focus.
