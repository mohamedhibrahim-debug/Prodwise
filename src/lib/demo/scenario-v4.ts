/**
 * Prodwise Demo v4 — the V3 portfolio plus ten active initiatives and one more
 * archived one, so that every Roadmap and Analysis condition is exercised by
 * canonical records rather than by display defaults.
 *
 * Every record is fictional and labelled synthetic. The additions run on the
 * same dated timeline as V3 (see buildDemoScenario): facts, commitments,
 * questions, relationships, risks and reviews all go through the product's own
 * reducers in date order, so the W37/W38 Finals include what existed then and
 * the open W39 Draft freezes everything as of the scenario date.
 *
 * Coverage by canonical record (scenario date 26 September 2026):
 *   development start · Target Live · Actual Live full (arabic localisation,
 *   before its target) and partial (firmware wave 1) · overlapping ranges ·
 *   a long initiative name (firmware rollout) · delivered work · approaching
 *   targets ≤ 14 days (fraud tuning 1 Oct, float top-up 3 Oct, dispute portal
 *   5 Oct) · an overdue target with no Actual Live (refund desk, 18 Sept) ·
 *   targets moved later (dispute portal, +21 d) and earlier (loyalty, −13 d)
 *   with their recorded events · milestones, including one the day before its
 *   target (dispute portal) and one two days before (fraud tuning) · a late
 *   dependency with date impact (supplier financing needs Merchant Flex Finance)
 *   and one whose impact is not assessed · recorded blockers · six initiatives
 *   with no date on the timeline (V3's four plus the kiosk, recorded Unknown,
 *   and reconciliation automation, nothing recorded) · two archived records.
 */
import { demoPortfolioMetricsV4 } from "./metric-fixtures.ts";
import { buildDemoScenario, DEMO_V3_CUTOFF, type ScenarioInitiative, type ScenarioKit } from "./scenario-v3.ts";
import type { DemoIdentity } from "./canonical.ts";

export const DEMO_V4_VERSION = "prodwise-graduation-2026-09-v4";
export const DEMO_V4_CUTOFF = DEMO_V3_CUTOFF;

export const V4_INITIATIVES: ScenarioInitiative[] = [
  { ref: "DEMO-700", slug: "terminal-firmware-rollout", name: "Terminal Firmware Rollout — Contactless Certification and Regional Wave Plan for Legacy Devices", businessLine: "ACCEPTANCE", stage: "LIVE_VALIDATION", created: "2026-05-26", owner: "tarek", scope: "Wave plan · certified firmware on legacy terminals", description: "Move every legacy terminal to the certified contactless firmware in regional waves, so contactless acceptance behaves the same on old and new devices." },
  { ref: "DEMO-710", slug: "merchant-app-arabic-localisation", name: "Merchant App Arabic Localisation", businessLine: "DIGITAL_TRANSFORMATION", stage: "LIVE_VALIDATION", created: "2026-04-27", owner: "nour", scope: "Release 1 · Arabic interface for the merchant app", description: "Offer the merchant app fully in Arabic, including receipts and support screens, so merchants stop asking support to translate." },
  { ref: "DEMO-720", slug: "agent-float-top-up", name: "Agent Float Top-Up", businessLine: "DIGITAL_TRANSFORMATION", stage: "DELIVERY", created: "2026-07-20", owner: "adam", scope: "Phase 1 · same-day float top-up for field agents", description: "Let field agents request a float top-up from the app and receive it the same day, so cash-in service is not interrupted." },
  { ref: "DEMO-730", slug: "bill-payment-refund-desk", name: "Bill Payment Refund Desk", businessLine: "BP", stage: "VALIDATION", created: "2026-06-30", owner: "mira", scope: "Release 1 · biller refund handling", description: "Handle bill-payment refunds through one desk with a biller-confirmed reversal file, so refunds stop being reconciled by hand." },
  { ref: "DEMO-740", slug: "merchant-loyalty-points", name: "Merchant Loyalty Points", businessLine: "FS", stage: "DELIVERY", created: "2026-08-03", owner: "lina", scope: "Phase 1 · points on accepted card transactions", description: "Award merchants points on accepted card transactions, to reward consistent acceptance. Redemption against fees is a later phase." },
  { ref: "DEMO-750", slug: "supplier-payment-financing", name: "Supplier Payment Financing", businessLine: "MF", stage: "ALIGNMENT", created: "2026-08-10", owner: "salma", scope: "Phase 1 · financed supplier invoices for merchants", description: "Pay a merchant's supplier invoice up front and collect it from settlements over an agreed period, extending the merchant finance offer to supply purchases." },
  { ref: "DEMO-760", slug: "card-present-fraud-rule-tuning", name: "Card-Present Fraud Rule Tuning", businessLine: "ACCEPTANCE", stage: "RELEASE_PREPARATION", created: "2026-07-13", owner: "hazem", scope: "Release 1 · tuned decline rules for card-present transactions", description: "Retune the card-present fraud rules so fewer genuine transactions are declined without raising the fraud rate." },
  { ref: "DEMO-770", slug: "merchant-onboarding-kiosk", name: "Merchant Onboarding Kiosk", businessLine: "DIGITAL_TRANSFORMATION", stage: "DISCOVERY", created: "2026-09-01", owner: "nour", scope: "Discovery · self-service onboarding kiosk proposal", description: "Explore a self-service kiosk in partner branches where a merchant can apply and be verified without an agent visit." },
  { ref: "DEMO-780", slug: "settlement-reconciliation-automation", name: "Settlement Reconciliation Automation", businessLine: "BP", stage: "DEFINITION", created: "2026-08-31", owner: "adam", scope: "Phase 1 · automated daily settlement matching", description: "Match acquirer settlement files to merchant payouts automatically each day, so Operations only reviews the exceptions." },
  { ref: "DEMO-790", slug: "dispute-resolution-portal", name: "Dispute Resolution Portal", businessLine: "ACCEPTANCE", stage: "DELIVERY", created: "2026-06-08", owner: "tarek", scope: "Release 1 · merchant dispute responses in the portal", description: "Let merchants respond to chargeback disputes in the portal with evidence uploads, instead of by email." },
  { ref: "DEMO-680", slug: "merchant-statement-archive", name: "Merchant Statement Archive", businessLine: "BP", stage: "MONITORING", created: "2026-03-09", owner: "adam", scope: "Release 1 · seven-year statement archive", description: "Keep merchant statements retrievable for seven years from the portal. Delivered and handed to Operations; records are kept for reference." },
];

