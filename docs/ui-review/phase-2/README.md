# Prodwise — Phase 2 review screenshots

**Evidence + Initiative Boundary**, plus the executive Reporting view.

Captured from the **production build** (`next build` + `next start`) over the Chrome DevTools Protocol, using `Emulation.setDeviceMetricsOverride` so 375 px is genuinely 375 CSS px, and `Page.captureScreenshot` with `captureBeyondViewport` for true full-page output. Device scale factor 2, so each image is 2× the CSS size listed.

| # | Route | Viewport | File | CSS page size |
|---|---|---|---|---|
| 01 | `/initiatives` | 1440 px | `01-initiatives-desktop-1440.png` | 1440 × 900 |
| 02 | `/reporting` | 1440 px | `02-reporting-desktop-1440.png` | 1440 × 900 |
| 03 | `/initiatives/merchant-flex-finance/evidence` | 1440 px | `03-evidence-desktop-1440.png` | 1440 × 1593 |
| 04 | `…/evidence/new` | 1440 px | `04-add-evidence-desktop-1440.png` | 1440 × 1185 |
| 05 | `…/evidence` *(after a reclassification)* | 1440 px | `05-evidence-after-reclassification-desktop-1440.png` | 1440 × 1660 |
| 06 | `/initiatives/merchant-flex-finance` *(activity)* | 1440 px | `06-overview-activity-desktop-1440.png` | 1440 × 2095 |
| 07 | `/reporting` | 375 px | `07-reporting-mobile-375.png` | 375 × 1258 |
| 08 | `…/evidence` | 375 px | `08-evidence-mobile-375.png` | 375 × 2870 |
| 09 | `…/evidence/new` | 375 px | `09-add-evidence-mobile-375.png` | 375 × 1606 |

No page has horizontal overflow at either viewport.

## What these demonstrate

**Evidence workspace (03, 08).** All five boundary groups are always rendered with counts, including empty ones — the classification model is the point of the screen, so no bucket is hidden. Each row shows title, source reference, source type, date and verification freshness; everything else is behind the disclosure. The sources strip lists where evidence conceptually comes from, every one marked `MANUAL` — Phase 2 has no connectors and never fabricates a connected state.

**Add Evidence (04, 09).** Three required fields only — Title, Source Type, Boundary. Everything below the divider is optional. No upload, no parsing, no OCR: Phase 2 records a *described* source, not its bytes.

**Reclassification (05, 06).** Screenshots 03 and 05 bracket a real interaction: evidence was added through the form as `Related`, then moved to `Current Scope` with the inline control. Both the add and the move are recorded in the initiative's activity, visible in 06. `Exclude` is one click; there is deliberately **no** one-click "include" — returning evidence requires explicitly choosing a target boundary, because assuming `CURRENT_SCOPE` would be a guess, and a wrong boundary poisons every later intelligence layer.

**Freshness language (03, 05, 08).** Factual only: *Last verified 4 days ago*, *Dated 25 Aug 2026*, *Verification date unknown*. Nothing is ever called "outdated" — Prodwise has no basis for that claim, only for how long it has been since someone confirmed the record.

**Reporting (02, 07).** One executive question: which initiatives need attention, and why. Ordered `BLOCKED → AT_RISK → UNKNOWN → READY`. No charts, no percentages, no scores, no KPI tiles. It reads the same initiative truth as the Product Manager workspace, so the two cannot disagree, and clicking an initiative opens its normal Overview.

## Honesty notes

Primary Issue and Next Best Action on Reporting come from the **synthetic Phase 1 intelligence**, which is why the view carries a single `Demo data` indicator — enough that an executive is never misled, without a disclaimer on every row.

Evidence itself is **real and persisted** from Phase 2 onward, but the Review findings were **not** derived from it. Review, Product Memory and Readiness remain static Phase 1 fixtures. Evidence is the source layer underneath the narrative, not its cause.

Persistence is the local JSON store (`.data/prodwise.json`), used because the Supabase free-plan project limit is still in force. It is **local demo persistence only** — not distributed, serverless or multi-instance safe. Migrations for the same schema are committed under `supabase/`.
