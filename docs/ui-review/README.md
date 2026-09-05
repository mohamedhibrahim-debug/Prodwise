# Prodwise — Phase 1 UI Review Package

Full-page screenshots of the **actual running Next.js application**, for reviewers without access to localhost.

Nothing here is a mockup, a design file, or a reconstruction. Every image was captured from the real app over the Chrome DevTools Protocol using `Page.captureScreenshot` with `captureBeyondViewport`, against a **production build** (`next build` + `next start`) so no development overlay appears.

---

## Screenshots

| # | Route | Viewport | File |
|---|---|---|---|
| 01 | `/initiatives` | 1440 px desktop | [`01-initiatives-desktop.png`](01-initiatives-desktop.png) |
| 02 | `/initiatives/new` | 1440 px desktop | [`02-create-initiative-desktop.png`](02-create-initiative-desktop.png) |
| 03 | `/initiatives/merchant-flex-finance` | 1440 px desktop | [`03-overview-desktop.png`](03-overview-desktop.png) |
| 04 | `/initiatives/merchant-flex-finance/review` | 1440 px desktop | [`04-review-desktop.png`](04-review-desktop.png) |
| 05 | `/initiatives/merchant-flex-finance/memory` | 1440 px desktop | [`05-product-memory-desktop.png`](05-product-memory-desktop.png) |
| 06 | `/initiatives/merchant-flex-finance/evidence` | 1440 px desktop | [`06-evidence-desktop.png`](06-evidence-desktop.png) |
| 07 | `/initiatives/merchant-flex-finance/readiness` | 1440 px desktop | [`07-readiness-desktop.png`](07-readiness-desktop.png) |
| 08 | `/initiatives` | 375 px mobile | [`08-initiatives-mobile.png`](08-initiatives-mobile.png) |
| 09 | `/initiatives/merchant-flex-finance` | 375 px mobile | [`09-overview-mobile.png`](09-overview-mobile.png) |

All nine routes were captured successfully.

---

## Capture conditions

| | |
|---|---|
| Application | Prodwise Phase 1, production build |
| Browser | Chrome 152.0.7977.65, headless, via CDP |
| Emulation | `Emulation.setDeviceMetricsOverride` — real CSS widths, `mobile: true` for 375 px |
| Device scale factor | 2 (images are 2× the CSS dimensions listed below) |
| Data source | Local fixture repository (no Supabase project provisioned — see below) |
| Date | 05 September 2026 |

`--window-size` alone is clamped by Chrome's minimum window width on Windows, which silently produces a cropped wider render rather than a true narrow one. Device-metrics emulation is used instead, so 375 px really is 375 CSS px.

### CSS dimensions captured

| File | CSS size | Image size |
|---|---|---|
| `01-initiatives-desktop.png` | 1440 × 900 | 2880 × 1800 |
| `02-create-initiative-desktop.png` | 1440 × 900 | 2880 × 1800 |
| `03-overview-desktop.png` | 1440 × 1954 | 2880 × 3908 |
| `04-review-desktop.png` | 1440 × 1293 | 2880 × 2586 |
| `05-product-memory-desktop.png` | 1440 × 900 | 2880 × 1800 |
| `06-evidence-desktop.png` | 1440 × 1730 | 2880 × 3460 |
| `07-readiness-desktop.png` | 1440 × 2499 | 2880 × 4998 |
| `08-initiatives-mobile.png` | 375 × 1433 | 750 × 2866 |
| `09-overview-mobile.png` | 375 × 3234 | 750 × 6468 |

No page has horizontal overflow at either viewport.

---

## Notes for the reviewer

**The data is synthetic.** All four initiatives are seeded demo records and are labelled *Demo data* in the UI. Phase 1 contains **no AI reasoning and no external integrations** — nothing on Review, Product Memory, Evidence or Readiness was produced by an engine. See `CLAUDE.md` §20 and §21.

**Default page states.** Screenshot 04 shows the Review tab's default `Open` filter (5 of 7 findings; `Resolved` and `All` are not captured). Screenshot 05 shows Product Memory's default `Decisions` view (3 of 14 claims; Requirements, Risks, Dependencies and Claims are not captured).

**Fixed elements.** The *AI Consultant* tab is `position: fixed`, so in a full-page capture it renders once at its fixed offset rather than pinned to the viewport. In the live app it stays at the screen edge.

**No Supabase project.** The free-plan project limit was reached, so the app is running against the in-repo fixture repository. The rail footer states this honestly (*Source: Local demo data*). Schema and seed live in `supabase/`.

**What is genuinely functional** in these screens: the initiatives list and its priority ordering, Create Initiative, navigation, activity logging, empty states and responsive layout. Everything else is synthetic. `README.md` at the repository root has the full breakdown.
