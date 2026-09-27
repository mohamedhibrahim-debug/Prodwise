# Measured candidate quality

## Navigation

Production-mode local server, same hosted four-initiative Demo dataset as the baseline, 1440×1050 viewport, three warmed samples per transition. Completion waits for actual destination content, not URL change. Counts are sanitized backend HTTP calls during the measured window, including overlapping prefetch; they are not database query counts.

| Transition | Before median | After median | Backend calls before → after |
|---|---:|---:|---:|
| Home → Initiative | 1334 ms | 1180 ms | 26 → 10 |
| Initiative → Decisions | 1227 ms | 1099 ms | 31 → 9 |
| Home → Roadmap | 911 ms | 910 ms | 20 → 8 |
| Home → Analysis | 933 ms | 1465 ms | 18 → 9 |
| Administration → Users | 2350 ms | 1760 ms | 45 → 25 |

All 15 candidate transitions kept the same shell DOM and made no document navigation. Previously Administration → Users reloaded the document. No console errors or failed server responses were observed. Analysis time regressed despite fewer calls; its samples were 915, 1486 and 1465 ms. This is reported, not hidden behind the call-count improvement. The remote provider and guarded data reads remain on the critical path; no cross-request authorization/truth cache was added.

The first candidate trace showed 6–13 RSC requests per navigation. Automatic prefetch on many detail/filter links repeated provider checks. Primary portfolio destinations retain prefetch; secondary record, filter and utility links now load on demand. Analysis links go directly to its portfolio route. Session, delivery and presentation data are memoized only within one server render; writes explicitly reauthorize and reread.

Private evidence: performance-before.json, performance-after.json and sanitized fetch-before/fetch-after traces under .data/product-quality. These measurements precede the final visual corrections and the newly authorized operating-loop scope; final integrated navigation must be checked for regression.

## Accessibility

The integrated sweep completed 73 rendered checks across 390, 768, 1024 and 1440 pixels, plus Home at 320 pixels: zero axe violations and zero document overflow. The keyboard starts at Skip to main content, which focuses main. Native Help, command, navigation, organization and filter dialogs have separate focused checks; closing restores their trigger. Automated testing is not a screen-reader certification.

Fixed issues found by the sweep: invalid Brief definition-list content, Weekly heading order and duplicate landmark names, undersized pending-section links, and a visually hidden fact-table label escaping its scroll container. Layouts use labeled fields and status text. Reduced motion is respected for the fact editor's programmed scroll as well as the global animation rules. Contrast cases marked incomplete by axe still require visual judgment; no full WCAG conformance claim is made.

## Real Claude draft

The eight-section local synthetic gate returned HTTP 200 from claude-sonnet-5 and accepted 27 exact supported statements, including Target Live 1 October → 8 October (+7 days), against W38 Final. Every line passed reference, initiative and exact-text validation; unknown values acquired no invented facts. Provider failure and invented references returned an explicitly labeled factual template without modifying stored reviews.

The expanded portfolio initially exhausted the former 4096-token budget. Strict JSON output with low effort and a bounded 8192-token budget fixed that case. Truncated, refused, empty, missing-section or unsupported responses remain templates. API credentials were neither changed nor printed; .env.local and private artifacts remain ignored and untracked.

Documentation supporting the provider change: [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) and [Sonnet 5 migration behavior](https://platform.claude.com/docs/en/models/sonnet-5/migration-guide).

## Claude rendered critique provenance

The original Claude Code product-lead session af26d192-ddfb-4c92-b3d6-eff6f31a6dc0 reached its usage window during rendered review. The completed screenshot critique used the already-configured Anthropic API and claude-opus-5-5 with the saved recommendation, accepted contract and 19 synthetic screenshots. It returned REVISE with five concrete major findings, recorded in claude-visual.md. Failed/incomplete API attempts were not treated as acceptance. All major fixes and a fresh independent review are required before the candidate is closed.

## Current Mission closure measurement — 27 September, 14:43 Cairo

Rebuilt the current visual candidate and restarted local production-mode port 3215 before repeating the same five journeys and three warmed samples. No application source changed between this measurement and the checkpoint; the earlier Analysis latency spike did not reproduce, so it is not presented as a newly discovered code fix.

| Transition | Original baseline | Prior candidate | Closure candidate | Baseline → closure backend calls |
|---|---:|---:|---:|---:|
| Home → Initiative | 1334ms | 1180ms | 1144ms | 26 → 10 |
| Initiative → Decisions | 1227ms | 1099ms | 999ms | 31 → 9 |
| Home → Roadmap | 911ms | 910ms | 884ms | 20 → 8 |
| Home → Analysis | 933ms | 1465ms | 878ms | 18 → 8 |
| Administration → Users | 2350ms | 1760ms | 1680ms | 45 → 19 |

Analysis samples: 878, 875, 878ms. All 15 transitions kept the existing shell, with zero document navigation, console errors or failed server responses. No material latency regression from the original baseline remains in this controlled run. Remote-provider/network variability remains; this is local production-mode evidence, not a new production deployment or an SLA. Earlier results remain recorded above and in performance-pre-closure.json.

The latest full accessibility sweep after visual changes again passed 73 views with zero violations, overflow or runtime errors; both skip-link checks passed. Weekly interactions and sensitive policy/Analysis gates were also rerun successfully before this measurement.