/** Every fictional V4 record, registered on the shared timeline. */
export function extendWithV4(k: ScenarioKit) {
  const { day, dateFact, textFact, addEvidence, addClaim, commit, ask, relate, track } = k;
  for (const spec of V4_INITIATIVES) k.addInitiative(spec);

  // ── Delivery facts ──
  // Terminal Firmware Rollout: wave 1 live in two regions (partial), full target 20 October.
  dateFact("terminal-firmware-rollout", day("2026-06-08"), "DEV_STARTED", "2026-06-08", "tarek", "Certification build started.");
  dateFact("terminal-firmware-rollout", day("2026-06-15"), "TARGET_LIVE", "2026-10-20", "tarek", "Full wave plan target.");
  dateFact("terminal-firmware-rollout", day("2026-09-13", "09:00"), "ACTUAL_LIVE", "2026-09-12", "tarek", "Wave 1 live in two regions; remaining waves follow the plan.", { extent: "PARTIAL", text: "Wave 1 · two regions" });
  textFact("terminal-firmware-rollout", day("2026-09-13", "09:00"), "NEXT_MILESTONE", "Wave 2 regional rollout", "tarek", "Wave 2 planned.", { date: "2026-10-06" });
  textFact("terminal-firmware-rollout", day("2026-09-13", "09:00"), "NEXT_STEP", "Confirm the wave 2 terminal list with regional operations.", "tarek", "Recorded next step.");
  // Merchant App Arabic Localisation: delivered three days before its target.
  dateFact("merchant-app-arabic-localisation", day("2026-05-04"), "DEV_STARTED", "2026-05-04", "tarek", "Development started.");
  dateFact("merchant-app-arabic-localisation", day("2026-05-11"), "TARGET_LIVE", "2026-08-31", "nour", "Release target.");
  dateFact("merchant-app-arabic-localisation", day("2026-08-28", "16:00"), "ACTUAL_LIVE", "2026-08-28", "nour", "Full named scope released to all merchants.", { extent: "FULL", text: "Release 1 · Arabic interface for the merchant app" });
  textFact("merchant-app-arabic-localisation", day("2026-08-28", "16:00"), "NEXT_MILESTONE", "30-day live review", "nour", "Live review planned.", { date: "2026-09-28" });
  textFact("merchant-app-arabic-localisation", day("2026-08-28", "16:00"), "NEXT_STEP", "Review Arabic-language support tickets with Merchant Support.", "nour", "Recorded next step.");
  // Agent Float Top-Up: target in seven days.
  dateFact("agent-float-top-up", day("2026-08-10"), "DEV_STARTED", "2026-08-10", "tarek", "Development started.");
  dateFact("agent-float-top-up", day("2026-08-12"), "TARGET_LIVE", "2026-10-03", "adam", "Field pilot target.");
  textFact("agent-float-top-up", day("2026-09-15"), "NEXT_MILESTONE", "Field pilot readiness check", "adam", "Readiness check planned.", { date: "2026-09-30" });
  textFact("agent-float-top-up", day("2026-09-15"), "NEXT_STEP", "Confirm the float limits per agent tier with Finance.", "adam", "Recorded next step.");
  // Bill Payment Refund Desk: past target, no Actual Live, a recorded blocker and a past milestone.
  dateFact("bill-payment-refund-desk", day("2026-07-13"), "DEV_STARTED", "2026-07-13", "tarek", "Development started.");
  dateFact("bill-payment-refund-desk", day("2026-07-20"), "TARGET_LIVE", "2026-09-18", "mira", "Release target after biller file testing.");
  textFact("bill-payment-refund-desk", day("2026-09-15"), "BLOCKER", "The biller reversal file format has not been confirmed, so refunds cannot be posted automatically.", "mira", "Found in the refund posting test.");
  textFact("bill-payment-refund-desk", day("2026-09-15"), "NEXT_MILESTONE", "Biller file format sign-off", "mira", "Sign-off planned.", { date: "2026-09-22" });
  textFact("bill-payment-refund-desk", day("2026-09-15"), "NEXT_STEP", "Get the biller's written file format and re-run the refund posting test.", "mira", "Recorded next step.");
  // Merchant Loyalty Points: target moved earlier after a scope trim.
  dateFact("merchant-loyalty-points", day("2026-08-05"), "TARGET_LIVE", "2026-11-10", "lina", "Phase 1 target.");
  dateFact("merchant-loyalty-points", day("2026-08-24"), "DEV_STARTED", "2026-08-24", "tarek", "Development started.");
  dateFact("merchant-loyalty-points", day("2026-09-22", "09:00"), "TARGET_LIVE", "2026-10-28", "lina", "Moved earlier: redemption against fees moves to phase 2, so release 1 can land sooner.");
  textFact("merchant-loyalty-points", day("2026-09-22", "09:00"), "NEXT_MILESTONE", "Points ledger in UAT", "lina", "UAT planned.", { date: "2026-10-13" });
  textFact("merchant-loyalty-points", day("2026-09-22", "09:00"), "NEXT_STEP", "Confirm the points-per-transaction rule with Finance.", "lina", "Recorded next step.");
  // Supplier Payment Financing: alignment; its policy milestone needs Merchant Flex Finance, which lands later.
  dateFact("supplier-payment-financing", day("2026-08-24"), "TARGET_LIVE", "2026-11-16", "salma", "Phase 1 target, subject to credit policy approval.");
  textFact("supplier-payment-financing", day("2026-08-24"), "NEXT_MILESTONE", "Credit policy approval", "salma", "Risk committee slot planned.", { date: "2026-10-12" });
  textFact("supplier-payment-financing", day("2026-08-24"), "NEXT_STEP", "Bring the credit policy to the risk committee.", "salma", "Recorded next step.");
  // Card-Present Fraud Rule Tuning: target in five days, milestone two days before it.
  dateFact("card-present-fraud-rule-tuning", day("2026-07-27"), "DEV_STARTED", "2026-07-27", "tarek", "Rule tuning started.");
  dateFact("card-present-fraud-rule-tuning", day("2026-08-03"), "TARGET_LIVE", "2026-10-01", "hazem", "Release target after Compliance sign-off.");
  textFact("card-present-fraud-rule-tuning", day("2026-09-15"), "NEXT_MILESTONE", "Compliance sign-off", "hazem", "Sign-off meeting planned.", { date: "2026-09-29" });
  textFact("card-present-fraud-rule-tuning", day("2026-09-15"), "NEXT_STEP", "Present the shadow-mode results to Compliance.", "hazem", "Recorded next step.");
  // Merchant Onboarding Kiosk: Target Live recorded as Unknown; milestone named, date unknown.
  dateFact("merchant-onboarding-kiosk", day("2026-09-03"), "TARGET_LIVE", null, "nour", "Target explicitly unknown until a vendor is chosen.", { unknown: true });
  textFact("merchant-onboarding-kiosk", day("2026-09-03"), "NEXT_MILESTONE", "Kiosk vendor shortlist", "nour", "Date not confirmed.", { dateUnknown: true });
  textFact("merchant-onboarding-kiosk", day("2026-09-03"), "NEXT_STEP", "Shortlist kiosk vendors and estimate a pilot cost.", "nour", "Recorded next step.");
  // Settlement Reconciliation Automation: no target recorded at all; only a milestone and next step.
  textFact("settlement-reconciliation-automation", day("2026-09-10"), "NEXT_MILESTONE", "Matching rules workshop", "adam", "Workshop planned.", { date: "2026-10-07" });
  textFact("settlement-reconciliation-automation", day("2026-09-10"), "NEXT_STEP", "Agree the matching rules with Finance and Operations.", "adam", "Recorded next step.");
  // Dispute Resolution Portal: target moved three weeks later; milestone the day before the new target.
  dateFact("dispute-resolution-portal", day("2026-06-22"), "DEV_STARTED", "2026-06-22", "tarek", "Development started.");
  dateFact("dispute-resolution-portal", day("2026-06-29"), "TARGET_LIVE", "2026-09-14", "tarek", "Release target.");
  dateFact("dispute-resolution-portal", day("2026-09-08", "10:00"), "TARGET_LIVE", "2026-10-05", "tarek", "Moved three weeks: the card scheme changed its evidence format and the upload validation was rebuilt.");
  textFact("dispute-resolution-portal", day("2026-09-08", "10:00"), "NEXT_MILESTONE", "Scheme evidence format test", "tarek", "Test planned with the scheme.", { date: "2026-10-04" });
  textFact("dispute-resolution-portal", day("2026-09-08", "10:00"), "NEXT_STEP", "Complete the scheme evidence format test before UAT.", "tarek", "Recorded next step.");
  // Merchant Statement Archive: delivered in July, archived in September.
  dateFact("merchant-statement-archive", day("2026-03-16"), "DEV_STARTED", "2026-03-16", "tarek", "Development started.");
  dateFact("merchant-statement-archive", day("2026-03-23"), "TARGET_LIVE", "2026-06-30", "adam", "Release target.");
  dateFact("merchant-statement-archive", day("2026-07-01", "16:00"), "ACTUAL_LIVE", "2026-07-01", "adam", "Archive live for all merchants.", { extent: "FULL", text: "Release 1 · seven-year statement archive" });

  // ── Lifecycle moves and the archive ──
  k.move("terminal-firmware-rollout", "2026-09-13", "DELIVERY", "tarek");
  k.move("merchant-app-arabic-localisation", "2026-08-28", "RELEASE_PREPARATION", "nour");
  k.move("card-present-fraud-rule-tuning", "2026-09-19", "DELIVERY", "hazem");
  k.archive("merchant-statement-archive", "2026-09-05", "Delivered and handed to Operations; monitoring closed.", "adam");

  // ── Evidence ──
  const evidence: Parameters<typeof addEvidence>[0][] = [
    { key: "tfr-cert", slug: "terminal-firmware-rollout", title: "Contactless certification report", type: "DOCUMENT", ref: "Certification v3", occurred: "2026-06-05", summary: "The certified firmware build passed the contactless test suite on the two legacy device models." },
    { key: "tfr-wave", slug: "terminal-firmware-rollout", title: "Wave plan by region", type: "DOCUMENT", ref: "Wave plan v2", occurred: "2026-08-24", summary: "Three regional waves; wave 1 covers the two regions with the most legacy terminals." },
    { key: "tfr-epic", slug: "terminal-firmware-rollout", title: "Firmware rollout epic", type: "JIRA", ref: "DEMO-702", occurred: "2026-09-19", summary: "Wave 1 stories done; wave 2 stories in progress." },
    { key: "mal-spec", slug: "merchant-app-arabic-localisation", title: "Arabic localisation specification", type: "DOCUMENT", ref: "Spec v1", occurred: "2026-05-02", summary: "Every merchant-facing screen, receipt and notification available in Arabic with right-to-left layout." },
    { key: "mal-release", slug: "merchant-app-arabic-localisation", title: "Release note — Arabic interface", type: "EMAIL", ref: "Email · Release", occurred: "2026-08-28", summary: "Arabic interface released to all merchants on 28 August; language follows the device setting." },
    { key: "aft-brd", slug: "agent-float-top-up", title: "Float top-up requirements", type: "DOCUMENT", ref: "BRD v1", occurred: "2026-07-24", summary: "Agents request a top-up from the app; Finance approves within the agent's tier limit; float lands the same business day." },
    { key: "aft-epic", slug: "agent-float-top-up", title: "Float top-up epic", type: "JIRA", ref: "DEMO-721", occurred: "2026-09-18", summary: "Request and approval flows done; settlement leg in testing." },
    { key: "bpr-brd", slug: "bill-payment-refund-desk", title: "Refund desk requirements", type: "DOCUMENT", ref: "BRD v2", occurred: "2026-07-03", summary: "One refund desk for all billers, with automatic posting from a biller-confirmed reversal file." },
    { key: "bpr-test", slug: "bill-payment-refund-desk", title: "Refund posting test results", type: "EMAIL", ref: "Email · QA", occurred: "2026-09-15", summary: "Automatic posting fails: the biller's reversal file does not match the agreed format and the biller has not confirmed a change." },
    { key: "mlp-brd", slug: "merchant-loyalty-points", title: "Loyalty points requirements", type: "DOCUMENT", ref: "BRD v1", occurred: "2026-08-04", summary: "Points per accepted card transaction, a monthly statement of points, and redemption against fees in a later phase." },
    { key: "mlp-scope", slug: "merchant-loyalty-points", title: "Scope trim note", type: "DECISION_NOTE", ref: null, occurred: "2026-09-21", summary: "Redemption against fees moves to phase 2; release 1 awards and shows points only." },
    { key: "spf-proposal", slug: "supplier-payment-financing", title: "Supplier financing proposal", type: "DOCUMENT", ref: "Proposal v1", occurred: "2026-08-12", summary: "Finance the merchant's supplier invoice and collect it from settlements over an agreed period, reusing the merchant finance repayment engine." },
    { key: "spf-risk", slug: "supplier-payment-financing", title: "Credit policy working note", type: "DECISION_NOTE", ref: null, occurred: "2026-09-16", summary: "The credit policy must state the repayment rule; it cannot be approved before the daily repayment divisor is confirmed." },
    { key: "cpf-rules", slug: "card-present-fraud-rule-tuning", title: "Tuned rule set", type: "DOCUMENT", ref: "Rule set v4", occurred: "2026-07-15", summary: "Velocity and amount thresholds retuned per merchant category; shadow mode before enforcement." },
    { key: "cpf-shadow", slug: "card-present-fraud-rule-tuning", title: "Shadow-mode results", type: "EMAIL", ref: "Email · Fraud Risk", occurred: "2026-09-14", summary: "Four weeks of shadow mode: fraud rate falling, genuine declines rising slightly; Compliance review requested." },
    { key: "kiosk-note", slug: "merchant-onboarding-kiosk", title: "Kiosk discovery notes", type: "MEETING", ref: null, occurred: "2026-09-02", summary: "Partner branches would host a kiosk; identity verification at the kiosk is the open question." },
    { key: "sra-defs", slug: "settlement-reconciliation-automation", title: "Matching rules draft", type: "DOCUMENT", ref: "Rules v1", occurred: "2026-09-08", summary: "Match acquirer settlement lines to payouts by reference and amount; unmatched lines go to an exceptions queue." },
    { key: "drp-spec", slug: "dispute-resolution-portal", title: "Dispute portal specification", type: "DOCUMENT", ref: "Spec v2", occurred: "2026-06-10", summary: "Merchants see open disputes, upload evidence and submit a response before the scheme deadline." },
    { key: "drp-scheme", slug: "dispute-resolution-portal", title: "Scheme evidence format change", type: "EMAIL", ref: "Email · Scheme", occurred: "2026-09-05", summary: "The scheme now requires a structured evidence package; free-form uploads are rejected from October." },
    { key: "drp-epic", slug: "dispute-resolution-portal", title: "Dispute portal epic", type: "JIRA", ref: "DEMO-791", occurred: "2026-09-20", summary: "Upload validation rebuilt; format test with the scheme scheduled." },
    { key: "msa-handover", slug: "merchant-statement-archive", title: "Operations handover note", type: "DOCUMENT", ref: "Handover", occurred: "2026-08-30", summary: "Archive running for two months with no open defects; monitoring handed to Operations." },
  ];
  for (const e of evidence) addEvidence(e);

  // ── Knowledge ──
  const claims: Parameters<typeof addClaim>[0][] = [
    { key: "tfr-models", slug: "terminal-firmware-rollout", type: "REQUIREMENT", status: "ACTIVE", subject: "Certified firmware", attribute: "Device models", value: "Both legacy device models", domain: "TECHNICAL", ev: ["tfr-cert"], at: "2026-06-06", by: "tarek", verify: { at: "2026-06-07", by: "mira" } },
    { key: "tfr-waves", slug: "terminal-firmware-rollout", type: "DECISION", status: "ACTIVE", subject: "Rollout", attribute: "Wave order", value: "Regions with the most legacy terminals first", domain: "OPERATIONS", ev: ["tfr-wave"], at: "2026-08-25", by: "tarek", verify: { at: "2026-08-26", by: "adam" } },
    { key: "tfr-risk", slug: "terminal-firmware-rollout", type: "RISK", status: "ACTIVE", subject: "Offline terminals", attribute: "Update delivery", value: "Terminals that stay offline for weeks may never receive the update push", domain: "OPERATIONS", ev: ["tfr-wave"], at: "2026-08-25", by: "tarek", verify: { at: "2026-08-26", by: "adam" } },
    { key: "mal-rtl", slug: "merchant-app-arabic-localisation", type: "REQUIREMENT", status: "ACTIVE", subject: "Arabic interface", attribute: "Layout", value: "Right-to-left layout on every merchant-facing screen", domain: "PRODUCT", ev: ["mal-spec"], at: "2026-05-03", by: "nour", verify: { at: "2026-05-04", by: "mira" } },
    { key: "mal-language", slug: "merchant-app-arabic-localisation", type: "BUSINESS_RULE", status: "ACTIVE", subject: "Interface language", attribute: "Default", value: "Follows the device language setting", domain: "PRODUCT", ev: ["mal-spec", "mal-release"], at: "2026-05-03", by: "nour", verify: { at: "2026-05-04", by: "nour" } },
    { key: "aft-tier", slug: "agent-float-top-up", type: "BUSINESS_RULE", status: "ACTIVE", subject: "Top-up limit", attribute: "Basis", value: "The agent's tier limit", domain: "FINANCE", ev: ["aft-brd"], at: "2026-07-25", by: "adam", verify: { at: "2026-07-26", by: "salma" } },
    { key: "aft-sameday", slug: "agent-float-top-up", type: "REQUIREMENT", status: "ACTIVE", subject: "Top-up", attribute: "Settlement", value: "Float available the same business day", domain: "OPERATIONS", ev: ["aft-brd"], at: "2026-07-25", by: "adam", verify: { at: "2026-07-26", by: "adam" } },
    { key: "aft-assume", slug: "agent-float-top-up", type: "ASSUMPTION", status: "UNVERIFIED", subject: "Approval", attribute: "Turnaround", value: "Finance approves within two hours during business hours", domain: "FINANCE", ev: ["aft-brd"], at: "2026-09-15", by: "adam" },
    { key: "bpr-file", slug: "bill-payment-refund-desk", type: "REQUIREMENT", status: "ACTIVE", subject: "Refund posting", attribute: "Trigger", value: "Automatic from the biller-confirmed reversal file", domain: "OPERATIONS", ev: ["bpr-brd"], at: "2026-07-04", by: "mira", verify: { at: "2026-07-05", by: "adam" } },
    { key: "bpr-risk", slug: "bill-payment-refund-desk", type: "RISK", status: "ACTIVE", subject: "Reversal file format", attribute: "Mismatch", value: "The biller's file does not match the agreed format", domain: "EXTERNAL_PARTNER", ev: ["bpr-test"], at: "2026-09-15", by: "mira", verify: { at: "2026-09-15", by: "mira" } },
    { key: "mlp-rate", slug: "merchant-loyalty-points", type: "BUSINESS_RULE", status: "UNVERIFIED", subject: "Points", attribute: "Rate", value: "One point per accepted card transaction", domain: "FINANCE", ev: ["mlp-brd"], at: "2026-08-05", by: "lina" },
    { key: "mlp-redeem", slug: "merchant-loyalty-points", type: "DECISION", status: "ACTIVE", subject: "Redemption against fees", attribute: "Release", value: "Phase 2", domain: "PRODUCT", phase: "Phase 2", ev: ["mlp-scope"], at: "2026-09-21", by: "lina", verify: { at: "2026-09-21", by: "lina" } },
    { key: "spf-engine", slug: "supplier-payment-financing", type: "DEPENDENCY", status: "ACTIVE", subject: "Repayment engine", attribute: "Reuse", value: "Reuses the merchant finance repayment engine and its daily repayment rule", domain: "FINANCE", ev: ["spf-proposal", "spf-risk"], at: "2026-08-13", by: "salma", verify: { at: "2026-08-14", by: "salma" } },
    { key: "spf-period", slug: "supplier-payment-financing", type: "REQUIREMENT", status: "UNVERIFIED", subject: "Collection period", attribute: "Length", value: "Agreed per invoice, up to 90 days", domain: "FINANCE", ev: ["spf-proposal"], at: "2026-08-13", by: "salma" },
    { key: "cpf-shadow", slug: "card-present-fraud-rule-tuning", type: "DECISION", status: "ACTIVE", subject: "Tuned rules", attribute: "Rollout", value: "Shadow mode before enforcement", domain: "RISK", ev: ["cpf-rules"], at: "2026-07-16", by: "hazem", verify: { at: "2026-07-17", by: "hazem" } },
    { key: "cpf-risk", slug: "card-present-fraud-rule-tuning", type: "RISK", status: "ACTIVE", subject: "Genuine declines", attribute: "Trend", value: "Genuine transactions declined by the rules are rising slightly in shadow mode", domain: "RISK", ev: ["cpf-shadow"], at: "2026-09-14", by: "hazem", verify: { at: "2026-09-15", by: "hazem" } },
    { key: "kiosk-verify", slug: "merchant-onboarding-kiosk", type: "ASSUMPTION", status: "UNVERIFIED", subject: "Kiosk onboarding", attribute: "Identity verification", value: "Verification at the kiosk without an agent is acceptable to Compliance", domain: "COMPLIANCE", ev: ["kiosk-note"], at: "2026-09-03", by: "nour" },
    { key: "sra-match", slug: "settlement-reconciliation-automation", type: "REQUIREMENT", status: "UNVERIFIED", subject: "Settlement matching", attribute: "Key", value: "Reference and amount", domain: "DATA", ev: ["sra-defs"], at: "2026-09-09", by: "adam" },
    { key: "drp-deadline", slug: "dispute-resolution-portal", type: "REQUIREMENT", status: "ACTIVE", subject: "Dispute response", attribute: "Deadline", value: "Submitted before the scheme deadline shown to the merchant", domain: "PRODUCT", ev: ["drp-spec"], at: "2026-06-11", by: "tarek", verify: { at: "2026-06-12", by: "mira" } },
    { key: "drp-format", slug: "dispute-resolution-portal", type: "REQUIREMENT", status: "ACTIVE", subject: "Evidence upload", attribute: "Format", value: "Structured evidence package required by the scheme", domain: "EXTERNAL_PARTNER", ev: ["drp-scheme"], at: "2026-09-06", by: "tarek", verify: { at: "2026-09-07", by: "tarek" } },
    { key: "drp-risk", slug: "dispute-resolution-portal", type: "RISK", status: "ACTIVE", subject: "Scheme format", attribute: "Change", value: "The scheme may change the evidence package again before release", domain: "EXTERNAL_PARTNER", ev: ["drp-scheme"], at: "2026-09-06", by: "tarek", verify: { at: "2026-09-07", by: "hazem" } },
    { key: "msa-retention", slug: "merchant-statement-archive", type: "BUSINESS_RULE", status: "ACTIVE", subject: "Statements", attribute: "Retention", value: "Seven years", domain: "COMPLIANCE", ev: ["msa-handover"], at: "2026-08-30", by: "adam", verify: { at: "2026-08-31", by: "hazem" } },
  ];
  for (const c of claims) addClaim(c);

  // ── Commitments (two overdue at the scenario date, one blocked, some done) ──
  commit("tfr-wave2", "terminal-firmware-rollout", day("2026-09-13", "10:00"), "tarek", { title: "Confirm the wave 2 terminal list with regional operations", assignee: "adam", due: "2026-09-30" });
  commit("tfr-offline", "terminal-firmware-rollout", day("2026-08-26"), "tarek", { title: "List terminals offline for more than 14 days", assignee: "adam", due: "2026-09-12", status: "DONE", note: "Eighteen terminals listed for a field visit." });
  commit("mal-review", "merchant-app-arabic-localisation", day("2026-08-29"), "nour", { title: "Prepare the 30-day live review", assignee: "nour", due: "2026-09-26", status: "IN_PROGRESS" });
  commit("aft-limits", "agent-float-top-up", day("2026-09-15", "10:00"), "adam", { title: "Confirm the float limits per agent tier with Finance", assignee: "salma", due: "2026-09-23" });
  commit("bpr-format", "bill-payment-refund-desk", day("2026-09-15", "11:00"), "mira", { title: "Get the biller's written reversal file format", assignee: "mira", due: "2026-09-19", blocked: "The biller's operations contact has not replied." });
  commit("mlp-rule", "merchant-loyalty-points", day("2026-09-22", "09:30"), "lina", { title: "Confirm the points-per-transaction rule with Finance", assignee: "salma", due: "2026-10-03" });
  commit("spf-policy", "supplier-payment-financing", day("2026-08-24", "10:00"), "salma", { title: "Draft the supplier financing credit policy", assignee: "salma", due: "2026-10-05", status: "IN_PROGRESS" });
  commit("cpf-pack", "card-present-fraud-rule-tuning", day("2026-09-15", "10:00"), "hazem", { title: "Prepare the Compliance sign-off pack", assignee: "hazem", due: "2026-09-26", status: "IN_PROGRESS" });
  commit("drp-test", "dispute-resolution-portal", day("2026-09-08", "10:30"), "tarek", { title: "Book the evidence format test with the scheme", assignee: "tarek", due: "2026-09-19", status: "DONE", note: "Test booked for 4 October." });
  commit("sra-workshop", "settlement-reconciliation-automation", day("2026-09-10", "10:00"), "adam", { title: "Invite Finance and Operations to the matching rules workshop", assignee: "adam", due: "2026-09-30" });

  // ── Planning week (23–25 Sept): targets set or re-planned so the portfolio spans Q4 2026 to Q1 2027. ──
  // Recorded after the W38 Final and before the W39 Draft, so they surface as this week's changes. Dependency-linked dates are left as they are.
  dateFact("merchant-onboarding-kiosk", day("2026-09-23", "10:00"), "TARGET_LIVE", "2027-02-22", "nour", "Provisional planning date agreed with partner branches; the kiosk vendor is still to be chosen.");
  dateFact("settlement-reconciliation-automation", day("2026-09-23", "11:00"), "TARGET_LIVE", "2026-11-23", "adam", "Target after the matching rules workshop and a four-week build.");
  dateFact("installment-early-settlement", day("2026-09-24", "09:30"), "TARGET_LIVE", "2026-12-08", "reviewer", "Moved seven weeks: the settlement quote uses the daily repayment rule still awaiting a decision on Merchant Flex Finance.");
  dateFact("merchant-kyc-refresh", day("2026-09-24", "10:00"), "TARGET_LIVE", "2026-12-14", "nour", "Target set once the re-verification population was sized.");
  dateFact("agent-cash-in-network", day("2026-09-24", "11:00"), "TARGET_LIVE", "2027-03-15", "reviewer", "Provisional pilot window; to be confirmed when discovery closes.");
  dateFact("merchant-pricing-update", day("2026-09-24", "15:00"), "TARGET_LIVE", "2026-11-09", "reviewer", "Moved four weeks: the two recorded fee rates must be settled before merchants are given notice.");
  dateFact("partner-wallet-checkout", day("2026-09-25", "09:00"), "TARGET_LIVE", "2026-11-02", "lina", "Moved four weeks: the merchant name on receipts needs a change on the partner side.");
  dateFact("merchant-credit-line-pilot", day("2026-09-25", "10:00"), "TARGET_LIVE", "2026-11-03", "lina", "Go-live date set after the pilot terminals passed in the test environment.");
  dateFact("terminal-care-plan", day("2026-09-25", "14:30"), "TARGET_LIVE", "2027-01-18", "lina", "Target for the six-month coverage release, subject to Finance approving the monthly price.");

  // ── Open questions ──
  ask("kiosk-verify", "merchant-onboarding-kiosk", day("2026-09-03", "10:00"), "nour", { operation: "CREATE", question: "Can a merchant be identity-verified at a kiosk without an agent present?", owner: "hazem", expectedConfirmerText: "Compliance lead", dueDate: "2026-10-09" });
  ask("bpr-format", "bill-payment-refund-desk", day("2026-09-15", "11:10"), "mira", { operation: "CREATE", question: "Which reversal file format will the biller send from October?", owner: "mira", expectedConfirmerText: "Biller operations", dueDate: "2026-09-22" });
  ask("mlp-rate", "merchant-loyalty-points", day("2026-09-22", "09:40"), "lina", { operation: "CREATE", question: "Is one point per accepted transaction the rule for every merchant category?", owner: "salma", expectedConfirmerText: "Finance lead", dueDate: "2026-10-03" });

  // ── Relationships ──
  relate("spf-mff", day("2026-08-14"), "salma", "supplier-payment-financing", "merchant-flex-finance", "DEPENDS_ON", "The credit policy needs the confirmed daily repayment rule from Merchant Flex Finance.", { provider: "TARGET_LIVE", needed: "NEXT_MILESTONE" });
  relate("spf-kyc", day("2026-08-14", "09:10"), "salma", "supplier-payment-financing", "merchant-kyc-refresh", "DEPENDS_ON", "Merchants must be re-verified before any supplier invoice is financed.");
  relate("aft-kyc", day("2026-07-28"), "adam", "agent-float-top-up", "merchant-kyc-refresh", "RELATED_TO", "Agent identity checks follow the same re-verification policy.");
  relate("mlp-mpu", day("2026-08-06"), "lina", "merchant-loyalty-points", "merchant-pricing-update", "RELATED_TO", "Redemption against fees depends on the fee schedule the pricing update sets.");
  relate("drp-tfr", day("2026-09-08", "11:00"), "tarek", "dispute-resolution-portal", "terminal-firmware-rollout", "RELATED_TO", "Receipt data from certified firmware feeds the evidence package.");

  // ── Risk tracking ──
  track("tfr-offline", "tfr-risk", "terminal-firmware-rollout", [
    { at: day("2026-08-27"), by: "tarek", cmd: { operation: "START", ownerMemberId: "adam", mitigationText: "Field visits for terminals offline more than 14 days." } },
    { at: day("2026-09-13", "10:30"), by: "adam", cmd: { operation: "STATUS", status: "MITIGATING", reason: "Field visits scheduled for the listed terminals." } },
  ]);
  track("bpr-format", "bpr-risk", "bill-payment-refund-desk", [{ at: day("2026-09-15", "16:00"), by: "mira", cmd: { operation: "START", ownerMemberId: "mira", mitigationText: "Post refunds by hand until the biller confirms the format." } }]);
  track("cpf-declines", "cpf-risk", "card-present-fraud-rule-tuning", [{ at: day("2026-09-15", "16:00"), by: "hazem", cmd: { operation: "START", ownerMemberId: "hazem", mitigationText: "Review the merchant categories driving genuine declines before enforcement." } }]);
  track("drp-scheme", "drp-risk", "dispute-resolution-portal", [{ at: day("2026-09-08", "16:00"), by: "tarek", cmd: { operation: "START", ownerMemberId: "tarek", mitigationText: "Keep the evidence package mapping configurable." } }]);
}

/** The V4 generation: V3 plus the records above and the V4 synthetic measures. */
export function canonicalDemoDataV4(identity: DemoIdentity) {
  return buildDemoScenario(identity, { version: DEMO_V4_VERSION, extend: extendWithV4, metrics: demoPortfolioMetricsV4 });
}
