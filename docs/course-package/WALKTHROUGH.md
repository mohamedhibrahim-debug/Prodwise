# Prodwise — graduation walkthrough

**Presenter:** Mohamed Awad, Product Manager / Product Owner  
**Target length:** 6 minutes 20 seconds  
**Recording environment:** the dedicated **Prodwise Demo** organization, using its pre-provisioned ORG_OWNER reviewer account. Every initiative, source, delivery fact and weekly review in this organization is synthetic. Keep account credentials, browser password prompts, environment files and developer logs outside the recording.

## Spoken script and shot order

| Time | Screen / action | Narration |
|---|---|---|
| 0:00–0:20 | Title or the signed-out login screen. Sign in without showing the password. | “Hi, I’m Mohamed Awad, a Product Manager and Product Owner. I built Prodwise to solve a problem from day-to-day product work: the evidence about an initiative is spread across requirements, meetings, implementation notes and delivery updates. Preparing a trustworthy management update often means reconstructing that story by hand.” |
| 0:20–0:45 | Home. Show the **Prodwise Demo** organization and synthetic labels. | “Prodwise brings that evidence into one product workspace. It helps us see what is currently recorded, what needs a human decision, and what changed since our last review. This walkthrough uses a separate organization with synthetic data. The reviewer can use the full workflow here without accessing any real organization.” |
| 0:45–1:05 | Home attention row, then Initiatives register. | “Home starts with attention. Here, two records contain different daily repayment calculations. I can also see delivery changes and upcoming work. The initiative register gives me the portfolio: business line, lifecycle stage, attention and the current delivery target.” |
| 1:05–1:30 | Open Merchant Flex Finance → Brief. | “An initiative is the object that keeps this work together. Merchant Flex Finance is a fictional merchant-financing pilot. Brief gives me its current recorded state, the decision waiting on us, and the delivery context. I do not have to reconstruct where I am every time I move to another view.” |
| 1:30–2:00 | Knowledge, then Sources. Open the linked calculation source and its reference. | “Knowledge is the structured record, and Sources explains where the evidence comes from. A source can be a document, a meeting or another recorded reference. I can follow the link behind a value rather than trusting an unexplained summary. The financing model was explicitly changed from Traditional plus Islamic to Islamic-only. That is replacement history, not a fresh conflict.” |
| 2:00–2:30 | Decisions. Keep 27 and 30 visible together, inspect evidence and decision options. | “The repayment records say monthly installment divided by twenty-seven and divided by thirty. Prodwise compares these explicit records deterministically. It is not asking AI to guess whether finance is correct. A person reviews the context and records the decision. The application also keeps the decision and its explanation traceable.” |
| 2:30–3:00 | Delivery facts → Target Live revision history. | “Delivery has its own confirmed facts: the named scope, development start, target live, actual live when known, the next milestone and next step. Here the pilot target moved from October first to October eighth. Both dates remain in history with who recorded the change and why. An unknown actual launch date stays unknown; it does not become a failed launch.” |
| 3:00–3:25 | Roadmap. Show target versus actual, moved target, the unscheduled initiative and next milestone. | “Roadmap is generated from those facts. Nobody redraws a bar in a second system. I can scan the portfolio, inspect a moved target and open the initiative behind it. This other initiative has no confirmed target, so it remains explicitly unscheduled.” |
| 3:25–3:50 | Weekly Review → open **2026-W39**, inspect prior Final **2026-W38** and +7-day movement. Refresh the draft if the screen says inputs changed. | “For the weekly product-management meeting, we have one shared portfolio review. Each PM works on the relevant initiative sections, and an authorized coordinator finalizes it. This week is compared with the previous finalized review in the same workspace. The one-week target movement comes from that stored baseline and the current facts.” |
| 3:50–4:35 | Click the visible **Claude draft** action. Keep the returned provider/status label and grounded wording in frame. | “This is the AI part of the solution. Claude receives a constrained set of supported facts and changes and drafts the management wording. The application checks the returned statements against those references. AI does not create a delivery commitment, confirm a launch, or invent a business result. If a statement is unsupported, it cannot become an accepted AI line. The review remains a draft for people to check.” |
| 4:35–5:25 | Read the AI lines and source cues. Save each of the four initiative sections after review. Finalize. | “I check the draft against the record, keep unknowns visible and edit the wording when needed. I review each initiative section before saving it. Now I can finalize the shared weekly review. Final means this review is a frozen comparison snapshot. It is not business approval or permission to release the product. The next week will compare against this finalized state.” |
| 5:25–5:55 | Analysis → Portfolio Analysis, then Project Analysis. | “Analysis separates operational facts from business performance. These counts come from recorded initiatives, stages, targets and decisions. Project outcomes need an agreed definition, source, period, formula, target, owner and freshness. We have not connected a trustworthy performance dataset, so Prodwise says that clearly rather than drawing fictional KPI charts.” |
| 5:55–6:20 | Return Home. Briefly open Guide or show the shared review. | “The practical result is one traceable journey: evidence, current record, human decisions, delivery facts and a grounded weekly update. Claude helps draft the management narrative; people remain responsible for the truth and final review. The MVP is ready for a reviewer to explore the complete workflow in this isolated demonstration organization.” |

## Recording preparation

1. Restore the registered Demo organization using the operator-only reset procedure. Never run a reset against AMAN.
2. Sign in with the private Demo reviewer credentials. Confirm the organization is **Prodwise Demo**, the organization role is **ORG_OWNER**, and no platform role is present.
3. Use a 1440 × 900 or wider desktop viewport and 100% zoom. Keep the application readable; avoid recording the whole desktop if it exposes other work.
4. Dismiss the welcome after showing its purpose once. Keep Guide available for the final shot.
5. Check that W38 is Final, W39 is Draft, Merchant Flex Finance is 27 versus 30, and Target Live history is 1 → 8 October.
6. Test the real Claude path before recording. The previously verified model was `claude-sonnet-5`; quote the model actually shown by the recording environment, never a model assumed from this script. Introduce W38 as a prepared synthetic baseline and retain the **Synthetic scenario preparation** attribution when showing seeded facts. The visible scenario date is 26 September 2026.
7. After rehearsal or reviewer mutations, reset only the registered synthetic Demo workspace. The baseline must be restored before the final take.
8. Do not show secrets in the recording. Review the exported video once before uploading it.

## If Claude is temporarily unavailable

Allow the application to finish the request and show its template/fallback label. Say:

> “The live AI provider is temporarily unavailable, so Prodwise has kept the review usable with a deterministic template from the same supported record. This is a template, not a Claude response. The baseline, unknown dates and human-finalization rules still apply.”

Continue with the manual review and finalization shots. If a previously captured successful Claude segment is included, label it with its actual capture date and identify it as a separate verified recording. Never label the fallback as live AI. The final submission must include a visible, accurately described successful Claude demonstration or explicitly disclose the provider outage.
