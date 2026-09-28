/**
 * Prodwise Demo v3 — the enriched, synthetic portfolio.
 *
 * Every record is fictional. Content was written from product-management *patterns*
 * (delivery slips, partner UAT gaps, requirement revisions, approval emails, report
 * clarifications) and never copies a real name, key, address, figure or wording.
 *
 * One dated timeline is applied in order through the same domain reducers the
 * product uses (facts, reviews, commitments, questions, relationships, risks,
 * dispositions), so every surface — Home, Brief, Roadmap, Weekly Review, History —
 * derives from the same canonical records. Nothing here is a dashboard number.
 */
import { createHash } from "node:crypto";
import { canonicalDemoDataV2, demoId, DEMO_CUTOFF, DEMO_ORGANIZATION_NAME, type DemoIdentity } from "./canonical.ts";
import { FIXTURE_ORIGIN_LABEL } from "./presentation.ts";
import type { ActivityEntry, ClaimRecord, ClaimTrust, ClaimType, ClaimStatus, Domain, EvidenceRecord, EvidenceRelation, EvidenceSourceType, FindingState, Initiative, InitiativeSnapshot, InitiativeSource, MemoryClaim } from "../domain/types.ts";
import type { DeliveryMember, DeliveryState, FactKind, FactValue, PortfolioSource, SectionEdit, WorkspaceAccess } from "../delivery/types.ts";
import { createReview, editSection, finalizeReview, recordFact } from "../delivery/model.ts";
import { reviseCommitment, type Commitment, type CommitmentEvent } from "../workspace/commitments.ts";
import { reviseQuestion, type OpenQuestion, type QuestionEvent, type QuestionCommand } from "../workspace/questions.ts";
import { reviseRelationship, type InitiativeRelationship, type RelationshipEvent, type RelationshipCommand } from "../workspace/relationships.ts";
import { reviseRisk, type RiskTracking, type RiskEvent, type RiskCommand } from "../workspace/risks.ts";
import { mapSourceItems, type SourceContainer, type SourceItem, type SourceMapping } from "../workspace/source-mapping.ts";
import type { InitiativeContext } from "../workspace/readiness.ts";
import { runReview } from "../review/engine.ts";
import { prepareDisposition, type FindingDisposition } from "../review/dispositions.ts";
import type { Anchor, Confirmation, MeetingNote, Proposal, ProposalPayload, ReadingAttempt, Submission } from "../evidence/types.ts";

export const DEMO_V3_VERSION = "prodwise-graduation-2026-09-v3";
export const DEMO_V3_CUTOFF = DEMO_CUTOFF;
const READER_MODEL = "synthetic-demo-fixture";

export interface DemoPersona { key: string; memberId: string; userId: string; displayName: string; title: string; email: string; role: "MEMBER"; isProductLead: boolean; }
type Scoped<T> = T & { workspaceId: string };
export interface DemoStoreV3 {
  initiatives: Scoped<Initiative>[]; activity: Scoped<ActivityEntry>[]; evidence: Scoped<EvidenceRecord>[]; sources: Scoped<InitiativeSource>[];
  claims: Scoped<ClaimRecord & ClaimTrust>[]; claimEvidence: Scoped<{ claimId: string; evidenceId: string; createdAt: string; locator: string | null; excerpt: string | null }>[];
  findingStates: Scoped<FindingState>[];
  findingDispositions: FindingDisposition[]; contexts: InitiativeContext[];
  sourceContainers: SourceContainer[]; sourceItems: SourceItem[]; sourceMappings: SourceMapping[];
  commitments: Commitment[]; commitmentEvents: CommitmentEvent[];
  openQuestions: OpenQuestion[]; questionEvents: QuestionEvent[];
  relationships: InitiativeRelationship[]; relationshipEvents: RelationshipEvent[];
  riskTracking: RiskTracking[]; riskEvents: RiskEvent[];
  meetingNotes: MeetingNote[]; evidenceSubmissions: Submission[]; evidenceAttempts: ReadingAttempt[]; evidenceAnchors: Anchor[]; evidenceProposals: Proposal[]; evidenceConfirmations: Confirmation[];
}

const PERSONAS: [string, string, string, boolean][] = [
  ["nour", "Nour Zaki", "Product Owner", true],
  ["lina", "Lina Haddad", "Product Owner", false],
  ["tarek", "Tarek Barakat", "Engineering Lead", false],
  ["salma", "Salma Rizk", "Finance Lead", false],
  ["adam", "Adam Wahba", "Operations Lead", false],
  ["mira", "Mira Doss", "QA Lead", false],
  ["hazem", "Hazem Lotfi", "Compliance Lead", false],
];

/** A deterministic request id per step, so replays of the generator produce identical records. */
const hashId = (seed: string) => { const h = createHash("sha256").update(seed).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };

export function canonicalDemoDataV3(identity: DemoIdentity) {
  const base = canonicalDemoDataV2(identity);
  const { workspaceId, organizationId, reviewerMemberId, reviewerUserId } = identity;
  const id = (key: string) => demoId(workspaceId, `v3:${key}`);
  const scoped = <T extends object>(v: T): Scoped<T> => ({ ...v, workspaceId });

  // ── Members: the reviewer plus fictional personas who own and act on work. ──
  // Persona users are one fixed identity across Demo generations (like the reviewer); memberships are per generation.
  const personas: DemoPersona[] = PERSONAS.map(([key, displayName, title, lead]) => ({ key, memberId: id(`member:${key}`), userId: demoId("personas", `v3:user:${key}`), displayName, title, email: `${key}@example.demo`, role: "MEMBER", isProductLead: lead }));
  const members: DeliveryMember[] = [
    { id: reviewerMemberId, workspaceId, displayName: "Demo Reviewer", role: "ORG_OWNER", active: true, isProductLead: false },
    ...personas.map(p => ({ id: p.memberId, workspaceId, displayName: p.displayName, role: "MEMBER" as const, active: true, isProductLead: p.isProductLead })),
  ];
  const P = Object.fromEntries(personas.map(p => [p.key, p])) as Record<string, DemoPersona>;
  const reviewer = { memberId: reviewerMemberId, userId: reviewerUserId, displayName: "Demo Reviewer" };
  const who = (key: string) => key === "reviewer" ? reviewer : P[key]!;
  const ctxOf = (key: string): WorkspaceAccess => key === "reviewer"
    ? { workspaceId, organizationId, memberId: reviewerMemberId, actor: { id: reviewerUserId, label: "Demo Reviewer" }, platformRole: null, role: "ORG_OWNER", isProductLead: false }
    : { workspaceId, organizationId, memberId: P[key]!.memberId, actor: { id: P[key]!.userId, label: P[key]!.displayName }, platformRole: null, role: "MEMBER", isProductLead: P[key]!.isProductLead };
  const fixtureCtx: WorkspaceAccess = { ...ctxOf("reviewer"), actor: { id: reviewerUserId, label: FIXTURE_ORIGIN_LABEL } };

  // ── Store: v1+v2 product rows are kept (content unchanged); their history is re-told below. ──
  const store: DemoStoreV3 = {
    initiatives: base.productStore.initiatives, activity: [], evidence: base.productStore.evidence, sources: base.productStore.sources,
    claims: base.productStore.claims, claimEvidence: base.productStore.claimEvidence, findingStates: [],
    findingDispositions: [], contexts: [], sourceContainers: [], sourceItems: [], sourceMappings: [],
    commitments: [], commitmentEvents: [], openQuestions: [], questionEvents: [], relationships: [], relationshipEvents: [], riskTracking: [], riskEvents: [],
    meetingNotes: [], evidenceSubmissions: [], evidenceAttempts: [], evidenceAnchors: [], evidenceProposals: [], evidenceConfirmations: [],
  };
  let state: DeliveryState = { schema: 1, facts: [], events: [], reviews: [] };
  const bySlug = (slug: string) => { const i = store.initiatives.find(x => x.slug === slug); if (!i) throw new Error(`Demo initiative ${slug} missing`); return i; };
  const log = (slug: string, at: string, eventType: string, summary: string, actor: string, extra: Partial<ActivityEntry> = {}) =>
    store.activity.push(scoped({ id: id(`activity:${store.activity.length}:${eventType}:${slug}`), initiativeId: bySlug(slug).id, eventType, summary, occurredAt: at, entityType: extra.entityType ?? null, entityId: extra.entityId ?? null, payload: extra.payload ?? null, actorLabel: actor === "fixture" ? FIXTURE_ORIGIN_LABEL : who(actor).displayName }));

  /** The portfolio source as it stands at the moment a step runs. */
  const source = (): PortfolioSource => {
    const snapshots: InitiativeSnapshot[] = store.initiatives.map(initiative => ({
      initiative, findingStates: store.findingStates.filter(f => f.initiativeId === initiative.id),
      evidence: store.evidence.filter(e => e.initiativeId === initiative.id),
      claims: store.claims.filter(c => c.initiativeId === initiative.id).map(c => {
        const links = store.claimEvidence.filter(l => l.claimId === c.id);
        // Same ordering as the repositories: newest capture first.
        return { ...c, evidence: store.evidence.filter(e => links.some(l => l.evidenceId === e.id)).sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt)), anchors: links.map(l => ({ evidenceId: l.evidenceId, locator: l.locator, excerpt: l.excerpt })) } as MemoryClaim;
      }),
    }));
    return { snapshots, members, contexts: store.contexts, commitments: store.commitments, commitmentEvents: store.commitmentEvents, findingDispositions: store.findingDispositions, queueFinalizations: state.reviews.filter(r => r.status === "FINAL").map(r => ({ id: r.id, workspaceId, finalizedAt: r.finalizedAt! })) } as PortfolioSource;
  };
  const ownerOf = (initiativeId: string) => state.facts.find(f => f.initiativeId === initiativeId && f.kind === "OWNER" && f.state === "SET")?.value.memberId ?? null;

  // ── Timeline: steps run in date order; ties keep authoring order. ──
  const steps: { at: string; n: number; run: () => void }[] = [];
  const at = (when: string, run: () => void) => steps.push({ at: when, n: steps.length, run });
  const day = (d: string, t = "09:00") => `${d}T${t}:00.000Z`;

  // New initiatives (v3). Existing v1/v2 initiatives keep their rows; only their dates are re-told.
  interface NewInitiative { ref: string; slug: string; name: string; businessLine: Initiative["businessLine"]; stage: Initiative["stage"]; created: string; description: string; archived?: { at: string; reason: string; by: string } }
  const newInitiatives: NewInitiative[] = [
    { ref: "DEMO-300", slug: "service-complaint-tracker", name: "Service Complaint Tracker", businessLine: "BP", stage: "LIVE_VALIDATION", created: "2026-06-09", description: "Let merchants raise and follow service complaints from the terminal instead of calling support, so complaints are categorised once and routed to the right team." },
    { ref: "DEMO-350", slug: "merchant-credit-line-pilot", name: "Merchant Credit Line Pilot", businessLine: "MF", stage: "RELEASE_PREPARATION", created: "2026-07-01", description: "Offer a short-term credit line to a whitelisted pilot cohort of merchants, repaid from settlements, to test demand before a wider rollout." },
    { ref: "DEMO-400", slug: "partner-wallet-checkout", name: "Partner Wallet Checkout", businessLine: "ACCEPTANCE", stage: "VALIDATION", created: "2026-06-23", description: "Accept payments from a partner digital wallet at the terminal with a receipt that shows the correct merchant details." },
    { ref: "DEMO-500", slug: "partner-bank-settlement-pack", name: "Partner Bank Settlement Pack", businessLine: "BP", stage: "DEFINITION", created: "2026-08-24", description: "Send a partner bank a weekly settlement report for merchants onboarded through its channel, so both sides reconcile the same numbers." },
    { ref: "DEMO-550", slug: "terminal-care-plan", name: "Terminal Care Plan", businessLine: "FS", stage: "DEFINITION", created: "2026-07-14", description: "Offer merchants an optional maintenance and replacement plan for their terminal, priced monthly and collected from settlements." },
    { ref: "DEMO-600", slug: "merchant-insights-app", name: "Merchant Insights App", businessLine: "DIGITAL_TRANSFORMATION", stage: "DELIVERY", created: "2026-07-06", description: "Give merchants transaction, summary and settlement reports in the mobile app so they stop requesting statements from support." },
    { ref: "DEMO-250", slug: "cashback-campaign-rules", name: "Cashback Campaign Rules", businessLine: "FS", stage: "LIVE_VALIDATION", created: "2026-05-11", description: "Configure the rules for a limited cashback campaign. The campaign has ended; records are kept for reference.", archived: { at: "2026-09-12", reason: "Campaign ended on schedule; records kept for reference.", by: "nour" } },
  ];
  for (const n of newInitiatives) {
    const row = scoped({ id: id(`initiative:${n.slug}`), slug: n.slug, name: n.name, businessLine: n.businessLine, stage: n.stage, description: `Synthetic demo scenario. ${n.description}`, knownReferences: n.ref, overallState: "UNKNOWN" as const, stateSummary: null, isDemo: true, createdAt: day(n.created), updatedAt: day(n.created) }) as Scoped<Initiative>;
    store.initiatives.push(row);
  }
  // Existing initiatives: creation dates follow the scenario, so History starts where the work did.
  const existingCreated: Record<string, string> = { "merchant-flex-finance": "2026-04-14", "instant-settlement-payout": "2026-02-02", "merchant-kyc-refresh": "2026-07-22", "collections-reporting-rebuild": "2026-08-11", "tap-to-pay-merchant-onboarding": "2026-05-18", "merchant-pricing-update": "2026-07-27", "agent-cash-in-network": "2026-09-08", "installment-early-settlement": "2026-08-17" };
  for (const [slug, created] of Object.entries(existingCreated)) { const i = bySlug(slug); i.createdAt = day(created); i.updatedAt = day(created); }
  for (const [slug, ref] of [["tap-to-pay-merchant-onboarding", "DEMO-150"], ["merchant-pricing-update", "DEMO-170"], ["installment-early-settlement", "DEMO-190"]] as const) bySlug(slug).knownReferences = ref;
  for (const i of store.initiatives) at(i.createdAt, () => log(i.slug, i.createdAt, "INITIATIVE_CREATED", `Initiative recorded: ${i.name}`, "fixture", { entityType: "INITIATIVE", entityId: i.id, payload: { synthetic: true, canonicalVersion: DEMO_V3_VERSION } }));

  // ── Scope contexts (current scope / phase) ──
  const scopes: Record<string, string> = {
    "merchant-flex-finance": "Phase 1 · Islamic merchant finance pilot", "instant-settlement-payout": "Pilot · same-day payout for eligible merchants", "merchant-kyc-refresh": "Phase 1 · merchant identity re-verification", "collections-reporting-rebuild": "Phase 1 · daily collections reporting pack",
    "tap-to-pay-merchant-onboarding": "Full rollout · Tap-to-Pay merchant onboarding", "merchant-pricing-update": "Phase 1 · merchant service fee update", "installment-early-settlement": "Phase 1 · installment early settlement", "agent-cash-in-network": "Discovery · agent cash-in pilot proposal",
    "service-complaint-tracker": "Release 1 · terminal complaint categories", "merchant-credit-line-pilot": "Pilot · whitelisted merchant cohort", "partner-wallet-checkout": "Phase 1 · partner wallet payments at the terminal", "partner-bank-settlement-pack": "Phase 1 · weekly settlement report", "terminal-care-plan": "Phase 1 · maintenance plan offer", "merchant-insights-app": "Release 1 · merchant reports in the app", "cashback-campaign-rules": "Campaign · limited cashback rules",
  };
  for (const [slug, label] of Object.entries(scopes)) {
    const i = bySlug(slug); const when = new Date(Date.parse(i.createdAt) + 3600000).toISOString();
    at(when, () => {
      const c: InitiativeContext = { id: id(`context:${slug}`), workspaceId, initiativeId: i.id, label, note: null, revision: 1, createdAt: when, updatedAt: when, retiredAt: null };
      store.contexts.push(c); i.currentContextId = c.id;
      // Entries recorded before scopes existed belong to the initiative's first scope.
      for (const claim of store.claims) if (claim.initiativeId === i.id && (claim as { contextId?: string | null }).contextId === undefined) (claim as { contextId?: string | null }).contextId = c.id;
      log(slug, when, "CONTEXT_CREATE", `Current scope set: ${label}`, "fixture", { entityType: "CONTEXT", entityId: c.id });
    });
  }

  // ── Delivery facts ──
  type FactStep = [string, string, FactKind, Partial<FactValue>, string, string];
  const fact = ([when, slug, kind, value, actor, note]: FactStep) => at(when, () => {
    const i = bySlug(slug); const old = state.facts.find(f => f.initiativeId === i.id && f.kind === kind);
    // Delivery facts are changed by the initiative owner or an administrator (the product's rule).
    const currentOwner = ownerOf(i.id); const ownerKey = currentOwner === reviewerMemberId ? "reviewer" : personas.find(p => p.memberId === currentOwner)?.key;
    const actorKey = actor === "fixture" ? null : actor === "reviewer" || who(actor).memberId === currentOwner ? actor : ownerKey ?? "reviewer";
    state = recordFact(state, source(), actorKey === null ? fixtureCtx : ctxOf(actorKey), { initiativeId: i.id, kind, expectedRevision: old?.revision ?? 0, value: { date: null, text: null, memberId: null, extent: null, ...value }, retract: false, basis: "DIRECT_KNOWLEDGE", note, evidenceId: null, locator: null }, when);
    const event = state.events.at(-1)!; event.id = id(`event:${slug}:${kind}:${event.after.revision}`); event.after.id = id(`fact:${slug}:${kind}`);
    const f = state.facts.find(x => x.initiativeId === i.id && x.kind === kind)!; f.id = event.after.id;
    if (actor === "fixture") { event.after.preparedAsFixture = true; f.preparedAsFixture = true; }
  });
  const scope = (slug: string, when: string) => fact([when, slug, "SCOPE", { text: scopes[slug]! }, "fixture", "Named scope confirmed."]);
  const owner = (slug: string, when: string, key: string, note = "Owner assigned.") => fact([when, slug, "OWNER", { memberId: who(key).memberId }, "fixture", note]);
  // Actual events (start, live) are recorded once they have happened, never ahead of time.
  const dateFact = (slug: string, when: string, kind: FactKind, date: string | null, actor: string, note: string, extra: Partial<FactValue> = {}) => fact([(kind === "DEV_STARTED" || kind === "ACTUAL_LIVE") && date && day(date, "16:00") > when ? day(date, "16:00") : when, slug, kind, { date, ...extra }, actor, note]);
  const textFact = (slug: string, when: string, kind: FactKind, text: string | null, actor: string, note: string, extra: Partial<FactValue> = {}) => fact([when, slug, kind, { text, ...extra }, actor, note]);
  const ownerKeys: Record<string, string> = { "merchant-flex-finance": "reviewer", "instant-settlement-payout": "lina", "merchant-kyc-refresh": "nour", "collections-reporting-rebuild": "reviewer", "tap-to-pay-merchant-onboarding": "nour", "merchant-pricing-update": "lina", "installment-early-settlement": "reviewer", "service-complaint-tracker": "nour", "merchant-credit-line-pilot": "lina", "partner-wallet-checkout": "lina", "partner-bank-settlement-pack": "nour", "terminal-care-plan": "lina", "merchant-insights-app": "adam", "cashback-campaign-rules": "nour" };
  for (const [slug, key] of Object.entries(ownerKeys)) { const created = bySlug(slug).createdAt; const t = new Date(Date.parse(created) + 2 * 3600000).toISOString(); scope(slug, t); owner(slug, t, key); }
  scope("agent-cash-in-network", day("2026-09-08", "11:00")); // Discovery: scope named, owner deliberately not assigned.
  // Owner change: Collections Reporting moves from the reviewer to Operations after definition starts.
  owner("collections-reporting-rebuild", day("2026-09-16", "08:00"), "adam", "Operations owns the reporting definitions from here.");

  // Merchant Flex Finance (story: repayment divisor conflict; target moved)
  dateFact("merchant-flex-finance", day("2026-08-20"), "DEV_STARTED", "2026-09-14", "fixture", "Development start planned for the pilot.");
  dateFact("merchant-flex-finance", day("2026-08-20"), "TARGET_LIVE", "2026-10-01", "reviewer", "Original committed pilot target.");
  textFact("merchant-flex-finance", day("2026-09-10"), "BLOCKER", "Daily repayment calculation needs a Finance decision: monthly installment divided by 27 or 30.", "reviewer", "Finance and Engineering recorded different divisors.");
  textFact("merchant-flex-finance", day("2026-09-10"), "NEXT_STEP", "Confirm the daily repayment rule with the Finance owner before changing the affected implementation.", "reviewer", "Recorded next step.");
  dateFact("merchant-flex-finance", day("2026-09-24", "10:00"), "TARGET_LIVE", "2026-10-15", "reviewer", "Pilot target moved while the calculation is reviewed and Finance sign-off is pending.");
  textFact("merchant-flex-finance", day("2026-09-24", "10:00"), "NEXT_MILESTONE", "Finance calculation review", "reviewer", "Review meeting planned; outcome unknown.", { date: "2026-09-29" });

  // Instant Settlement Payout (past target, partner cut-off blocker)
  dateFact("instant-settlement-payout", day("2026-06-01"), "DEV_STARTED", "2026-06-15", "tarek", "Development started with the partner sandbox.");
  dateFact("instant-settlement-payout", day("2026-08-05"), "TARGET_LIVE", "2026-09-10", "lina", "First pilot target.");
  dateFact("instant-settlement-payout", day("2026-09-03"), "TARGET_LIVE", "2026-09-24", "lina", "Target moved: partner cut-off time not confirmed.");
  textFact("instant-settlement-payout", day("2026-09-03"), "BLOCKER", "Partner cut-off confirmation has not been recorded for the pilot.", "lina", "Partner follow-up open.");
  textFact("instant-settlement-payout", day("2026-09-24", "10:00"), "NEXT_MILESTONE", "Partner cut-off confirmation", "lina", "Confirmation planned; no outcome inferred.", { date: "2026-09-28" });
  textFact("instant-settlement-payout", day("2026-09-03"), "NEXT_STEP", "Request the pilot cut-off confirmation from the partner owner.", "lina", "Recorded partner follow-up.");

  // Merchant KYC Refresh
  textFact("merchant-kyc-refresh", day("2026-08-01"), "NEXT_MILESTONE", "Agree the pilot population", "nour", "Milestone date not confirmed.", { dateUnknown: true });
  dateFact("merchant-kyc-refresh", day("2026-08-01"), "TARGET_LIVE", null, "nour", "Target Live explicitly unknown until the pilot population is agreed.", { unknown: true });
  textFact("merchant-kyc-refresh", day("2026-08-01"), "NEXT_STEP", "Confirm the pilot population and record an agreed delivery target.", "nour", "Schedule remains unknown.");

  // Collections Reporting Rebuild (depends on Merchant Flex Finance)
  dateFact("collections-reporting-rebuild", day("2026-08-14"), "DEV_STARTED", "2026-09-15", "fixture", "Start planned for the reporting scope.");
  dateFact("collections-reporting-rebuild", day("2026-08-14"), "TARGET_LIVE", "2026-10-15", "reviewer", "Current target for the reporting scope.");
  textFact("collections-reporting-rebuild", day("2026-09-16", "08:30"), "NEXT_MILESTONE", "Reporting definition review", "adam", "Working session planned.", { date: "2026-10-02" });
  textFact("collections-reporting-rebuild", day("2026-09-16", "08:30"), "NEXT_STEP", "Review the reporting definitions with the operations owner.", "adam", "No performance result inferred.");

  // Tap-to-Pay (live)
  dateFact("tap-to-pay-merchant-onboarding", day("2026-05-25"), "DEV_STARTED", "2026-06-01", "tarek", "Development started.");
  dateFact("tap-to-pay-merchant-onboarding", day("2026-06-10"), "TARGET_LIVE", "2026-09-10", "nour", "Rollout target.");
  dateFact("tap-to-pay-merchant-onboarding", day("2026-09-11"), "ACTUAL_LIVE", "2026-09-10", "nour", "Full named scope went live on the target date.", { extent: "FULL", text: scopes["tap-to-pay-merchant-onboarding"] });
  textFact("tap-to-pay-merchant-onboarding", day("2026-09-11"), "NEXT_MILESTONE", "30-day live review", "nour", "Live review planned.", { date: "2026-10-10" });
  textFact("tap-to-pay-merchant-onboarding", day("2026-09-11"), "NEXT_STEP", "Review the recorded onboarding observations with Operations.", "nour", "Recorded next step.");

  // Merchant Pricing Update (fee conflict)
  dateFact("merchant-pricing-update", day("2026-08-03"), "DEV_STARTED", "2026-08-03", "tarek", "Configuration work started.");
  dateFact("merchant-pricing-update", day("2026-08-10"), "TARGET_LIVE", "2026-10-12", "lina", "Target after UAT sign-off.");
  textFact("merchant-pricing-update", day("2026-09-15"), "NEXT_MILESTONE", "UAT sign-off", "lina", "UAT planned.", { date: "2026-10-01" });
  textFact("merchant-pricing-update", day("2026-09-15"), "NEXT_STEP", "Confirm the fee value with Finance before UAT sign-off.", "lina", "Recorded next step.");

  // Agent Cash-In Network — setup deliberately incomplete (no owner, no dates).
  textFact("agent-cash-in-network", day("2026-09-10"), "NEXT_STEP", "Assign a responsible PM and confirm the pilot proposal.", "fixture", "Discovery only.");

  // Installment Early Settlement
  dateFact("installment-early-settlement", day("2026-08-20"), "DEV_STARTED", "2026-09-01", "tarek", "Development started.");
  dateFact("installment-early-settlement", day("2026-08-20"), "TARGET_LIVE", "2026-10-20", "reviewer", "Target recorded.");
  textFact("installment-early-settlement", day("2026-09-18"), "NEXT_MILESTONE", "QA sign-off", "mira", "QA sign-off planned.", { date: "2026-10-06" });
  textFact("installment-early-settlement", day("2026-09-18"), "NEXT_STEP", "Review the settlement calculations with QA.", "reviewer", "Recorded next step.");

  // Service Complaint Tracker (live; UAT passed; one enhancement follow-up)
  dateFact("service-complaint-tracker", day("2026-06-20"), "DEV_STARTED", "2026-06-29", "tarek", "Development started.");
  dateFact("service-complaint-tracker", day("2026-07-01"), "TARGET_LIVE", "2026-09-15", "nour", "Release target.");
  dateFact("service-complaint-tracker", day("2026-09-16", "15:00"), "ACTUAL_LIVE", "2026-09-16", "nour", "Released after UAT; definition of done verified.", { extent: "FULL", text: scopes["service-complaint-tracker"] });
  textFact("service-complaint-tracker", day("2026-09-16", "15:00"), "NEXT_MILESTONE", "Two-week complaint volume review", "nour", "Review planned.", { date: "2026-09-30" });
  textFact("service-complaint-tracker", day("2026-09-16", "15:00"), "NEXT_STEP", "Watch complaint categories for mis-routing and agree the QR size enhancement.", "nour", "Recorded next step.");

  // Merchant Credit Line Pilot (Target Live explicitly unknown — the go-live date question is open)
  dateFact("merchant-credit-line-pilot", day("2026-07-20"), "DEV_STARTED", "2026-07-27", "tarek", "Development started.");
  dateFact("merchant-credit-line-pilot", day("2026-08-12"), "TARGET_LIVE", "2026-09-21", "lina", "First pilot target.");
  dateFact("merchant-credit-line-pilot", day("2026-09-21", "11:00"), "TARGET_LIVE", null, "lina", "Target withdrawn to Unknown: terminals are still in the test environment and no exact go-live date is agreed.", { unknown: true });
  textFact("merchant-credit-line-pilot", day("2026-09-21", "11:00"), "NEXT_MILESTONE", "Pilot terminals moved to production", "lina", "Date not confirmed.", { dateUnknown: true });
  textFact("merchant-credit-line-pilot", day("2026-09-21", "11:00"), "NEXT_STEP", "Get an exact go-live date from Operations once pilot terminals are updated.", "lina", "Recorded next step.");

  // Partner Wallet Checkout (validation; partner UAT gap)
  dateFact("partner-wallet-checkout", day("2026-07-06"), "DEV_STARTED", "2026-07-13", "tarek", "Development started.");
  dateFact("partner-wallet-checkout", day("2026-07-20"), "TARGET_LIVE", "2026-10-05", "lina", "Target after partner UAT.");
  textFact("partner-wallet-checkout", day("2026-09-24", "12:00"), "BLOCKER", "Partner receipt does not show the merchant name: the field fails when sent in the payment request.", "lina", "Found in partner UAT.");
  textFact("partner-wallet-checkout", day("2026-09-24", "12:00"), "NEXT_MILESTONE", "Partner UAT sign-off", "lina", "Sign-off planned.", { date: "2026-09-30" });
  textFact("partner-wallet-checkout", day("2026-09-24", "12:00"), "NEXT_STEP", "Agree with the partner how the merchant name is sent, then re-test.", "lina", "Recorded next step.");

  // Partner Bank Settlement Pack (definition; depends on the Insights app reports)
  textFact("partner-bank-settlement-pack", day("2026-09-01"), "NEXT_MILESTONE", "Report definition sign-off", "nour", "Sign-off planned.", { date: "2026-10-02" });
  dateFact("partner-bank-settlement-pack", day("2026-09-01"), "TARGET_LIVE", "2026-10-09", "nour", "First weekly report target.");
  textFact("partner-bank-settlement-pack", day("2026-09-24", "13:00"), "NEXT_STEP", "Confirm the settlement date definition in the report specification.", "nour", "Recorded next step.");

  // Terminal Care Plan (definition; coverage period conflict)
  textFact("terminal-care-plan", day("2026-08-03"), "NEXT_MILESTONE", "Pricing approval", "lina", "Approval needed before build.", { date: "2026-10-08" });
  dateFact("terminal-care-plan", day("2026-08-03"), "TARGET_LIVE", null, "lina", "Target unknown until pricing is approved.", { unknown: true });

  // Merchant Insights App (delivery; stories passed planned dates → target moved)
  dateFact("merchant-insights-app", day("2026-07-10"), "DEV_STARTED", "2026-07-20", "tarek", "Development started.");
  dateFact("merchant-insights-app", day("2026-07-15"), "TARGET_LIVE", "2026-09-30", "adam", "Release target.");
  textFact("merchant-insights-app", day("2026-09-17"), "NEXT_MILESTONE", "Report screens in UAT", "adam", "UAT planned.", { date: "2026-09-16" });
  dateFact("merchant-insights-app", day("2026-09-22", "08:00"), "TARGET_LIVE", "2026-10-14", "adam", "Moved two weeks: five report stories passed their planned dates without completion.");
  textFact("merchant-insights-app", day("2026-09-22", "08:00"), "NEXT_MILESTONE", "Report screens in UAT", "adam", "UAT re-planned.", { date: "2026-10-05" });
  textFact("merchant-insights-app", day("2026-09-22", "08:00"), "NEXT_STEP", "Re-plan the report stories and confirm the UAT date with QA.", "adam", "Recorded next step.");

  // Cashback Campaign Rules (archived after it ended)
  dateFact("cashback-campaign-rules", day("2026-05-20"), "TARGET_LIVE", "2026-06-01", "nour", "Campaign start.");
  dateFact("cashback-campaign-rules", day("2026-06-02"), "ACTUAL_LIVE", "2026-06-01", "nour", "Campaign rules live.", { extent: "FULL", text: scopes["cashback-campaign-rules"] });

  // ── Sources and evidence ──
  type Ev = { key: string; slug: string; title: string; type: EvidenceSourceType; ref: string | null; boundary?: EvidenceRelation; occurred: string; summary: string; by?: string };
  const evidenceSpecs: Ev[] = [
    // Merchant Flex Finance (extra evidence for density)
    { key: "mff-finance-memo", slug: "merchant-flex-finance", title: "Finance note on daily repayment", type: "EMAIL", ref: "Email · Finance", occurred: "2026-09-09", summary: "Finance states the daily repayment is the monthly installment divided by 27 settlement days." },
    { key: "mff-sprint", slug: "merchant-flex-finance", title: "Sprint review — repayment engine", type: "JIRA", ref: "DEMO-118", occurred: "2026-09-18", summary: "Engineering implemented the repayment engine with a divisor of 30 calendar days." },
    // Instant Settlement Payout
    { key: "isp-partner-mail", slug: "instant-settlement-payout", title: "Partner cut-off follow-up", type: "EMAIL", ref: "Email · Partner operations", occurred: "2026-09-02", summary: "Partner has not confirmed the daily cut-off time for same-day payouts." },
    { key: "isp-epic", slug: "instant-settlement-payout", title: "Same-day payout epic", type: "JIRA", ref: "DEMO-201", occurred: "2026-09-20", summary: "Epic status: ready for pre-production; two stories waiting for partner confirmation." },
    // Service Complaint Tracker
    { key: "sct-brd", slug: "service-complaint-tracker", title: "Complaint categories requirements v2", type: "DOCUMENT", ref: "BRD v2", occurred: "2026-06-15", summary: "Complaint categories, routing to the owning team, and status tracking from the terminal." },
    { key: "sct-uat", slug: "service-complaint-tracker", title: "UAT sign-off note", type: "EMAIL", ref: "Email · UAT", occurred: "2026-09-14", summary: "UAT completed; definition of done verified. Enhancement requested: smaller QR code on the receipt." },
    { key: "sct-story", slug: "service-complaint-tracker", title: "Track submitted complaints", type: "JIRA", ref: "DEMO-311", occurred: "2026-09-15", summary: "Story moved through testing, UAT and pre-production to ready for deployment." },
    { key: "sct-refinement", slug: "service-complaint-tracker", title: "Refinement session notes", type: "MEETING", ref: null, occurred: "2026-06-12", summary: "Categories agreed with support; bill-payment complaints route to the payments team." },
    // Merchant Credit Line Pilot (Story A)
    { key: "mcl-brd", slug: "merchant-credit-line-pilot", title: "Credit line pilot requirements v1", type: "DOCUMENT", ref: "BRD v1", occurred: "2026-07-08", summary: "Pilot credit limit tiered by each merchant's settlement volume." },
    { key: "mcl-approval", slug: "merchant-credit-line-pilot", title: "Pilot whitelist approval", type: "EMAIL", ref: "Email · Approval", occurred: "2026-09-20", summary: "Approved: one fixed credit limit for every whitelisted pilot merchant." },
    { key: "mcl-rollout", slug: "merchant-credit-line-pilot", title: "Pilot rollout thread", type: "EMAIL", ref: "Email · Rollout", occurred: "2026-09-21", summary: "Pilot terminals are uploaded to the test environment; no exact go-live date yet." },
    { key: "mcl-finance", slug: "merchant-credit-line-pilot", title: "Finance alignment for phase 2", type: "EMAIL", ref: "Email · Finance", boundary: "FUTURE_PHASE", occurred: "2026-09-20", summary: "Phase 2 will add customer installments; Finance alignment needed before development." },
    // Partner Wallet Checkout
    { key: "pwc-spec", slug: "partner-wallet-checkout", title: "Partner wallet integration specification", type: "DOCUMENT", ref: "Integration spec v2", occurred: "2026-07-01", summary: "Payment request fields, receipt content and settlement flow for partner wallet payments." },
    { key: "pwc-uat", slug: "partner-wallet-checkout", title: "Partner UAT results", type: "EMAIL", ref: "Email · Partner UAT", occurred: "2026-09-24", summary: "Receipt shows correct amounts but not the merchant name; adding the field to the request fails." },
    { key: "pwc-epic", slug: "partner-wallet-checkout", title: "Partner wallet epic", type: "JIRA", ref: "DEMO-402", occurred: "2026-09-22", summary: "Epic in testing; UAT with the partner in progress." },
    { key: "pwc-notes", slug: "partner-wallet-checkout", title: "Partner sync notes", type: "MEETING", ref: null, occurred: "2026-09-17", summary: "Discount offers tested; merchant name on receipts raised as an open point." },
    // Partner Bank Settlement Pack
    { key: "pbs-req", slug: "partner-bank-settlement-pack", title: "Weekly settlement report request", type: "EMAIL", ref: "Email · Requirements", occurred: "2026-09-23", summary: "Weekly report for merchants onboarded through the partner bank channel, to monitor settlements." },
    { key: "pbs-clarify", slug: "partner-bank-settlement-pack", title: "Report clarification replies", type: "EMAIL", ref: "Email · Clarification", occurred: "2026-09-24", summary: "Settlement date means the settlement between the processor and the merchant; only successful transactions are included." },
    { key: "pbs-ticket", slug: "partner-bank-settlement-pack", title: "Settlement report ticket", type: "JIRA", ref: "DEMO-517", occurred: "2026-09-23", summary: "Ticket created; engineering estimates the report ready by the end of next week." },
    // Terminal Care Plan (Story D)
    { key: "tcp-final", slug: "terminal-care-plan", title: "Care plan requirements — \"final version\"", type: "DOCUMENT", ref: "BRD final", occurred: "2026-06-24", summary: "Coverage period twelve months; replacement within five working days." },
    { key: "tcp-latest", slug: "terminal-care-plan", title: "Care plan requirements — \"latest version\"", type: "DOCUMENT", ref: "BRD v2", occurred: "2026-07-07", summary: "Coverage period six months; replacement within five working days." },
    { key: "tcp-pricing", slug: "terminal-care-plan", title: "Pricing working note", type: "DECISION_NOTE", ref: null, occurred: "2026-08-02", summary: "Monthly price to be collected from settlements; Finance approval pending." },
    { key: "tcp-mail", slug: "terminal-care-plan", title: "Coverage period correction", type: "EMAIL", ref: "Email · Product", occurred: "2026-09-25", summary: "Product clarifies the coverage period for the first release is six months." },
    // Merchant Insights App (Story B)
    { key: "mia-spec", slug: "merchant-insights-app", title: "Merchant reports specification", type: "DOCUMENT", ref: "Spec v1", occurred: "2026-07-08", summary: "Transaction list, summary per terminal, receipt view, export and wallet balance." },
    { key: "mia-slip", slug: "merchant-insights-app", title: "Past planned date notices", type: "JIRA", ref: "DEMO-640", occurred: "2026-09-17", summary: "Five report stories passed their planned date without completion." },
    { key: "mia-weekly", slug: "merchant-insights-app", title: "Weekly update draft", type: "DOCUMENT", ref: "Weekly update", occurred: "2026-08-29", summary: "Report screens in development; export feature at risk." },
    // KYC and Collections (density)
    { key: "kyc-policy", slug: "merchant-kyc-refresh", title: "Re-verification policy note", type: "DOCUMENT", ref: "Policy note", occurred: "2026-07-25", summary: "Merchants with identity documents older than the policy window need re-verification before financing." },
    { key: "crr-defs", slug: "collections-reporting-rebuild", title: "Collections report definitions draft", type: "DOCUMENT", ref: "Definitions v1", occurred: "2026-08-20", summary: "Daily collections pack fields and the cut-off time for each day's report." },
    // Cashback (archived)
    { key: "cash-rules", slug: "cashback-campaign-rules", title: "Campaign rules summary", type: "DOCUMENT", ref: "Campaign rules", occurred: "2026-05-15", summary: "Cashback per eligible transaction with a monthly cap per merchant, for a fixed campaign window." },
  ];
  const sourceFor = new Map<string, string>();
  for (const e of evidenceSpecs) {
    const i = bySlug(e.slug); const captured = day(e.occurred, "12:00");
    at(captured, () => {
      const kindName = e.type === "JIRA" ? "Jira project" : e.type === "EMAIL" ? "Email" : e.type === "MEETING" ? "Meetings" : e.type === "DECISION_NOTE" ? "Decision notes" : "Documents";
      const sourceKey = `${e.slug}:${e.type}`;
      if (!sourceFor.has(sourceKey)) {
        const s = scoped({ id: id(`source:${sourceKey}`), initiativeId: i.id, name: `Synthetic · ${i.name} ${kindName.toLowerCase()}`, sourceType: e.type, connectionState: "MANUAL" as const, lastSyncedAt: null, createdAt: captured, updatedAt: captured });
        store.sources.push(s); sourceFor.set(sourceKey, s.id);
      }
      store.evidence.push(scoped({ id: id(`evidence:${e.key}`), initiativeId: i.id, sourceId: sourceFor.get(sourceKey)!, title: e.title, sourceType: e.type, sourceReference: e.ref, sourceUrl: null, contentSummary: `Synthetic evidence. ${e.summary}`, boundary: e.boundary ?? "CURRENT_SCOPE", occurredAt: day(e.occurred, "10:00"), capturedAt: captured, lastVerifiedAt: null, createdBy: who(e.by ?? ownerKeys[e.slug] ?? "reviewer").userId, createdAt: captured, updatedAt: captured }));
      log(e.slug, captured, "EVIDENCE_ADDED", `Evidence added: ${e.title}`, e.by ?? ownerKeys[e.slug] ?? "reviewer", { entityType: "EVIDENCE", entityId: id(`evidence:${e.key}`) });
    });
  }
  // Existing v1/v2 evidence is re-dated to when it was captured in the scenario.
  for (const e of base.productStore.evidence) { const slug = store.initiatives.find(i => i.id === e.initiativeId)!.slug; const created = Date.parse(bySlug(slug).createdAt); const t = new Date(Math.max(created + 3 * 86400000, Math.min(Date.parse(e.capturedAt), Date.parse(DEMO_CUTOFF) - 86400000))).toISOString(); e.capturedAt = t; e.createdAt = t; e.updatedAt = t; }
  for (const s of base.productStore.sources) { const i = store.initiatives.find(x => x.id === s.initiativeId)!; const t = new Date(Date.parse(i.createdAt) + 3 * 86400000).toISOString(); s.createdAt = t; s.updatedAt = t; }

  // Source library references (Manage › Sources): each initiative maps its references.
  for (const i of store.initiatives) {
    const when = new Date(Date.parse(i.createdAt) + 4 * 86400000).toISOString();
    at(when, () => {
      const refs = store.evidence.filter(e => e.initiativeId === i.id && e.sourceReference && Date.parse(e.capturedAt) <= Date.parse(when) + 400 * 86400000);
      const groups: Record<string, typeof refs> = {};
      for (const e of refs) (groups[e.sourceType] ??= []).push(e);
      for (const [type, rows] of Object.entries(groups)) {
        const provider = type === "JIRA" ? "JIRA" : type === "EMAIL" ? "EMAIL" : type === "MEETING" ? "MEETING_NOTES" : "DOCUMENT";
        // A Jira item is its key (project = key prefix); other items get a readable, unique reference.
        const project = type === "JIRA" ? (rows[0]!.sourceReference ?? "DEMO-1").split("-")[0]! : null;
        const jiraRows = project ? rows.filter(e => /^[A-Z][A-Z0-9_]*-[1-9][0-9]*$/.test(e.sourceReference ?? "") && e.sourceReference!.startsWith(`${project}-`)) : rows;
        if (!jiraRows.length) continue;
        const lib = mapSourceItems({ containers: store.sourceContainers, items: store.sourceItems, mappings: store.sourceMappings, events: [] }, ctxOf("reviewer"), {
          initiativeId: i.id, provider, providerWorkspace: "demo.example", containerReference: project ?? `${provider.toLowerCase().replaceAll("_", "-")}-demo`, containerName: project ? `Demo delivery project ${project}` : provider === "EMAIL" ? "Demo mailbox" : provider === "MEETING_NOTES" ? "Demo meeting notes" : "Demo documents",
          role: type === "JIRA" ? "DELIVERY" : type === "DOCUMENT" ? "REQUIREMENTS" : type === "EMAIL" ? "DECISIONS" : "GENERAL",
          items: jiraRows.map(e => ({ reference: project ? e.sourceReference! : `${e.sourceReference} — ${e.title}`, name: e.title, kind: type, url: null })),
        }, when);
        // Deterministic ids: container by provider+reference, item by container+reference, mapping by initiative+item.
        const containerId = new Map(lib.containers.map(c => [c.id, id(`container:${c.provider}:${c.reference}`)]));
        const itemId = new Map(lib.items.map(it => [it.id, id(`item:${containerId.get(it.containerId)}:${it.reference}`)]));
        store.sourceContainers = lib.containers.map(c => ({ ...c, id: containerId.get(c.id)!, createdBy: reviewerUserId }));
        store.sourceItems = lib.items.map(it => ({ ...it, id: itemId.get(it.id)!, containerId: containerId.get(it.containerId)!, createdBy: reviewerUserId }));
        store.sourceMappings = lib.mappings.map(m => ({ ...m, id: id(`mapping:${m.initiativeId}:${itemId.get(m.itemId)}`), itemId: itemId.get(m.itemId)! }));
        // One event per mapping, as the product's own mapping path records it.
        for (const m of store.sourceMappings.filter(x => x.initiativeId === i.id && x.linkedAt === when)) log(i.slug, when, "SOURCE_MAPPED", "Source item mapped to initiative", "reviewer", { entityType: "SOURCE_MAPPING", entityId: m.id, payload: { before: null, after: m } });
      }
    });
  }

  // ── Knowledge ──
  type Cl = { key: string; slug: string; type: ClaimType; status: ClaimStatus; subject: string; attribute: string; value: string; domain: Domain; phase?: string | null; ev: string[]; at: string; by: string; verify?: { at: string; by: string }; supersedes?: string };
  const claimSpecs: Cl[] = [
    // Service Complaint Tracker
    { key: "sct-categories", slug: "service-complaint-tracker", type: "REQUIREMENT", status: "ACTIVE", subject: "Complaint categories", attribute: "Routing", value: "Each category routes to one owning team", domain: "OPERATIONS", ev: ["sct-brd"], at: "2026-06-16", by: "nour", verify: { at: "2026-06-18", by: "nour" } },
    { key: "sct-status", slug: "service-complaint-tracker", type: "REQUIREMENT", status: "ACTIVE", subject: "Complaint tracking", attribute: "Merchant view", value: "Merchant sees status of each submitted complaint on the terminal", domain: "PRODUCT", ev: ["sct-brd", "sct-story"], at: "2026-06-16", by: "nour", verify: { at: "2026-06-18", by: "mira" } },
    { key: "sct-bill-route", slug: "service-complaint-tracker", type: "DECISION", status: "ACTIVE", subject: "Bill-payment complaints", attribute: "Owning team", value: "Payments team", domain: "OPERATIONS", ev: ["sct-refinement"], at: "2026-06-13", by: "adam", verify: { at: "2026-06-14", by: "adam" } },
    { key: "sct-dod", slug: "service-complaint-tracker", type: "DECISION", status: "ACTIVE", subject: "Release 1", attribute: "UAT outcome", value: "Definition of done verified in UAT", domain: "QA", ev: ["sct-uat"], at: "2026-09-14", by: "mira", verify: { at: "2026-09-14", by: "mira" } },
    { key: "sct-qr", slug: "service-complaint-tracker", type: "REQUIREMENT", status: "UNVERIFIED", subject: "Receipt QR code", attribute: "Size", value: "Smaller QR code on terminal receipts", domain: "PRODUCT", phase: "Release 2", ev: ["sct-uat"], at: "2026-09-15", by: "nour" },
    { key: "sct-risk", slug: "service-complaint-tracker", type: "RISK", status: "ACTIVE", subject: "Category mis-routing", attribute: "Impact", value: "Complaints in an unclear category may wait with the wrong team", domain: "OPERATIONS", ev: ["sct-refinement"], at: "2026-09-16", by: "adam", verify: { at: "2026-09-17", by: "nour" } },
    // Merchant Credit Line Pilot (Story A)
    { key: "mcl-limit-tiered", slug: "merchant-credit-line-pilot", type: "REQUIREMENT", status: "ACTIVE", subject: "Pilot credit limit", attribute: "Limit rule", value: "Tiered by each merchant's monthly settlement volume", domain: "FINANCE", ev: ["mcl-brd"], at: "2026-07-09", by: "lina", verify: { at: "2026-07-10", by: "salma" } },
    { key: "mcl-cohort", slug: "merchant-credit-line-pilot", type: "DECISION", status: "ACTIVE", subject: "Pilot cohort", attribute: "Eligibility", value: "Whitelisted merchants from all regions", domain: "PRODUCT", ev: ["mcl-approval"], at: "2026-09-20", by: "lina", verify: { at: "2026-09-20", by: "lina" } },
    { key: "mcl-repay", slug: "merchant-credit-line-pilot", type: "BUSINESS_RULE", status: "ACTIVE", subject: "Repayment", attribute: "Source", value: "Deducted from daily settlements", domain: "FINANCE", ev: ["mcl-brd"], at: "2026-07-09", by: "lina", verify: { at: "2026-07-10", by: "salma" } },
    { key: "mcl-phase2", slug: "merchant-credit-line-pilot", type: "DEPENDENCY", status: "DEFERRED", subject: "Customer installments", attribute: "Finance alignment", value: "Needed before phase 2 development", domain: "FINANCE", phase: "Phase 2", ev: ["mcl-finance"], at: "2026-09-20", by: "lina" },
    { key: "mcl-risk", slug: "merchant-credit-line-pilot", type: "RISK", status: "ACTIVE", subject: "Pilot terminals", attribute: "Readiness", value: "Terminals not yet updated in production; go-live date cannot be fixed", domain: "OPERATIONS", ev: ["mcl-rollout"], at: "2026-09-21", by: "lina", verify: { at: "2026-09-21", by: "adam" } },
    // Partner Wallet Checkout
    { key: "pwc-receipt", slug: "partner-wallet-checkout", type: "REQUIREMENT", status: "ACTIVE", subject: "Partner receipt", attribute: "Merchant details", value: "Receipt shows the merchant name and terminal id", domain: "EXTERNAL_PARTNER", ev: ["pwc-spec"], at: "2026-07-02", by: "lina", verify: { at: "2026-07-03", by: "tarek" } },
    { key: "pwc-model", slug: "partner-wallet-checkout", type: "DECISION", status: "ACTIVE", subject: "Integration model", attribute: "Merchant identification", value: "Aggregator model: merchant details sent in each payment request", domain: "TECHNICAL", ev: ["pwc-spec"], at: "2026-07-02", by: "tarek", verify: { at: "2026-07-03", by: "tarek" } },
    { key: "pwc-offers", slug: "partner-wallet-checkout", type: "REQUIREMENT", status: "ACTIVE", subject: "Discount offers", attribute: "Receipt", value: "Discount shown as a separate receipt line", domain: "PRODUCT", ev: ["pwc-notes"], at: "2026-09-17", by: "lina", verify: { at: "2026-09-18", by: "mira" } },
    { key: "pwc-risk", slug: "partner-wallet-checkout", type: "RISK", status: "ACTIVE", subject: "Merchant name field", attribute: "Partner request", value: "Request fails when the merchant name is included", domain: "EXTERNAL_PARTNER", ev: ["pwc-uat"], at: "2026-09-24", by: "lina", verify: { at: "2026-09-24", by: "tarek" } },
    { key: "pwc-dep", slug: "partner-wallet-checkout", type: "DEPENDENCY", status: "ACTIVE", subject: "Same-day payout", attribute: "Settlement", value: "Partner wallet settlements use the same-day payout service", domain: "TECHNICAL", ev: ["pwc-spec"], at: "2026-07-02", by: "tarek", verify: { at: "2026-07-03", by: "tarek" } },
    // Partner Bank Settlement Pack
    { key: "pbs-scope", slug: "partner-bank-settlement-pack", type: "REQUIREMENT", status: "ACTIVE", subject: "Settlement report", attribute: "Population", value: "Merchants onboarded through the partner bank channel", domain: "DATA", ev: ["pbs-req"], at: "2026-09-23", by: "nour", verify: { at: "2026-09-23", by: "nour" } },
    { key: "pbs-frequency", slug: "partner-bank-settlement-pack", type: "REQUIREMENT", status: "ACTIVE", subject: "Settlement report", attribute: "Frequency", value: "Weekly", domain: "DATA", ev: ["pbs-req"], at: "2026-09-23", by: "nour", verify: { at: "2026-09-23", by: "nour" } },
    { key: "pbs-date", slug: "partner-bank-settlement-pack", type: "BUSINESS_RULE", status: "ACTIVE", subject: "Settlement date", attribute: "Definition", value: "Date of settlement between the processor and the merchant", domain: "FINANCE", ev: ["pbs-clarify"], at: "2026-09-24", by: "nour", verify: { at: "2026-09-24", by: "salma" } },
    { key: "pbs-success", slug: "partner-bank-settlement-pack", type: "BUSINESS_RULE", status: "ACTIVE", subject: "Settlement report", attribute: "Transactions included", value: "Successful transactions only", domain: "DATA", ev: ["pbs-clarify"], at: "2026-09-24", by: "nour", verify: { at: "2026-09-24", by: "nour" } },
    { key: "pbs-assume", slug: "partner-bank-settlement-pack", type: "ASSUMPTION", status: "UNVERIFIED", subject: "Report delivery", attribute: "Channel", value: "Report sent by secure email until a file transfer is agreed", domain: "EXTERNAL_PARTNER", ev: ["pbs-req"], at: "2026-09-24", by: "nour" },
    // Terminal Care Plan (Story D conflict)
    { key: "tcp-cover-12", slug: "terminal-care-plan", type: "REQUIREMENT", status: "ACTIVE", subject: "Care plan", attribute: "Coverage period", value: "12 months", domain: "PRODUCT", ev: ["tcp-final"], at: "2026-07-15", by: "lina", verify: { at: "2026-07-16", by: "lina" } },
    { key: "tcp-cover-6", slug: "terminal-care-plan", type: "REQUIREMENT", status: "ACTIVE", subject: "Care plan", attribute: "Coverage period", value: "6 months", domain: "PRODUCT", ev: ["tcp-latest"], at: "2026-07-16", by: "tarek", verify: { at: "2026-07-17", by: "tarek" } },
    { key: "tcp-replace", slug: "terminal-care-plan", type: "REQUIREMENT", status: "ACTIVE", subject: "Care plan", attribute: "Replacement time", value: "Within 5 working days", domain: "OPERATIONS", ev: ["tcp-final", "tcp-latest"], at: "2026-07-15", by: "lina", verify: { at: "2026-07-16", by: "adam" } },
    { key: "tcp-collect", slug: "terminal-care-plan", type: "BUSINESS_RULE", status: "UNVERIFIED", subject: "Care plan price", attribute: "Collection", value: "Collected monthly from settlements", domain: "FINANCE", ev: ["tcp-pricing"], at: "2026-08-03", by: "lina" },
    { key: "tcp-risk", slug: "terminal-care-plan", type: "RISK", status: "ACTIVE", subject: "Replacement stock", attribute: "Availability", value: "Replacement terminals may not be in stock in every region", domain: "OPERATIONS", ev: ["tcp-final"], at: "2026-08-04", by: "adam", verify: { at: "2026-08-05", by: "adam" } },
    // Merchant Insights App (Story B)
    { key: "mia-reports", slug: "merchant-insights-app", type: "REQUIREMENT", status: "ACTIVE", subject: "Merchant reports", attribute: "Release 1 content", value: "Transaction list, summary per terminal, receipt view", domain: "PRODUCT", ev: ["mia-spec"], at: "2026-07-09", by: "adam", verify: { at: "2026-07-10", by: "adam" } },
    { key: "mia-export", slug: "merchant-insights-app", type: "REQUIREMENT", status: "DEFERRED", subject: "Report export", attribute: "Release", value: "Export and share moved to release 2", domain: "PRODUCT", phase: "Release 2", ev: ["mia-weekly"], at: "2026-08-29", by: "adam" },
    { key: "mia-empty", slug: "merchant-insights-app", type: "BUSINESS_RULE", status: "ACTIVE", subject: "Guest merchants", attribute: "Empty state", value: "Guests without a terminal are routed to request one", domain: "PRODUCT", ev: ["mia-spec"], at: "2026-07-09", by: "adam", verify: { at: "2026-07-10", by: "mira" } },
    { key: "mia-risk", slug: "merchant-insights-app", type: "RISK", status: "ACTIVE", subject: "Report stories", attribute: "Schedule", value: "Report stories are running past their planned dates", domain: "DELIVERY", ev: ["mia-slip"], at: "2026-09-17", by: "adam", verify: { at: "2026-09-17", by: "tarek" } },
    // KYC / Collections / Cashback
    { key: "kyc-window", slug: "merchant-kyc-refresh", type: "BUSINESS_RULE", status: "ACTIVE", subject: "Identity documents", attribute: "Re-verification trigger", value: "Older than the policy window", domain: "COMPLIANCE", ev: ["kyc-policy"], at: "2026-07-26", by: "hazem", verify: { at: "2026-07-27", by: "hazem" } },
    { key: "kyc-before-fin", slug: "merchant-kyc-refresh", type: "DEPENDENCY", status: "ACTIVE", subject: "Merchant financing", attribute: "Precondition", value: "Re-verification completed before any disbursement", domain: "COMPLIANCE", ev: ["kyc-policy"], at: "2026-07-26", by: "hazem", verify: { at: "2026-07-27", by: "nour" } },
    { key: "kyc-q-assume", slug: "merchant-kyc-refresh", type: "ASSUMPTION", status: "UNVERIFIED", subject: "Pilot population", attribute: "Size", value: "About one in ten active merchants need re-verification", domain: "COMPLIANCE", ev: ["kyc-policy"], at: "2026-08-02", by: "nour" },
    { key: "crr-cutoff", slug: "collections-reporting-rebuild", type: "REQUIREMENT", status: "ACTIVE", subject: "Daily collections pack", attribute: "Cut-off time", value: "06:00 Cairo", domain: "DATA", ev: ["crr-defs"], at: "2026-08-21", by: "reviewer", verify: { at: "2026-08-22", by: "adam" } },
    { key: "crr-include", slug: "collections-reporting-rebuild", type: "REQUIREMENT", status: "UNVERIFIED", subject: "Daily collections pack", attribute: "Financing repayments", value: "Included once merchant financing is live", domain: "DATA", ev: ["crr-defs"], at: "2026-08-21", by: "reviewer" },
    { key: "cash-cap", slug: "cashback-campaign-rules", type: "BUSINESS_RULE", status: "ACTIVE", subject: "Cashback", attribute: "Monthly cap", value: "Capped per merchant per month", domain: "FINANCE", ev: ["cash-rules"], at: "2026-05-16", by: "nour", verify: { at: "2026-05-17", by: "salma" } },
    // Merchant Flex Finance extra (verified entries so setup completes)
    { key: "mff-pilot-size", slug: "merchant-flex-finance", type: "DECISION", status: "ACTIVE", subject: "Pilot scope", attribute: "Merchant cap", value: "Limited to 40 merchants in the first month", domain: "PRODUCT", ev: ["mff-finance-memo"], at: "2026-09-25", by: "reviewer", verify: { at: "2026-09-25", by: "reviewer" } },
  ];
  for (const c of claimSpecs) {
    const when = day(c.at, "13:00");
    at(when, () => {
      const i = bySlug(c.slug);
      const row = scoped({ id: id(`claim:${c.key}`), initiativeId: i.id, type: c.type, status: c.status === "ACTIVE" ? "UNVERIFIED" : c.status, subject: c.subject, attribute: c.attribute, value: c.value, domain: c.domain, phase: c.phase ?? null, confidence: null, supersededByClaimId: null, createdBy: who(c.by).userId, createdAt: when, updatedAt: when, origin: "HUMAN_ENTRY" as const, verifiedAt: null, verifiedActorId: null, verifiedActorLabel: null, verificationBasis: null, verificationNote: null, contextId: i.currentContextId ?? null }) as unknown as Scoped<ClaimRecord & ClaimTrust>;
      store.claims.push(row);
      for (const e of c.ev) store.claimEvidence.push(scoped({ claimId: row.id, evidenceId: id(`evidence:${e}`), createdAt: when, locator: null, excerpt: null }));
    });
    if (c.status === "ACTIVE" && c.verify) {
      const v = day(c.verify.at, "15:00");
      at(v, () => {
        const row = store.claims.find(x => x.id === id(`claim:${c.key}`))!;
        Object.assign(row, { status: "ACTIVE", verifiedAt: v, verifiedActorId: who(c.verify!.by).userId, verifiedActorLabel: who(c.verify!.by).displayName, verificationBasis: "EVIDENCE", verificationNote: null, updatedAt: v });
        log(c.slug, v, "CLAIM_VERIFIED", `${c.subject} verified`, c.verify!.by, { entityType: "CLAIM", entityId: row.id, payload: { subject: `${c.subject} · ${c.attribute}` } });
      });
    }
  }
  // Existing v1/v2 claims: created with their initiative's evidence; ACTIVE legacy claims keep "verification history not recorded".
  for (const c of base.productStore.claims) { const i = store.initiatives.find(x => x.id === c.initiativeId)!; const t = new Date(Math.min(Date.parse(i.createdAt) + 10 * 86400000, Date.parse(DEMO_CUTOFF) - 2 * 86400000)).toISOString(); c.createdAt = t; c.updatedAt = t; if (i.currentContextId === undefined) { /* set after contexts run */ } }

  // Story A — an approval email changes the credit limit rule; the earlier requirement is superseded.
  const creditLine = () => bySlug("merchant-credit-line-pilot");
  const storyAt = day("2026-09-20", "16:00");
  at(storyAt, () => {
    const i = creditLine(); const oldClaim = store.claims.find(c => c.id === id("claim:mcl-limit-tiered"))!;
    const text = "Approved: one fixed credit limit for every whitelisted pilot merchant, from all regions. Tiering by settlement volume is not used in the pilot.";
    const sub = pasted(i, "mcl-approval-text", "Pilot whitelist approval (email)", text, storyAt, "lina");
    const quote = "one fixed credit limit for every whitelisted pilot merchant";
    const { attempt, anchor, proposal } = read(sub, quote, "CHANGED_REQUIREMENT", { subject: oldClaim.subject, attribute: oldClaim.attribute, value: "One fixed limit for every whitelisted pilot merchant", domain: "FINANCE", phase: null, targetClaimId: oldClaim.id, targetClaimUpdatedAt: oldClaim.updatedAt }, storyAt);
    const newId = id("claim:mcl-limit-fixed");
    store.claims.push(scoped({ ...oldClaim, id: newId, value: "One fixed limit for every whitelisted pilot merchant", status: "UNVERIFIED", supersededByClaimId: null, createdBy: P.lina!.userId, createdAt: storyAt, updatedAt: storyAt, origin: "HUMAN_ENTRY", verifiedAt: null, verifiedActorId: null, verifiedActorLabel: null, verificationBasis: null, verificationNote: null, evidenceSubmissionId: sub.id, evidenceAnchorId: anchor.id } as Scoped<ClaimRecord & ClaimTrust>));
    store.claimEvidence.push(scoped({ claimId: newId, evidenceId: sub.evidenceId, createdAt: storyAt, locator: `quoted passage`, excerpt: quote }));
    Object.assign(oldClaim, { status: "SUPERSEDED", supersededByClaimId: newId, updatedAt: storyAt });
    confirm(proposal, "KNOWLEDGE", newId, "lina", storyAt, "Approval email replaces the tiered limit.");
    log("merchant-credit-line-pilot", storyAt, "CLAIM_SUPERSEDED", `Pilot credit limit · Limit rule: "Tiered by each merchant's monthly settlement volume" replaced by "One fixed limit for every whitelisted pilot merchant"`, "lina", { entityType: "CLAIM", entityId: oldClaim.id });
    void attempt;
  });
  at(day("2026-09-21", "09:30"), () => {
    const c = store.claims.find(x => x.id === id("claim:mcl-limit-fixed"))!; const t = day("2026-09-21", "09:30");
    Object.assign(c, { status: "ACTIVE", verifiedAt: t, verifiedActorId: P.salma!.userId, verifiedActorLabel: P.salma!.displayName, verificationBasis: "EVIDENCE", updatedAt: t });
    log("merchant-credit-line-pilot", t, "CLAIM_VERIFIED", "Pilot credit limit verified", "salma", { entityType: "CLAIM", entityId: c.id, payload: { subject: "Pilot credit limit · Limit rule" } });
  });

  // ── Evidence pipeline helpers (pasted text and meeting notes) ──
  function pasted(i: Initiative, key: string, title: string, text: string, when: string, by: string, meeting?: { date: string; attendees: string }): Submission {
    const evidenceId = id(`evidence:${key}`);
    store.evidence.push(scoped({ id: evidenceId, initiativeId: i.id, sourceId: null, title, sourceType: meeting ? "MEETING" : "EMAIL", sourceReference: meeting ? `meeting:${meeting.date}:${key}:${evidenceId.slice(0, 8)}` : null, sourceUrl: null, contentSummary: `Synthetic ${meeting ? "meeting notes" : "saved text"}: ${title}`, boundary: "CURRENT_SCOPE", occurredAt: when, capturedAt: when, lastVerifiedAt: null, createdBy: who(by).userId, createdAt: when, updatedAt: when }));
    const sub: Submission = { id: id(`submission:${key}`), workspaceId, organizationId, initiativeId: i.id, sourceItemId: id(`item:submission:${key}`), evidenceId, kind: meeting ? "MEETING_NOTES" : "PASTED", title, text, textSha256: createHash("sha256").update(text, "utf8").digest("hex"), charLength: text.length, createdBy: who(by).userId, createdAt: when, requestId: hashId(`submission:${key}`) };
    store.evidenceSubmissions.push(sub);
    if (meeting) store.meetingNotes.push({ submissionId: sub.id, workspaceId, initiativeId: i.id, title, meetingDate: meeting.date, attendeesText: meeting.attendees, revision: 1, createdBy: who(by).userId, createdAt: when, updatedBy: who(by).userId, updatedAt: when });
    log(i.slug, when, meeting ? "MEETING_NOTES_SAVED" : "EVIDENCE_SAVED", meeting ? `Meeting notes added: ${title}` : `Evidence saved: ${title}`, by, { entityType: "EVIDENCE", entityId: evidenceId, payload: { submissionId: sub.id } });
    return sub;
  }
  const attempts = new Map<string, ReadingAttempt>();
  function read(sub: Submission, quote: string, type: Proposal["type"], payload: ProposalPayload, when: string, baseRevision = 0) {
    let attempt = attempts.get(sub.id);
    if (!attempt) { attempt = { id: id(`attempt:${sub.id}`), workspaceId, initiativeId: sub.initiativeId, submissionId: sub.id, requestId: hashId(`attempt:${sub.id}`), status: "READY", startedAt: when, endedAt: when, errorCode: null, model: READER_MODEL, promptVersion: "demo", discardedCount: 0 }; attempts.set(sub.id, attempt); store.evidenceAttempts.push(attempt); }
    const start = sub.text.indexOf(quote); if (start < 0) throw new Error(`Demo quote not found: ${quote}`);
    const anchor: Anchor = { id: id(`anchor:${sub.id}:${start}`), workspaceId, initiativeId: sub.initiativeId, submissionId: sub.id, start, end: start + quote.length, quote };
    store.evidenceAnchors.push(anchor);
    const proposal: Proposal = { id: id(`proposal:${sub.id}:${start}:${type}`), workspaceId, initiativeId: sub.initiativeId, submissionId: sub.id, attemptId: attempt.id, anchorId: anchor.id, type, payload, version: 1, baseRevision, status: "PENDING", decidedBy: null, decidedAt: null, reason: null, resultType: null, resultId: null };
    store.evidenceProposals.push(proposal);
    return { attempt, anchor, proposal };
  }
  function confirm(p: Proposal, resultType: string, resultId: string, by: string, when: string, reason: string | null = null) {
    Object.assign(p, { status: "CONFIRMED", version: p.version + 1, decidedBy: who(by).userId, decidedAt: when, reason, resultType, resultId });
    store.evidenceConfirmations.push({ proposalId: p.id, workspaceId, initiativeId: p.initiativeId, proposalVersion: 1, actorId: who(by).userId, actorLabel: who(by).displayName, at: when, resultType, resultId, requestId: hashId(`confirm:${p.id}`) });
    const sub = store.evidenceSubmissions.find(s => s.id === p.submissionId)!; const slug = store.initiatives.find(i => i.id === p.initiativeId)!.slug;
    log(slug, when, "AI_PROPOSAL_CONFIRMED", `Human confirmed ${p.type.toLowerCase()} proposal from ${sub.title}`, by, { entityType: resultType, entityId: resultId, payload: { proposalId: p.id, submissionId: sub.id, receipt: { type: resultType, id: resultId } } });
  }
  function reject(p: Proposal, by: string, when: string, reason: string) {
    Object.assign(p, { status: "REJECTED", version: p.version + 1, decidedBy: who(by).userId, decidedAt: when, reason });
    const slug = store.initiatives.find(i => i.id === p.initiativeId)!.slug;
    log(slug, when, "AI_PROPOSAL_REJECTED", `Proposal rejected: ${reason}`, by, { entityType: "PROPOSAL", entityId: p.id });
  }

  // ── Commitments ──
  const commitmentKeys = new Map<string, string>();
  function commit(key: string, slug: string, when: string, by: string, input: { title: string; assignee: string | null; due: string | null; status?: Commitment["status"]; blocked?: string | null; note?: string; evidence?: string | null; origin?: Commitment["origin"]; originRef?: string | null; originHref?: string | null }) {
    at(when, () => {
      const i = bySlug(slug); const existingId = commitmentKeys.get(key); const before = existingId ? store.commitments.find(a => a.id === existingId) : undefined;
      const r = reviseCommitment(store.commitments, store.commitmentEvents, { id: before?.id, requestId: hashId(`commit:${key}:${when}`), expectedRevision: before?.revision ?? 0, title: input.title, assigneeMemberId: input.assignee ? who(input.assignee).memberId : null, dueDate: input.due, status: input.status ?? "OPEN", blockedNote: input.blocked ?? null, evidenceId: input.evidence ? id(`evidence:${input.evidence}`) : null, note: input.note ?? "", origin: input.origin, originRefId: input.originRef ?? null, originHref: input.originHref ?? null }, ctxOf(by), i, ownerOf(i.id), members, store.evidence.filter(e => e.initiativeId === i.id).map(e => e.id), when);
      if (!r.event) return;
      const action = { ...r.action, id: before?.id ?? id(`commitment:${key}`) }; const event = { ...r.event, id: id(`commitment-event:${key}:${action.revision}`), actionId: action.id, after: action, before: before ?? null };
      store.commitments = before ? store.commitments.map(a => a.id === action.id ? action : a) : [...store.commitments, action];
      store.commitmentEvents.push(event); commitmentKeys.set(key, action.id);
      log(slug, when, `COMMITMENT_${event.type}`, event.type === "CREATED" ? `Commitment recorded: ${action.title}` : `Commitment ${action.status.toLowerCase().replaceAll("_", " ")}: ${action.title}`, by, { entityType: "COMMITMENT", entityId: action.id });
    });
  }
  // Story E — an overdue commitment surfaces in a Final review, then completes; another is overdue now.
  commit("sct-training", "service-complaint-tracker", day("2026-09-08"), "nour", { title: "Brief the support team on the new complaint categories", assignee: "adam", due: "2026-09-15" });
  commit("sct-training", "service-complaint-tracker", day("2026-09-23", "11:00"), "adam", { title: "Brief the support team on the new complaint categories", assignee: "adam", due: "2026-09-15", status: "DONE", note: "Briefing held with all support shifts." });
  commit("sct-qr", "service-complaint-tracker", day("2026-09-16", "16:00"), "nour", { title: "Agree the QR code size change for release 2", assignee: "tarek", due: "2026-09-22", evidence: "sct-uat" });
  commit("sct-report", "service-complaint-tracker", day("2026-09-17"), "nour", { title: "Share the two-week complaint volume review", assignee: "nour", due: "2026-09-30" });
  commit("mff-pack", "merchant-flex-finance", day("2026-09-10", "10:00"), "reviewer", { title: "Publish the merchant communication pack before pilot start", assignee: "adam", due: "2026-10-02" });
  commit("mff-finance", "merchant-flex-finance", day("2026-09-11"), "reviewer", { title: "Get Finance's written confirmation of the repayment divisor", assignee: "salma", due: "2026-09-25", status: "IN_PROGRESS" });
  commit("isp-partner", "instant-settlement-payout", day("2026-09-03", "11:00"), "lina", { title: "Obtain the partner's written cut-off time", assignee: "lina", due: "2026-09-19", blocked: "Partner owner on leave until the end of the month." });
  commit("isp-runbook", "instant-settlement-payout", day("2026-08-20"), "lina", { title: "Prepare the payout operations runbook", assignee: "adam", due: "2026-09-05", status: "DONE", note: "Runbook reviewed with Operations." });
  commit("mcl-date", "merchant-credit-line-pilot", day("2026-09-21", "11:30"), "lina", { title: "Get an exact go-live date for the pilot", assignee: "adam", due: "2026-09-28", status: "IN_PROGRESS" });
  commit("mcl-list", "merchant-credit-line-pilot", day("2026-09-17"), "lina", { title: "Publish the final pilot whitelist to Sales", assignee: "nour", due: "2026-09-20", status: "DONE", note: "Whitelist approved and shared." });
  commit("pwc-field", "partner-wallet-checkout", day("2026-09-24", "12:30"), "lina", { title: "Agree with the partner how the merchant name is sent", assignee: "tarek", due: "2026-09-29" });
  commit("pwc-retest", "partner-wallet-checkout", day("2026-09-24", "12:30"), "lina", { title: "Re-run the partner receipt test scenarios", assignee: "mira", due: "2026-10-01" });
  commit("pbs-spec", "partner-bank-settlement-pack", day("2026-09-24", "13:30"), "nour", { title: "Update the report specification with the agreed definitions", assignee: "nour", due: "2026-09-26", status: "IN_PROGRESS" });
  commit("tcp-price", "terminal-care-plan", day("2026-08-05"), "lina", { title: "Bring the care plan price to Finance for approval", assignee: "salma", due: "2026-09-18" });
  commit("tcp-stock", "terminal-care-plan", day("2026-08-06"), "adam", { title: "Confirm replacement stock by region", assignee: "adam", due: "2026-10-06" });
  commit("mia-replan", "merchant-insights-app", day("2026-09-22", "09:00"), "adam", { title: "Re-plan the five late report stories", assignee: "tarek", due: "2026-09-24", status: "DONE", note: "Stories re-estimated; UAT moved to 5 October." });
  commit("mia-uat", "merchant-insights-app", day("2026-09-22", "09:00"), "adam", { title: "Confirm the UAT date with QA", assignee: "mira", due: "2026-09-29" });
  commit("kyc-pop", "merchant-kyc-refresh", day("2026-08-03"), "nour", { title: "Propose the re-verification pilot population", assignee: "hazem", due: "2026-10-05" });
  commit("crr-review", "collections-reporting-rebuild", day("2026-09-16", "09:00"), "adam", { title: "Walk through the report definitions with Finance", assignee: "salma", due: "2026-10-02" });
  commit("pricing-fee", "merchant-pricing-update", day("2026-09-15", "10:00"), "lina", { title: "Get Finance to confirm the service fee value", assignee: "salma", due: "2026-09-24", status: "CANCELLED", note: "Superseded by the value comparison in Decisions." });
  commit("ies-qa", "installment-early-settlement", day("2026-09-18", "10:00"), "reviewer", { title: "Share settlement calculation test cases with QA", assignee: "mira", due: "2026-09-30" });
  commit("tap-review", "tap-to-pay-merchant-onboarding", day("2026-09-12"), "nour", { title: "Prepare the 30-day live review", assignee: "nour", due: "2026-10-08" });

  // ── Open questions ──
  const questionKeys = new Map<string, string>();
  function ask(key: string, slug: string, when: string, by: string, cmd: Omit<QuestionCommand, "requestId" | "expectedRevision" | "id"> & { owner?: string | null }) {
    at(when, () => {
      const i = bySlug(slug); const existingId = questionKeys.get(key); const before = existingId ? store.openQuestions.find(q => q.id === existingId) : undefined;
      const { owner: ownerKey, ...rest } = cmd;
      const r = reviseQuestion(store.openQuestions, store.questionEvents, { ...rest, ...(ownerKey !== undefined ? { ownerMemberId: ownerKey ? who(ownerKey).memberId : null } : {}), id: before?.id, requestId: hashId(`ask:${key}:${when}`), expectedRevision: before?.revision ?? 0 } as QuestionCommand, ctxOf(by), i, ownerOf(i.id), members, store.claims.filter(c => c.initiativeId === i.id).map(c => ({ id: c.id, initiativeId: c.initiativeId, status: c.status })), when);
      if (!r.event) return;
      const qid = before?.id ?? id(`question:${key}`); const question = { ...r.question, id: qid };
      const event = { ...r.event, id: id(`question-event:${key}:${question.revision}`), questionId: qid, after: question, before: before ?? null };
      store.openQuestions = before ? store.openQuestions.map(q => q.id === qid ? question : q) : [...store.openQuestions, question];
      store.questionEvents.push(event); questionKeys.set(key, qid);
      log(slug, when, `QUESTION_${event.type}`, `${event.type === "OPENED" ? "Question opened" : event.type === "ANSWERED" ? "Question answered" : "Question updated"}: ${question.question}`, by, { entityType: "QUESTION", entityId: qid });
    });
  }
  ask("mcl-golive", "merchant-credit-line-pilot", day("2026-09-21", "11:40"), "lina", { operation: "CREATE", question: "When exactly does the credit line pilot go live?", owner: "adam", expectedConfirmerText: "Operations lead", dueDate: "2026-09-28" });
  ask("pwc-field", "partner-wallet-checkout", day("2026-09-24", "12:40"), "lina", { operation: "CREATE", question: "Which request field should carry the merchant name for the partner receipt?", owner: "tarek", expectedConfirmerText: "Partner integration lead", dueDate: "2026-09-25" });
  ask("pbs-date", "partner-bank-settlement-pack", day("2026-09-23", "14:00"), "nour", { operation: "CREATE", question: "Does the settlement date mean the bank settlement or the merchant settlement?", owner: "salma", expectedConfirmerText: "Finance lead", dueDate: "2026-09-25" });
  ask("pbs-date", "partner-bank-settlement-pack", day("2026-09-24", "16:10"), "salma", { operation: "ANSWER", answerClaimId: id("claim:pbs-date"), answerNote: "Merchant settlement, as confirmed in the clarification replies." });
  ask("pbs-success", "partner-bank-settlement-pack", day("2026-09-23", "14:05"), "nour", { operation: "CREATE", question: "Are failed and reversed transactions included in the report?", owner: "nour", dueDate: "2026-09-25" });
  ask("pbs-success", "partner-bank-settlement-pack", day("2026-09-24", "16:15"), "nour", { operation: "ANSWER", answerClaimId: id("claim:pbs-success"), answerNote: "Successful transactions only." });
  ask("pbs-channel", "partner-bank-settlement-pack", day("2026-09-24", "13:20"), "nour", { operation: "CREATE", question: "Which secure channel will the partner bank accept for the weekly file?", owner: "nour", expectedConfirmerText: "Partner bank operations", dueDate: "2026-10-01" });
  ask("tcp-cover", "terminal-care-plan", day("2026-07-18"), "lina", { operation: "CREATE", question: "Is the coverage period 6 or 12 months for the first release?", owner: "lina", expectedConfirmerText: "Product lead", dueDate: "2026-08-01" });
  ask("tcp-cover", "terminal-care-plan", day("2026-09-25", "15:00"), "lina", { operation: "ANSWER", answerNote: "Six months for release 1, per the product clarification email. Knowledge still records both values until the comparison is decided." });
  ask("tcp-price", "terminal-care-plan", day("2026-08-05", "10:00"), "lina", { operation: "CREATE", question: "Who approves the monthly care plan price?", owner: "salma", expectedConfirmerText: "Finance lead", dueDate: "2026-09-10" });
  ask("mia-uat", "merchant-insights-app", day("2026-09-22", "09:10"), "adam", { operation: "CREATE", question: "Can QA start UAT on 5 October with the re-planned stories?", owner: "mira", dueDate: "2026-09-29" });
  ask("kyc-pop", "merchant-kyc-refresh", day("2026-08-04"), "nour", { operation: "CREATE", question: "Which merchants are in the re-verification pilot?", owner: "hazem", expectedConfirmerText: "Compliance lead", dueDate: "2026-09-15" });
  ask("isp-cutoff", "instant-settlement-payout", day("2026-09-03", "11:10"), "lina", { operation: "CREATE", question: "What is the partner's daily cut-off time for same-day payouts?", owner: "lina", expectedConfirmerText: "Partner operations owner", dueDate: "2026-09-19" });
  ask("mff-fee", "merchant-flex-finance", day("2026-09-25", "12:00"), "reviewer", { operation: "CREATE", question: "Who signs off the early-settlement fee table?", owner: null, dueDate: "2026-09-30" });
  ask("sct-volume", "service-complaint-tracker", day("2026-09-17", "10:00"), "nour", { operation: "CREATE", question: "Should complaint volumes be reviewed by region or by category first?", owner: "adam", dueDate: "2026-09-29" });
  ask("sct-volume", "service-complaint-tracker", day("2026-09-18", "10:00"), "adam", { operation: "WITHDRAW", reason: "Covered by the two-week volume review commitment." });

  // ── Relationships ──
  function relate(key: string, when: string, by: string, from: string, to: string, type: RelationshipCommand["type"], rationale: string, dates?: { provider: "TARGET_LIVE" | "NEXT_MILESTONE"; needed: "TARGET_LIVE" | "NEXT_MILESTONE" }) {
    at(when, () => {
      const r = reviseRelationship(store.relationships, store.relationshipEvents, { operation: "CREATE", requestId: hashId(`rel:${key}`), expectedRevision: 0, fromInitiativeId: bySlug(from).id, toInitiativeId: bySlug(to).id, type, rationale, providerFactKind: dates?.provider ?? null, neededByFactKind: dates?.needed ?? null } as RelationshipCommand, ctxOf(by), store.initiatives, ownerOf, when);
      const rel = { ...r.relationship, id: id(`relationship:${key}`) }; store.relationships.push(rel);
      if (r.event) store.relationshipEvents.push({ ...r.event, id: id(`relationship-event:${key}:1`), relationshipId: rel.id, after: rel });
      const verb = type === "DEPENDS_ON" ? "depends on" : type === "PART_OF" ? "is part of" : "is related to";
      for (const slug of new Set([from, to])) log(slug, when, "RELATIONSHIP_CONFIRMED", `${bySlug(from).name} ${verb} ${bySlug(to).name} · confirmed`, by, { entityType: "RELATIONSHIP", entityId: rel.id, payload: { relationshipId: rel.id } });
    });
  }
  relate("crr-mff", day("2026-09-16", "09:30"), "reviewer", "collections-reporting-rebuild", "merchant-flex-finance", "DEPENDS_ON", "The daily collections pack must include financing repayments, which start only when Merchant Flex Finance is live.", { provider: "TARGET_LIVE", needed: "NEXT_MILESTONE" });
  relate("mff-isp", day("2026-09-12"), "reviewer", "merchant-flex-finance", "instant-settlement-payout", "DEPENDS_ON", "Repayments are collected from same-day settlement payouts.", { provider: "TARGET_LIVE", needed: "TARGET_LIVE" });
  relate("mff-kyc", day("2026-08-05"), "reviewer", "merchant-flex-finance", "merchant-kyc-refresh", "DEPENDS_ON", "Merchants must be re-verified before any disbursement.");
  relate("pwc-isp", day("2026-07-03"), "lina", "partner-wallet-checkout", "instant-settlement-payout", "DEPENDS_ON", "Partner wallet settlements use the same-day payout service.", { provider: "TARGET_LIVE", needed: "TARGET_LIVE" });
  relate("pbs-mia", day("2026-09-01", "10:00"), "nour", "partner-bank-settlement-pack", "merchant-insights-app", "DEPENDS_ON", "The weekly file reuses the settlement report built for the Insights app.", { provider: "TARGET_LIVE", needed: "NEXT_MILESTONE" });
  relate("pbs-crr", day("2026-09-01", "10:10"), "nour", "partner-bank-settlement-pack", "collections-reporting-rebuild", "RELATED_TO", "Both reports must use the same settlement date definition.");
  relate("mcl-mff", day("2026-07-06"), "lina", "merchant-credit-line-pilot", "merchant-flex-finance", "RELATED_TO", "Both repay from settlements; decisions on repayment rules should stay aligned.");
  relate("ies-mff", day("2026-08-18"), "reviewer", "installment-early-settlement", "merchant-flex-finance", "PART_OF", "Early settlement is part of the merchant finance offer.");
  relate("tcp-sct", day("2026-07-18", "10:00"), "lina", "terminal-care-plan", "service-complaint-tracker", "RELATED_TO", "Device faults raised as complaints should lead to care plan replacements.");
  relate("tap-kyc", day("2026-07-23"), "nour", "tap-to-pay-merchant-onboarding", "merchant-kyc-refresh", "RELATED_TO", "Onboarding identity checks follow the same re-verification policy.");

  // ── Risk tracking (RISK Knowledge entries that are being managed) ──
  function track(key: string, claimKey: string, slug: string, steps: { at: string; by: string; cmd: Omit<RiskCommand, "requestId" | "expectedRevision" | "id" | "claimId"> }[]) {
    for (const s of steps) at(s.at, () => {
      const i = bySlug(slug); const before = store.riskTracking.find(t => t.id === id(`risk:${key}`));
      const claimId = claimKey.startsWith("seed:") ? store.claims.find(c => c.initiativeId === i.id && c.subject === claimKey.slice(5))!.id : id(`claim:${claimKey}`);
      const cmd = { ...s.cmd, ownerMemberId: s.cmd.ownerMemberId === undefined ? undefined : s.cmd.ownerMemberId && who(s.cmd.ownerMemberId).memberId, claimId: before ? undefined : claimId, id: before?.id, requestId: hashId(`risk:${key}:${s.at}`), expectedRevision: before?.revision ?? 0 } as RiskCommand;
      const r = reviseRisk(store.riskTracking, store.riskEvents, cmd, ctxOf(s.by), i, ownerOf(i.id), members, store.claims.filter(c => c.initiativeId === i.id).map(c => ({ id: c.id, initiativeId: c.initiativeId, type: c.type, status: c.status, subject: c.subject, value: c.value, supersededByClaimId: c.supersededByClaimId ?? null })), store.commitments.filter(a => a.initiativeId === i.id).map(a => a.id), s.at);
      if (!r.event) return;
      const t = { ...r.tracking, id: id(`risk:${key}`) }; store.riskTracking = before ? store.riskTracking.map(x => x.id === t.id ? t : x) : [...store.riskTracking, t];
      store.riskEvents.push({ ...r.event, id: id(`risk-event:${key}:${t.revision}`), trackingId: t.id, after: t, before: before ?? null });
      log(slug, s.at, `RISK_${r.event.type}`, `Risk ${r.event.type === "STARTED" ? "tracked" : "updated"}: ${store.claims.find(c => c.id === t.claimId)?.subject ?? "risk"}`, s.by, { entityType: "RISK", entityId: t.id });
    });
  }
  track("mff-recon", "seed:Repayment Reconciliation", "merchant-flex-finance", [
    { at: day("2026-09-12"), by: "reviewer", cmd: { operation: "START", ownerMemberId: "salma", mitigationText: "Hold divisor-dependent build until Finance confirms 27 vs 30." } },
    { at: day("2026-09-19"), by: "salma", cmd: { operation: "STATUS", status: "MITIGATING", reason: "Finance review of both divisors scheduled." } },
  ]);
  track("sct-routing", "sct-risk", "service-complaint-tracker", [{ at: day("2026-09-17", "16:00"), by: "nour", cmd: { operation: "START", ownerMemberId: "adam", mitigationText: "Watch unclear categories daily for the first two weeks." } }]);
  track("mcl-terminals", "mcl-risk", "merchant-credit-line-pilot", [{ at: day("2026-09-21", "16:00"), by: "lina", cmd: { operation: "START", ownerMemberId: "adam", mitigationText: "Update pilot terminals in production before announcing the date." } }]);
  track("pwc-field", "pwc-risk", "partner-wallet-checkout", [{ at: day("2026-09-24", "16:00"), by: "lina", cmd: { operation: "START", ownerMemberId: "tarek", mitigationText: "Agree the field mapping with the partner; fall back to the terminal-stored name." } }]);
  track("tcp-stock", "tcp-risk", "terminal-care-plan", [
    { at: day("2026-08-06"), by: "lina", cmd: { operation: "START", ownerMemberId: "adam", mitigationText: "Confirm regional stock before pricing approval." } },
    { at: day("2026-09-05"), by: "adam", cmd: { operation: "STATUS", status: "ACCEPTED", reason: "Pilot limited to regions with confirmed stock." } },
  ]);
  track("mia-schedule", "mia-risk", "merchant-insights-app", [
    { at: day("2026-09-17", "15:00"), by: "adam", cmd: { operation: "START", ownerMemberId: "tarek", mitigationText: "Re-plan late stories; move export to release 2." } },
    { at: day("2026-09-22", "10:00"), by: "tarek", cmd: { operation: "STATUS", status: "MITIGATING", reason: "Stories re-estimated and UAT moved." } },
  ]);

  // ── Story C: meeting notes → proposals → selective confirmation (Merchant Flex Finance) ──
  const meetingAt = day("2026-09-25", "11:00");
  at(meetingAt, () => {
    const i = bySlug("merchant-flex-finance");
    const text = [
      "Merchant Flex Finance — steering sync (synthetic demo notes)",
      "Present: Demo Reviewer (PM), Salma Rizk (Finance), Adam Wahba (Operations), Tarek Barakat (Engineering)",
      "",
      "1. Pilot scope",
      "Agreed: the pilot is limited to 40 merchants in the first month.",
      "Merchant eligibility change: minimum trading history lowered to 4 months of continuous settlement activity.",
      "",
      "2. Delivery",
      "Engineering needs Finance sign-off before release. Target Live moves to 2026-10-15 to allow Finance sign-off.",
      "Operations will publish the merchant communication pack before pilot start.",
      "",
      "3. Risks",
      "Raised: acquirer settlement files can arrive after the 06:00 deduction run, which would delay same-day repayment.",
      "",
      "4. Open",
      "Who signs off the early-settlement fee table? Nobody present could confirm.",
      "Settlement files come from Instant Settlement Payout, so the pilot depends on its release.",
    ].join("\n");
    const sub = pasted(i, "mff-steering", "Steering sync", text, meetingAt, "reviewer", { date: "2026-09-25", attendees: "Demo Reviewer, Salma Rizk, Adam Wahba, Tarek Barakat" });
    const eligibility = store.claims.find(c => c.initiativeId === i.id && c.subject === "Merchant Eligibility" && c.status === "ACTIVE");
    const decision = read(sub, "the pilot is limited to 40 merchants in the first month", "DECISION", { subject: "Pilot scope", attribute: "Merchant cap", value: "Limited to 40 merchants in the first month", domain: "PRODUCT", phase: null }, meetingAt);
    const action = read(sub, "Operations will publish the merchant communication pack before pilot start", "ACTION", { subject: "Merchant communication", attribute: "pack", value: "Publish the merchant communication pack before pilot start", domain: "OPERATIONS", phase: null }, meetingAt);
    const risk = read(sub, "acquirer settlement files can arrive after the 06:00 deduction run, which would delay same-day repayment", "RISK", { subject: "Settlement file timing", attribute: "Late arrival", value: "Acquirer settlement files can arrive after the 06:00 deduction run", domain: "OPERATIONS", phase: null }, meetingAt);
    const question = read(sub, "Who signs off the early-settlement fee table?", "OPEN_QUESTION", { subject: "Early-settlement fee table", attribute: "question", value: "Who signs off the early-settlement fee table?", domain: "FINANCE", phase: null }, meetingAt);
    read(sub, "Target Live moves to 2026-10-15 to allow Finance sign-off", "DELIVERY", { subject: "Target Live", attribute: "date", value: "2026-10-15", domain: "DELIVERY", phase: null, factKind: "TARGET_LIVE", date: "2026-10-15" }, meetingAt, 2);
    if (eligibility) read(sub, "minimum trading history lowered to 4 months of continuous settlement activity", "CHANGED_REQUIREMENT", { subject: eligibility.subject, attribute: eligibility.attribute, value: "4 months of continuous settlement activity", domain: eligibility.domain, phase: eligibility.phase ?? null, targetClaimId: eligibility.id, targetClaimUpdatedAt: eligibility.updatedAt }, meetingAt);
    read(sub, "Instant Settlement Payout", "RELATIONSHIP", { subject: "Instant Settlement Payout", attribute: "relationship", value: "Instant Settlement Payout", domain: "PRODUCT", phase: null, targetInitiativeId: bySlug("instant-settlement-payout").id }, meetingAt);
    // Human decisions: the decision is already recorded (the pilot cap entry), the commitment exists, the risk and question are accepted.
    reject(decision.proposal, "reviewer", day("2026-09-25", "12:00"), "Already recorded");
    reject(action.proposal, "reviewer", day("2026-09-25", "12:00"), "Already recorded");
    const riskClaimId = id("claim:mff-settlement-timing");
    const riskAt = day("2026-09-25", "12:05");
    store.claims.push(scoped({ id: riskClaimId, initiativeId: i.id, type: "RISK", status: "UNVERIFIED", subject: "Settlement file timing", attribute: "Late arrival", value: "Acquirer settlement files can arrive after the 06:00 deduction run", domain: "OPERATIONS", phase: null, confidence: null, supersededByClaimId: null, createdBy: reviewerUserId, createdAt: riskAt, updatedAt: riskAt, origin: "HUMAN_ENTRY", verifiedAt: null, verifiedActorId: null, verifiedActorLabel: null, verificationBasis: null, verificationNote: null, evidenceSubmissionId: sub.id, evidenceAnchorId: risk.anchor.id, contextId: i.currentContextId ?? null } as unknown as Scoped<ClaimRecord & ClaimTrust>));
    store.claimEvidence.push(scoped({ claimId: riskClaimId, evidenceId: sub.evidenceId, createdAt: riskAt, locator: "quoted passage", excerpt: risk.anchor.quote }));
    confirm(risk.proposal, "KNOWLEDGE", riskClaimId, "reviewer", riskAt);
    confirm(question.proposal, "QUESTION", id("question:mff-fee"), "reviewer", day("2026-09-25", "12:06"));
  });

  // ── Story D: conflicting coverage period deferred, then new evidence reopens it ──
  const deferAt = day("2026-09-02", "10:00");
  at(deferAt, () => {
    const i = bySlug("terminal-care-plan"); const snap = source().snapshots.find(s => s.initiative.id === i.id)!;
    const finding = runReview(i.id, snap.claims).find(f => f.type === "CONFLICT");
    if (!finding) throw new Error(`Demo conflict for Terminal Care Plan missing: ${JSON.stringify(snap.claims.map(c => [c.subject, c.attribute, c.status, c.phase, c.value]))}`);
    const res = prepareDisposition(store.findingDispositions, finding, [], ctxOf("lina"), { workspaceId, initiativeId: i.id, findingId: finding.fingerprint, kind: "DEFERRED", deferUntil: null, deferUntilNextReview: true, reason: "Wait for the product clarification on which document is authoritative.", expectedDigest: finding.contentDigest, expectedLatestDispositionId: null, clientRequestId: hashId("tcp-defer") }, deferAt, id("disposition:tcp-defer"));
    if (res.code !== "ok") throw new Error(`Demo disposition refused: ${res.code}`);
    res.row.claimRevisions = snap.claims.filter(c => res.row.claimIds.includes(c.id)).map(c => ({ id: c.id, updatedAt: c.updatedAt }));
    store.findingDispositions.push(res.row);
    log("terminal-care-plan", deferAt, "FINDING_DEFERRED", `Deferred: ${res.row.reason}`, "lina", { entityType: "finding", entityId: finding.fingerprint, payload: { dispositionId: res.row.id, findingId: finding.fingerprint, digest: res.row.underlyingDigest } });
  });
  // New evidence arrives: the 6-month entry is re-linked to the clarification email, so the compared record changed and the item reopens.
  at(day("2026-09-25", "14:00"), () => {
    const t = day("2026-09-25", "14:00");
    store.claimEvidence.push(scoped({ claimId: id("claim:tcp-cover-6"), evidenceId: id("evidence:tcp-mail"), createdAt: t, locator: null, excerpt: "coverage period for the first release is six months" }));
    const c = store.claims.find(x => x.id === id("claim:tcp-cover-6"))!; c.updatedAt = t;
    // Same shape the queue evaluator records when it observes the changed entries (hosted de-duplicates on dispositionId + reason).
    const deferral = store.findingDispositions.find(d => d.id === id("disposition:tcp-defer"))!;
    log("terminal-care-plan", t, "FINDING_DISPOSITION_REOPENED", "Reopened: evidence changed since deferral.", "fixture", { entityType: "finding", entityId: deferral.findingId, payload: { dispositionId: deferral.id, reopenReason: "evidence changed since deferral", observedByEvaluator: true } });
  });
  // A dismissed comparison: pricing notes that differ only because one is a draft percentage format.
  at(day("2026-09-19", "10:00"), () => {
    const i = bySlug("merchant-pricing-update"); const snap = source().snapshots.find(s => s.initiative.id === i.id)!;
    const finding = runReview(i.id, snap.claims).find(f => f.type === "CONFLICT"); if (!finding) return;
    // Pricing stays open on purpose (a real value decision). The dismissal example lives on Merchant Insights below.
  });

  // Merchant Insights: two notes on the same attribute that differ only in wording → dismissed.
  at(day("2026-09-18", "13:00"), () => {
    const i = bySlug("merchant-insights-app"); const t = day("2026-09-18", "13:00");
    for (const [key, value, ev] of [["mia-balance-a", "Wallet balance shown on the summary screen", "mia-spec"], ["mia-balance-b", "Wallet balance appears on the summary screen", "mia-weekly"]] as const) {
      store.claims.push(scoped({ id: id(`claim:${key}`), initiativeId: i.id, type: "REQUIREMENT", status: "ACTIVE", subject: "Wallet balance", attribute: "Placement", value, domain: "PRODUCT", phase: null, confidence: null, supersededByClaimId: null, createdBy: P.adam!.userId, createdAt: t, updatedAt: t, origin: "HUMAN_ENTRY", verifiedAt: t, verifiedActorId: P.adam!.userId, verifiedActorLabel: P.adam!.displayName, verificationBasis: "EVIDENCE", verificationNote: null, contextId: i.currentContextId ?? null } as unknown as Scoped<ClaimRecord & ClaimTrust>));
      store.claimEvidence.push(scoped({ claimId: id(`claim:${key}`), evidenceId: id(`evidence:${ev}`), createdAt: t, locator: null, excerpt: null }));
    }
  });
  at(day("2026-09-19", "09:00"), () => {
    const i = bySlug("merchant-insights-app"); const snap = source().snapshots.find(s => s.initiative.id === i.id)!; const t = day("2026-09-19", "09:00");
    const finding = runReview(i.id, snap.claims).find(f => f.type === "CONFLICT" && f.subject === "Wallet balance"); if (!finding) throw new Error("Demo wording comparison missing");
    const res = prepareDisposition(store.findingDispositions, finding, [], ctxOf("adam"), { workspaceId, initiativeId: i.id, findingId: finding.fingerprint, kind: "DISMISSED", deferUntil: null, deferUntilNextReview: false, reason: "Same requirement worded differently; no decision needed.", expectedDigest: finding.contentDigest, expectedLatestDispositionId: null, clientRequestId: hashId("mia-dismiss") }, t, id("disposition:mia-dismiss"));
    if (res.code !== "ok") throw new Error(`Demo dismissal refused: ${res.code}`);
    res.row.claimRevisions = snap.claims.filter(c => res.row.claimIds.includes(c.id)).map(c => ({ id: c.id, updatedAt: c.updatedAt }));
    store.findingDispositions.push(res.row);
    log("merchant-insights-app", t, "FINDING_DISMISSED", `Dismissed: ${res.row.reason}`, "adam", { entityType: "finding", entityId: finding.fingerprint, payload: { dispositionId: res.row.id } });
  });
  // A deferred pricing-adjacent comparison on Installment Early Settlement until the next Weekly Review.
  at(day("2026-09-22", "10:00"), () => {
    const i = bySlug("installment-early-settlement"); const t = day("2026-09-22", "10:00");
    for (const [key, value] of [["ies-fee-a", "Early settlement fee waived in the first month"], ["ies-fee-b", "Early settlement fee charged from the first installment"]] as const) {
      store.claims.push(scoped({ id: id(`claim:${key}`), initiativeId: i.id, type: "BUSINESS_RULE", status: "ACTIVE", subject: "Early settlement fee", attribute: "First month", value, domain: "FINANCE", phase: null, confidence: null, supersededByClaimId: null, createdBy: reviewerUserId, createdAt: t, updatedAt: t, origin: "HUMAN_ENTRY", verifiedAt: t, verifiedActorId: P.salma!.userId, verifiedActorLabel: P.salma!.displayName, verificationBasis: "DIRECT_KNOWLEDGE", verificationNote: "Stated in the finance review.", contextId: i.currentContextId ?? null } as unknown as Scoped<ClaimRecord & ClaimTrust>));
    }
  });
  at(day("2026-09-23", "10:00"), () => {
    const i = bySlug("installment-early-settlement"); const snap = source().snapshots.find(s => s.initiative.id === i.id)!; const t = day("2026-09-23", "10:00");
    const finding = runReview(i.id, snap.claims).find(f => f.type === "CONFLICT" && f.subject === "Early settlement fee"); if (!finding) throw new Error("Demo fee comparison missing");
    const res = prepareDisposition(store.findingDispositions, finding, [], ctxOf("reviewer"), { workspaceId, initiativeId: i.id, findingId: finding.fingerprint, kind: "DEFERRED", deferUntil: "2026-10-05", deferUntilNextReview: false, reason: "Finance will decide the fee with the October pricing review.", expectedDigest: finding.contentDigest, expectedLatestDispositionId: null, clientRequestId: hashId("ies-defer") }, t, id("disposition:ies-defer"));
    if (res.code !== "ok") throw new Error(`Demo deferral refused: ${res.code}`);
    res.row.claimRevisions = snap.claims.filter(c => res.row.claimIds.includes(c.id)).map(c => ({ id: c.id, updatedAt: c.updatedAt }));
    store.findingDispositions.push(res.row);
    log("installment-early-settlement", t, "FINDING_DEFERRED", `Deferred: ${res.row.reason}`, "reviewer", { entityType: "finding", entityId: finding.fingerprint, payload: { dispositionId: res.row.id } });
  });
  // A reviewed-and-closed comparison (note only) on Tap-to-Pay.
  at(day("2026-09-08", "10:00"), () => {
    const i = bySlug("tap-to-pay-merchant-onboarding"); const t = day("2026-09-08", "10:00");
    for (const [key, value] of [["tap-receipt-a", "Digital receipt within the onboarding scope"], ["tap-receipt-b", "Printed receipt on request"]] as const) {
      store.claims.push(scoped({ id: id(`claim:${key}`), initiativeId: i.id, type: "REQUIREMENT", status: "ACTIVE", subject: "Receipt", attribute: "Fallback", value, domain: "PRODUCT", phase: null, confidence: null, supersededByClaimId: null, createdBy: P.nour!.userId, createdAt: t, updatedAt: t, origin: "HUMAN_ENTRY", verifiedAt: t, verifiedActorId: P.nour!.userId, verifiedActorLabel: P.nour!.displayName, verificationBasis: "DIRECT_KNOWLEDGE", verificationNote: "Agreed in the rollout review.", contextId: i.currentContextId ?? null } as unknown as Scoped<ClaimRecord & ClaimTrust>));
    }
  });
  at(day("2026-09-09", "10:00"), () => {
    const i = bySlug("tap-to-pay-merchant-onboarding"); const snap = source().snapshots.find(s => s.initiative.id === i.id)!; const t = day("2026-09-09", "10:00");
    const finding = runReview(i.id, snap.claims).find(f => f.type === "CONFLICT" && f.subject === "Receipt"); if (!finding) throw new Error("Demo receipt comparison missing");
    store.findingStates.push(scoped({ initiativeId: i.id, fingerprint: finding.fingerprint, ruleId: finding.ruleId, contentDigest: finding.contentDigest, subject: finding.subject, attribute: "Fallback", phase: null, valuesRecorded: finding.claims.map(c => c.value).join(" / "), status: "RESOLVED", resolution: "Both apply: digital receipt by default, printed on request. Recorded as a note, no value chosen.", resolvedAt: t, outcome: null, chosenClaimId: null, decisionClaimId: null, decidedValue: null, confirmedWith: null, actorId: P.nour!.userId, actorLabel: P.nour!.displayName, confirmerLabel: null, confirmerSetAt: null, confirmerSetByLabel: null, createdAt: t, updatedAt: t }) as Scoped<FindingState>);
    log("tap-to-pay-merchant-onboarding", t, "FINDING_RESOLVED", "Reviewed — both receipt options apply; no value chosen.", "nour", { entityType: "finding", entityId: finding.fingerprint });
  });

  // ── Lifecycle moves ──
  const stage = (slug: string, when: string, to: Initiative["stage"], by: string) => at(when, () => { const i = bySlug(slug); const from = i.stage; i.stage = to; i.updatedAt = when; log(slug, when, "STAGE_CHANGED", `Stage changed: ${from.toLowerCase().replaceAll("_", " ")} → ${to.toLowerCase().replaceAll("_", " ")}`, by, { entityType: "INITIATIVE", entityId: i.id }); });
  // Final stages are what the rows already say; history records how they got there.
  const finalStage = (slug: string) => bySlug(slug).stage;
  const moves: [string, string, Initiative["stage"], Initiative["stage"], string][] = [
    ["service-complaint-tracker", "2026-09-16", "VALIDATION", "LIVE_VALIDATION", "nour"],
    ["partner-wallet-checkout", "2026-09-14", "DELIVERY", "VALIDATION", "lina"],
    ["merchant-credit-line-pilot", "2026-09-15", "DELIVERY", "RELEASE_PREPARATION", "lina"],
    ["tap-to-pay-merchant-onboarding", "2026-09-11", "RELEASE_PREPARATION", "LIVE_VALIDATION", "nour"],
  ];
  for (const [slug, when, from] of moves) { const to = finalStage(slug); bySlug(slug).stage = from; stage(slug, day(when, "17:00"), to, moves.find(m => m[0] === slug)![4]); }
  for (const n of newInitiatives) if (n.archived) at(day(n.archived.at, "12:00"), () => { const i = bySlug(n.slug); const t = day(n.archived!.at, "12:00"); Object.assign(i, { archivedAt: t, archivedBy: who(n.archived!.by).userId, archiveReason: n.archived!.reason, updatedAt: t }); log(n.slug, t, "INITIATIVE_ARCHIVED", "Initiative archived; records and history preserved", n.archived!.by, { entityType: "INITIATIVE", entityId: i.id, payload: { reason: n.archived!.reason } }); });

  // ── Weekly reviews: W37 and W38 Finals, W39 Draft with two sections reviewed ──
  function review(week: string, created: string, finalAt: string | null, reviewedSlugs?: string[]) {
    at(created, () => {
      state = createReview(state, source(), ctxOf("reviewer"), week, created);
      const r = state.reviews.at(-1)!; r.id = id(`review:${week}`);
      const edits = (reviewedSlugs ?? r.sections.map(s => store.initiatives.find(i => i.id === s.initiativeId)!.slug));
      for (const slug of edits) {
        const current = state.reviews.find(x => x.id === r.id)!; const section = current.sections.find(s => s.initiativeId === bySlug(slug).id); if (!section) continue;
        const blocker = state.facts.find(f => f.initiativeId === section.initiativeId && f.kind === "BLOCKER" && f.state === "SET")?.value.text;
        const edit: SectionEdit = { headline: `${bySlug(slug).name} · ${bySlug(slug).stage.toLowerCase().replaceAll("_", " ")}`, updates: "Reviewed against the recorded delivery facts and open items.", attention: blocker ?? "No blocker recorded.", decisionNeeded: blocker ? "Decision owner named in the blocker." : "No decision request recorded.", nextMilestone: section.nextMilestone || "Next milestone not recorded.", nextStep: section.nextStep || "Next step not recorded." };
        state = editSection(state, source(), ctxOf("reviewer"), r.id, current.revision, section.initiativeId, section.revision, edit, created);
      }
      if (finalAt) { const current = state.reviews.find(x => x.id === r.id)!; state = finalizeReview(state, source(), ctxOf("reviewer"), r.id, current.revision, created); const fin = state.reviews.find(x => x.id === r.id)!; fin.finalizedAt = finalAt; }
    });
  }
  review("2026-W37", day("2026-09-13", "14:00"), day("2026-09-13", "14:00"));
  review("2026-W38", day("2026-09-20", "14:00"), day("2026-09-20", "14:00"));
  review("2026-W39", DEMO_CUTOFF, null, ["merchant-flex-finance", "service-complaint-tracker"]);

  // ── Run the timeline ──
  for (const step of steps.sort((a, b) => a.at.localeCompare(b.at) || a.n - b.n)) {
    if (step.at > DEMO_CUTOFF) throw new Error(`Demo step after the scenario cutoff: ${step.at}`);
    step.run();
  }
  for (const r of state.reviews) if (r.status === "FINAL") r.preparedAsFixture = true;
  for (const c of store.claims) if ((c as { contextId?: string | null }).contextId === undefined) (c as { contextId?: string | null }).contextId = null;

  return {
    version: DEMO_V3_VERSION, organization: { id: organizationId, name: DEMO_ORGANIZATION_NAME }, workspaceId,
    productStore: store, deliveryState: state, source: source(), members, personas,
    reviewer: { userId: reviewerUserId, memberId: reviewerMemberId, role: "ORG_OWNER" as const, platformRole: null },
    metrics: base.metrics, cutoff: DEMO_V3_CUTOFF,
  };
}
