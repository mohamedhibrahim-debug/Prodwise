# Final Demo visual and browser evidence

All captures show the synthetic **Prodwise Demo** organization. No account passwords, API keys or real AMAN portfolio data are included.

The ten surfaces were checked at 390, 768, 1024 and 1440 pixels with no document-level horizontal overflow. Desktop and mobile entry points:

| Surface | Desktop | Mobile |
| --- | --- | --- |
| Home | [1440](home-1440.png) | [390](home-390.png) |
| Initiatives | [1440](initiatives-1440.png) | [390](initiatives-390.png) |
| Brief | [1440](brief-1440.png) | [390](brief-390.png) |
| Decisions | [1440](decisions-1440.png) | [390](decisions-390.png) |
| Knowledge | [1440](knowledge-1440.png) | [390](knowledge-390.png) |
| Sources | [1440](sources-1440.png) | [390](sources-390.png) |
| Delivery | [1440](delivery-1440.png) | [390](delivery-390.png) |
| Roadmap | [1440](roadmap-1440.png) | [390](roadmap-390.png) |
| Weekly Review | [1440](weekly-review-1440.png) | [390](weekly-review-390.png) |
| Analysis | [1440](analysis-1440.png) | [390](analysis-390.png) |

[Generated Claude review](claude-generated-1440.png) shows the successful supported draft before human finalization. [Machine-readable gate results](results.json) record the latest acceptance result. Screenshots are local development captures; the small Next.js developer indicator is absent from hosted production builds.

The review document intentionally scrolls: recorded facts stay distinct from editable PM notes for each initiative. The values 27 and 30 remain adjacent before source disclosures on mobile. The Guide can be dismissed, reopened at the saved chapter and closed with Escape.

## Completed acceptance

The final full run passed **15 workflow gates**, **40 responsive checks**, with **zero browser console or page errors**. The real server action returned HTTP 200 and accepted **23 supported lines** from `claude-sonnet-5`, on its first attempt. A separate safe provider diagnostic recorded API HTTP 200. All lines matched exact permitted statements in the same initiative; W38 Final, Oct 1 → Oct 8 (+7 days), five absent Target/Actual fields, delivery facts and previous history were preserved.

Controlled missing configuration, HTTP 503, transport failure and fabricated output each returned a supported template. An earlier genuine provider timeout also displayed the honest Template label; the bounded deadline was corrected to 55 seconds within the route's 60-second budget and the full run then passed.

Reviewer operations passed: shared section review/finalization, next-week baseline selection, initiative creation, signed-actor delivery confirmation, refusal of a forged foreign-initiative write, and resolving 27/30 while preserving replacement history. Non-Demo product rows and the original workspace delivery file stayed unchanged. The operator then reset and verified the canonical Demo: four initiatives, W38 Final, W39 Draft, 27 versus 30 and Oct 1 → Oct 8. Private credentials and environment configuration remained unchanged.

During test development, a future-week test correctly received a refusal, and two selector/screenshot timing issues were corrected in the harness. Playwright's default caret-hiding temporarily mutated unhydrated input attributes; final captures retain the normal caret and wait for page readiness. The final run above contains no ignored console failures.
