# Navigation baseline

Measured 27 September 2026, local production build of `79875f8`, hosted Supabase, isolated desktop Chromium at 1440 px. Three warmed samples per route; 1.2 s idle before the click. No business records were changed. The shell remains mounted on existing Next links; account administration links use document navigation.

| Transition | Median completed navigation | Median backend requests during transition |
|---|---:|---:|
| Home → Initiative | 1,586 ms | 30 |
| Initiative → Decisions | 1,208 ms | 31 |
| Home → Roadmap | 956 ms | 18 |
| Home → Analysis | 974 ms | 18 |
| Administration → Users | 2,391 ms | 43 |

All three Administration → Users samples loaded a new document. The other twelve samples used client navigation. The fetch profiler stored only method, sanitized endpoint category, status and duration; no headers, bodies or query values. Counts include concurrent prefetch requests falling inside the same measurement window, so are browser-workload counts rather than exact per-request SQL counts. Before/after uses the same procedure.

Repeated demo session/provider validation appears 5–12 times in a transition. Layout, AccountAccess, repository guards and delivery reads each request context independently. Workspace presentation repeats organization/workspace/scenario reads. Safe opportunity: React request-only memoization for reads, keyed by verified scope; no cross-request authorization cache. Mutations must use fresh access and existing database guards. Optimize repeated dataset reads before adding speculative caching. Use client links and partial loading boundaries with persistent shell, and preserve no-store trust-critical responses.

References consumed: installed Next 16.3 documentation on linking/navigation, data fetching and request memoization, plus Google Chrome modern-web-guidance forms/accessibility guides. Raw measurements: `.data/product-quality/performance-before.json`; sanitized endpoint timing evidence: `.data/product-quality/fetch-before.ndjson`.
