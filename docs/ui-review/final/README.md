# Prodwise — Phase 1 final review screenshots

Captured from the **production build** (`next build` + `next start`) over the Chrome DevTools Protocol, using `Emulation.setDeviceMetricsOverride` so 375 px is genuinely 375 CSS px, and `Page.captureScreenshot` with `captureBeyondViewport` for true full-page output. Device scale factor 2, so each image is 2× the CSS size listed.

These supersede the pre-polish images in the parent folder for the four screens they cover.

| # | Route | Viewport | File | CSS page size |
|---|---|---|---|---|
| 01 | `/initiatives/merchant-flex-finance` | 1440 px | `01-overview-desktop-1440.png` | 1440 × 2004 |
| 02 | `…/review` | 1440 px | `02-review-desktop-1440.png` | 1440 × 1078 |
| 03 | `…/memory` | 1440 px | `03-product-memory-desktop-1440.png` | 1440 × 900 |
| 04 | `…/readiness` | 1440 px | `04-readiness-desktop-1440.png` | 1440 × 1831 |
| 05 | `/initiatives/merchant-flex-finance` | 375 px | `05-overview-mobile-375.png` | 375 × 3368 |
| 06 | `…/memory` | 375 px | `06-product-memory-mobile-375.png` | 375 × 1198 |

No page has horizontal overflow at either viewport.

## What these show

- **01 / 05** — Overview. Desktop order is Attention → Next Best Action; at 375 px the recommendation is lifted above the attention list, with the section numerals swapping to match. **Operations** now appears in Current State as `AT RISK`, matching Readiness.
- **02** — Review under its default `Open` filter. `Open` is now the *actionable* queue: the superseded financing-model finding is excluded from it and remains under `All`. Counts read `Open 4 · Resolved 2 · All 7`.
- **03 / 06** — Product Memory. The secondary tab strip scrolls inside itself; the page stays within the viewport and the header is never dragged out of view.
- **04** — Readiness. BLOCKED and AT_RISK domains expanded, READY and UNKNOWN collapsed with their open-issue and unknown counts.

Data is synthetic demo data throughout, running on the in-repo fixture repository. See `CLAUDE.md` §20–21.
