import type { ActivityEntry } from '../domain/types.ts';
import type { DeliveryState, PortfolioSource, WorkspaceAccess } from '../delivery/types.ts';
import type { WorkspacePresentation } from '../workspace/context.ts';
import type { InitiativeContext } from '../workspace/readiness.ts';
import type { SourceMapping } from '../workspace/source-mapping.ts';
import type { InitiativeRelationship } from '../workspace/relationships.ts';
import type { OpenQuestion } from '../workspace/questions.ts';
import type { RiskTracking } from '../workspace/risks.ts';
import type { Commitment } from '../workspace/commitments.ts';
import type { ProjectMetric } from '../analysis/metric-types.ts';
import type { EvidenceState } from '../evidence/types.ts';
import { buildPortfolioProjection, type PortfolioRow } from '../workspace/portfolio.ts';
import { riskViews, RISK_STATUS_LABEL } from '../workspace/risks.ts';
import { questionOverdueDays } from '../workspace/questions.ts';
import { relationshipsFor, GROUP_LABEL } from '../workspace/relationship-view.ts';
import { metricCoverage, metricView } from '../analysis/metric-view.ts';
import { factFor, isoWeek, nextReviewWeek, dayDifference } from '../delivery/model.ts';
import { factDate, displayDate } from '../delivery/display.ts';
import { STAGE_LABEL, BUSINESS_LINE_LABEL, DOMAIN_LABEL } from '../domain/labels.ts';
import { canBusinessWrite, hasOrganizationAdminAuthority } from '../auth/roles.ts';
import { recommend, setupQueue, type Recommendation, type SetupQueueItem } from './recommend.ts';
import type { AssistantScreen, InitiativeTab } from './types.ts';
import { INITIATIVE_TABS } from './types.ts';

/**
 * The bounded, authorization-scoped context Ask Prodwise reasons over.
 *
 * Pure: it receives only what the caller's scoped readers returned, so it can
 * see exactly what the pages would render for that person — never another
 * organization's records, never platform data, never an imported body. Every
 * list is capped, every value is display text, and every item carries the
 * `href` the pages use, so an answer can link to the record it is based on.
 */
export const CONTEXT_VERSION = 'ASSISTANT_CONTEXT_V1';
export const LIMITS = { knowledge: 40, evidence: 20, changes: 10, attention: 8, setupGaps: 10, items: 10, initiatives: 25, upcoming: 10, metrics: 10, text: 240 } as const;

export interface Linked { href: string }
export interface ContextInitiative {
  name: string; slug: string; href: string; stage: string; businessLine: string; objective: string | null; owner: string; scope: string;
  archived: boolean; setup: { completed: number; total: number; label: string };
  delivery: { targetLive: string; targetMovement: string | null; actualLive: string; nextMilestone: string; nextStep: string; developmentStart: string; blocker: string; href: string };
  attention: ({ label: string; detail: string } & Linked)[];
  setupGaps: ({ label: string; detail: string } & Linked)[];
  knowledge: { counts: { active: number; awaitingConfirmation: number; superseded: number; total: number }; items: ({ type: string; subject: string; attribute: string; value: string; domain: string; phase: string | null; status: string; confirmed: boolean } & Linked)[]; href: string };
  evidence: { count: number; items: ({ title: string; type: string; date: string; boundary: string } & Linked)[]; href: string };
  proposals: ({ pending: number; latestSourceTitle: string | null } & Linked) | null;
  decisionsOpen: ({ detail: string } & Linked)[];
  risks: ({ statement: string; status: string } & Linked)[];
  questions: ({ question: string; needed: string; overdueDays: number | null } & Linked)[];
  commitments: ({ title: string; assignee: string; due: string; status: string; blocked: string | null } & Linked)[];
  relationships: ({ relation: string; other: string; impact: string | null; late: boolean } & Linked)[];
  metrics: ({ configured: number; met: number; notMet: number; notAssessed: number; noTarget: number; lastCaptured: string | null; synthetic: boolean; items: { name: string; unit: string; latest: string; status: string }[] } & Linked) | null;
  recentChanges: ({ sentence: string; actor: string; at: string } & Linked)[];
}
export interface ContextReview { week: string; status: 'DRAFT' | 'FINAL' | 'NONE'; reviewed: number; total: number; baselineWeek: string | null; href: string; unmetChecks: string[] }
export interface AssistantContext {
  version: typeof CONTEXT_VERSION;
  organization: { name: string; isDemo: boolean; asOf: string; today: string };
  viewer: { role: string; writer: boolean; canFinalize: boolean; guest: boolean };
  screen: { kind: AssistantScreen; tab: InitiativeTab | null; initiativeSlug: string | null; href: string };
  /** Null when no initiative is in view, or when the requested slug is not one this person can open. */
  initiative: ContextInitiative | null;
  portfolio: {
    summary: { total: number; attentionInitiatives: number; attentionReasons: number; setupIncomplete: number; upcomingTargets: number; unknownTargets: number };
    initiatives: ({ name: string; slug: string; stage: string; owner: string; targetLive: string; attention: number; setup: string } & Linked)[];
    attention: ({ initiative: string; label: string; detail: string } & Linked)[];
    upcoming: ({ initiative: string; kind: string; label: string; date: string } & Linked)[];
    setupQueue: SetupQueueItem[];
    recentChanges: ({ initiative: string; sentence: string; actor: string; at: string } & Linked)[];
  };
  review: ContextReview;
  recommendations: Recommendation[];
  navigation: { label: string; href: string; hint: string }[];
  /** Every href above, so answers can be validated against it. */
  hrefs: string[];
}

export interface ContextInput {
  screen: { kind: AssistantScreen; tab?: string | null; initiativeSlug?: string | null };
  ctx: WorkspaceAccess; presentation: WorkspacePresentation; guest: boolean; writesEnabled: boolean;
  source: PortfolioSource; state: DeliveryState; activity: ActivityEntry[];
  management: { contexts: InitiativeContext[]; mappings: SourceMapping[] } | undefined;
  relationships: InitiativeRelationship[]; questions: OpenQuestion[]; risks: RiskTracking[]; commitments: Commitment[];
  metrics: ProjectMetric[];
  /** The initiative's evidence state (proposals and source titles), read only when an initiative is in view. */
  evidence: EvidenceState | null;
  asOf: string; now: string;
}

const clip = (s: string | null | undefined, n: number = LIMITS.text) => { const t = (s ?? '').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const CLAIM_STATUS: Record<string, string> = { ACTIVE: 'Confirmed', UNVERIFIED: 'Awaiting confirmation', DRAFT: 'Draft', SUPERSEDED: 'Superseded', REJECTED: 'Rejected', DEFERRED: 'Deferred', UNKNOWN: 'Unknown' };
const CLAIM_TYPE: Record<string, string> = { REQUIREMENT: 'Requirement', DECISION: 'Decision', BUSINESS_RULE: 'Business rule', RISK: 'Risk', DEPENDENCY: 'Dependency', ASSUMPTION: 'Assumption' };
const EVIDENCE_TYPE: Record<string, string> = { DOCUMENT: 'Document', MEETING: 'Meeting', EMAIL: 'Email', JIRA: 'Jira', DECISION_NOTE: 'Decision note', DESIGN: 'Design', OTHER: 'Other' };
const BOUNDARY: Record<string, string> = { CURRENT_SCOPE: 'Current scope', FUTURE_PHASE: 'Future phase', HISTORICAL: 'Historical', RELATED: 'Related', EXCLUDED: 'Excluded' };
const roleLabel = (ctx: WorkspaceAccess) => ctx.role === 'ORG_OWNER' ? 'Organization Owner' : ctx.role === 'ADMIN' ? 'Administrator' : ctx.role === 'MEMBER' ? 'Member' : ctx.role === 'VIEWER' ? 'Viewer' : 'Platform access (not a member)';

export function navigationMap(input: { admin: boolean; writer: boolean; initiativeSlug: string | null }) {
  const nav = [
    { label: 'Home', href: '/', hint: 'What needs attention, your work, the weekly review and what changed.' },
    { label: 'Initiatives', href: '/initiatives', hint: 'Every initiative with stage, owner, setup and attention.' },
    { label: 'Roadmap', href: '/roadmap', hint: 'Target Live dates and milestones on a timeline; unplaced initiatives are listed separately.' },
    { label: 'Analysis', href: '/analysis/portfolio', hint: 'Metric definitions, observations and targets per initiative.' },
    { label: 'Weekly Review', href: '/weekly-review', hint: 'Prepare, review and finalize the weekly management record.' },
    { label: 'Notifications', href: '/notifications', hint: 'Recorded events routed to you.' },
    { label: 'My account', href: '/account', hint: 'Identity, password, appearance and Ask Prodwise preferences.' },
    { label: 'Connected sources', href: '/account/connections', hint: 'Connect Jira, Gmail, Google Drive or Figma; imports produce evidence you confirm.' },
  ];
  if (input.writer) nav.push({ label: 'Create initiative', href: '/initiatives/new', hint: 'Record a new initiative; setup resumes where you leave it.' });
  if (input.admin) nav.push({ label: 'Administration', href: '/administration/organization', hint: 'Members, invitations, roles and organization settings.' });
  if (input.initiativeSlug) {
    const base = `/initiatives/${input.initiativeSlug}`;
    nav.push(
      { label: 'Brief', href: base, hint: 'Current recorded state, attention, open work and what changed.' },
      { label: 'Knowledge', href: `${base}/knowledge`, hint: 'Confirmed entries: requirements, decisions, business rules, risks, dependencies, assumptions.' },
      { label: 'Sources', href: `${base}/sources`, hint: 'Linked sources, saved evidence and proposals awaiting a decision.' },
      { label: 'Decisions', href: `${base}/decisions`, hint: 'Recorded differences between values that wait for a person’s decision.' },
      { label: 'Delivery facts', href: `${base}/delivery`, hint: 'Owner, scope, Target Live, Actual Live, milestones, blocker and next step.' },
      { label: 'Commitments', href: `${base}/actions`, hint: 'Who committed to what, by when.' },
      { label: 'Risks & questions', href: `${base}/context`, hint: 'Tracked risks and open questions.' },
      { label: 'History', href: `${base}/history`, hint: 'Everything recorded on this initiative, in order.' },
      { label: 'Setup', href: `${base}/setup`, hint: 'Sources, delivery facts and the first confirmed entry.' },
      { label: 'Manage initiative', href: `${base}/manage`, hint: 'Basics, ownership, scope context, relationships and archiving.' },
      { label: 'Initiative analysis', href: `/analysis/projects/${input.initiativeSlug}`, hint: 'Define metrics, record observations and approve targets.' },
    );
  }
  return nav;
}

function reviewState(input: ContextInput, writer: boolean): { review: ContextReview; forRecommend: Parameters<typeof recommend>[0]['review'] } {
  const week = isoWeek(input.asOf);
  const reviews = input.state.reviews.filter(r => r.workspaceId === input.ctx.workspaceId);
  const review = reviews.find(r => r.week === week);
  const reviewed = review?.sections.filter(s => !s.needsRecheck && (s.editedByMemberId || s.editedByUserId)).length ?? 0;
  const total = review?.sections.length ?? 0;
  const baseline = review ? reviews.find(r => r.id === review.baselineReviewId) : reviews.filter(r => r.status === 'FINAL').sort((a, b) => b.week.localeCompare(a.week)).at(0);
  const next = review?.status === 'FINAL' ? nextReviewWeek(review.week) : null;
  const nowWeek = isoWeek(input.now);
  const unmet: string[] = [];
  if (review?.status === 'DRAFT') {
    if (reviewed < total) unmet.push(`${total - reviewed} of ${total} ${total - reviewed === 1 ? 'section still needs' : 'sections still need'} review`);
    if (!writer) unmet.push('Finalizing needs an Org Owner, Admin, Platform Owner or Product Lead');
    if (!input.writesEnabled) unmet.push('Changes are disabled in this environment');
  }
  return {
    review: { week, status: review?.status ?? 'NONE', reviewed, total, baselineWeek: baseline?.week ?? null, href: `/weekly-review?week=${week}`, unmetChecks: unmet },
    forRecommend: { week, status: review?.status ?? 'NONE', pending: total - reviewed, total, started: week <= nowWeek, next: next ? { week: next.week, started: next.week <= nowWeek, exists: reviews.some(r => r.week === next.week) } : null },
  };
}

function initiativeContext(input: ContextInput, r: PortfolioRow, p: ReturnType<typeof buildPortfolioProjection>, snapshotClaims: PortfolioSource['snapshots'][number]['claims'], evidence: PortfolioSource['snapshots'][number]['evidence']): ContextInitiative {
  const i = r.initiative, base = `/initiatives/${i.slug}`, today = p.today;
  const facts = input.state.facts.filter(f => f.workspaceId === input.ctx.workspaceId);
  const get = (kind: Parameters<typeof factFor>[2]) => factFor(facts, i.id, kind);
  const member = (id: string | null) => input.source.members.find(m => m.id === id)?.displayName ?? null;
  const context = input.management?.contexts.find(c => c.id === i.currentContextId && !c.retiredAt)?.label ?? get('SCOPE')?.value.text ?? null;
  const blocker = get('BLOCKER'), dev = get('DEV_STARTED');
  const claims = [...snapshotClaims].sort((a, b) => (a.status === 'ACTIVE' ? 0 : 1) - (b.status === 'ACTIVE' ? 0 : 1) || b.updatedAt.localeCompare(a.updatedAt));
  const pending = (input.evidence?.proposals ?? []).filter(x => x.status === 'PENDING');
  const pendingSubmissions = new Set(pending.map(x => x.submissionId));
  const latestSource = (input.evidence?.submissions ?? []).filter(s => pendingSubmissions.has(s.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.title ?? null;
  const riskRows = riskViews(snapshotClaims.map(c => ({ id: c.id, initiativeId: i.id, type: c.type, status: c.status, subject: c.subject, value: c.value, supersededByClaimId: c.supersededByClaimId ?? null })), input.risks.filter(t => t.initiativeId === i.id), i.id).filter(v => v.state !== 'SUPERSEDED' && (!v.tracking || ['OPEN', 'MITIGATING'].includes(v.tracking.status)));
  const openQs = input.questions.filter(q => q.initiativeId === i.id && q.status === 'OPEN').map(q => ({ q, overdue: questionOverdueDays(q, today) })).sort((a, b) => (b.overdue ?? -1) - (a.overdue ?? -1));
  const ends = input.source.snapshots.map(x => ({ id: x.initiative.id, name: x.initiative.name, slug: x.initiative.slug, archived: Boolean(x.initiative.archivedAt) }));
  const rel = relationshipsFor(i.id, input.relationships, ends, facts, 'ACTIVE', today);
  const commitments = input.commitments.filter(a => a.initiativeId === i.id && !['DONE', 'CANCELLED'].includes(a.status)).sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const metrics = input.metrics.filter(m => m.initiativeId === i.id);
  const coverage = metricCoverage(metrics);
  const evidenceSorted = [...evidence].sort((a, b) => (b.occurredAt ?? b.capturedAt).localeCompare(a.occurredAt ?? a.capturedAt));
  return {
    name: i.name, slug: i.slug, href: base, stage: STAGE_LABEL[i.stage], businessLine: BUSINESS_LINE_LABEL[i.businessLine], objective: clip(i.description) || null, owner: r.ownerLabel, scope: context ? clip(context) : 'Not recorded',
    archived: Boolean(i.archivedAt), setup: { completed: r.setup.completed, total: r.setup.total, label: r.setup.label },
    delivery: {
      targetLive: factDate(r.target), targetMovement: r.targetMovement ? `Moved ${r.targetMovement.days > 0 ? '+' : ''}${r.targetMovement.days} days from ${displayDate(r.targetMovement.from)} to ${displayDate(r.targetMovement.to)}` : null,
      actualLive: r.actual?.value.date ? `${factDate(r.actual)}${r.actual.value.extent === 'PARTIAL' ? ` (partial: ${clip(r.actual.value.text, 120)})` : ' (full named scope)'}` : factDate(r.actual),
      nextMilestone: r.milestone?.value.text ? `${clip(r.milestone.value.text, 120)} · ${factDate(r.milestone)}` : factDate(r.milestone),
      nextStep: r.nextStep?.value.text ? clip(r.nextStep.value.text) : 'Not recorded', developmentStart: factDate(dev), blocker: blocker?.value.text ? clip(blocker.value.text) : 'None recorded', href: `${base}/delivery`,
    },
    attention: r.attention.slice(0, LIMITS.attention).map(a => ({ label: a.label, detail: clip(a.detail), href: a.href })),
    setupGaps: r.setup.requirements.filter(x => !x.met).slice(0, LIMITS.setupGaps).map(x => ({ label: x.label, detail: clip(x.detail, 120), href: x.href })),
    knowledge: {
      counts: { active: claims.filter(c => c.status === 'ACTIVE').length, awaitingConfirmation: claims.filter(c => ['UNVERIFIED', 'DRAFT', 'UNKNOWN'].includes(c.status)).length, superseded: claims.filter(c => c.status === 'SUPERSEDED').length, total: claims.length },
      items: claims.slice(0, LIMITS.knowledge).map(c => ({ type: CLAIM_TYPE[c.type] ?? c.type, subject: clip(c.subject, 120), attribute: clip(c.attribute, 120), value: clip(c.value), domain: DOMAIN_LABEL[c.domain] ?? c.domain, phase: c.phase, status: CLAIM_STATUS[c.status] ?? c.status, confirmed: c.status === 'ACTIVE' && Boolean(c.verifiedAt), href: `${base}/knowledge/${c.id}` })),
      href: `${base}/knowledge`,
    },
    evidence: { count: evidence.length, items: evidenceSorted.slice(0, LIMITS.evidence).map(e => ({ title: clip(e.title, 160), type: EVIDENCE_TYPE[e.sourceType] ?? e.sourceType, date: e.occurredAt ? displayDate(e.occurredAt.slice(0, 10)) : `recorded ${displayDate(e.capturedAt.slice(0, 10))}`, boundary: BOUNDARY[e.boundary] ?? e.boundary, href: `${base}/sources` })), href: `${base}/sources` },
    proposals: input.evidence ? { pending: pending.length, latestSourceTitle: latestSource ? clip(latestSource, 160) : null, href: `${base}/sources` } : null,
    decisionsOpen: r.attention.filter(a => a.kind === 'DECISION').slice(0, LIMITS.items).map(a => ({ detail: clip(a.detail), href: a.href })),
    risks: riskRows.slice(0, LIMITS.items).map(v => ({ statement: clip(`${v.claim.subject}: ${v.claim.value}`), status: v.state === 'AWAITING_VERIFICATION' ? 'Awaiting confirmation' : v.tracking ? RISK_STATUS_LABEL[v.tracking.status] : 'Open · not yet tracked', href: `${base}/context#risk-${v.claim.id}` })),
    questions: openQs.slice(0, LIMITS.items).map(({ q, overdue }) => ({ question: clip(q.question), needed: q.dueDate ? displayDate(q.dueDate) : 'No date recorded', overdueDays: overdue, href: `${base}/context#question-${q.id}` })),
    commitments: commitments.slice(0, LIMITS.items).map(a => ({ title: clip(cap(a.title), 160), assignee: member(a.assigneeMemberId) ?? 'No assignee', due: a.dueDate ? (a.dueDate < today ? `Overdue · ${displayDate(a.dueDate)}` : displayDate(a.dueDate)) : 'No due date', status: a.status.toLowerCase().replaceAll('_', ' '), blocked: a.blockedNote ? clip(a.blockedNote, 160) : null, href: `${base}/actions?action=${a.id}` })),
    relationships: rel.slice(0, LIMITS.items).map(x => ({ relation: GROUP_LABEL[x.group], other: x.other ? `${x.other.name}${x.other.archived ? ' (archived)' : ''}` : 'An initiative you can’t access', impact: x.impactText ? clip(x.impactText) : null, late: x.late, href: x.other ? `/initiatives/${x.other.slug}` : `${base}/manage?section=relationships#relationships` })),
    metrics: { configured: coverage.configured, met: coverage.met, notMet: coverage.notMet, notAssessed: coverage.notAssessed, noTarget: coverage.noTarget, lastCaptured: coverage.lastCaptured ? displayDate(coverage.lastCaptured.slice(0, 10)) : null, synthetic: coverage.synthetic,
      items: metrics.slice(0, LIMITS.metrics).map(m => { const v = metricView(m); return { name: clip(m.name, 120), unit: m.unit, latest: v.lastRecorded ? `${v.lastRecorded.value} ${m.unit} (${displayDate(v.lastRecorded.periodEnd)})` : 'Not recorded', status: v.status.label }; }), href: `/analysis/projects/${i.slug}` },
    recentChanges: p.changes.filter(c => c.initiativeId === i.id).slice(0, LIMITS.changes).map(c => ({ sentence: clip(c.sentence), actor: c.actorLabel, at: displayDate(c.occurredAt.slice(0, 10)), href: c.href })),
  };
}

export function projectAssistantContext(input: ContextInput): AssistantContext {
  const { ctx } = input;
  const writer = canBusinessWrite(ctx) && input.writesEnabled;
  const admin = hasOrganizationAdminAuthority(ctx);
  const p = buildPortfolioProjection({ source: input.source, state: input.state, workspaceId: ctx.workspaceId, activity: input.activity, management: input.management, relationships: input.relationships, asOf: input.asOf });
  // A slug the person cannot open is not in their snapshots, so it reads exactly like one that does not exist.
  const requested = input.screen.kind === 'initiative' && input.screen.initiativeSlug ? input.screen.initiativeSlug : null;
  const snapshot = requested ? input.source.snapshots.find(s => s.initiative.slug === requested) : undefined;
  const row = snapshot ? p.rows.find(r => r.initiative.id === snapshot.initiative.id) : undefined;
  const tab = snapshot && input.screen.tab && (INITIATIVE_TABS as readonly string[]).includes(input.screen.tab) ? input.screen.tab as InitiativeTab : null;
  const initiative = snapshot && row ? initiativeContext(input, row, p, snapshot.claims, snapshot.evidence) : null;
  const { review, forRecommend } = reviewState(input, writer && (admin || ctx.isProductLead));
  const live = new Set(p.rows.filter(r => !r.initiative.archivedAt).map(r => r.initiative.id));
  const recommendations = recommend({
    today: p.today, me: { memberId: ctx.memberId ?? null, writer, canFinalize: writer && (admin || ctx.isProductLead) },
    rows: initiative ? p.rows.filter(r => r.initiative.slug === initiative.slug) : p.rows,
    commitments: input.commitments, questions: input.questions, review: forRecommend,
    proposals: initiative && input.evidence ? [{ initiativeId: snapshot!.initiative.id, pending: initiative.proposals?.pending ?? 0, sourceTitle: initiative.proposals?.latestSourceTitle ?? null }] : [],
    metrics: [...new Set(input.metrics.map(m => m.initiativeId))].filter(id => live.has(id)).map(id => ({ initiativeId: id, configured: input.metrics.filter(m => m.initiativeId === id).length })),
  });
  const screenHref = input.screen.kind === 'initiative' && initiative ? `${initiative.href}${tab && tab !== 'brief' ? `/${tab}` : ''}` : ({ home: '/', initiatives: '/initiatives', roadmap: '/roadmap', analysis: '/analysis/portfolio', 'weekly-review': review.href, administration: '/administration/organization', notifications: '/notifications', account: '/account', initiative: '/initiatives', other: '/' } as Record<AssistantScreen, string>)[input.screen.kind];
  const navigation = navigationMap({ admin, writer, initiativeSlug: initiative?.slug ?? null });
  const context: Omit<AssistantContext, 'hrefs'> = {
    version: CONTEXT_VERSION,
    organization: { name: input.presentation.organizationName, isDemo: input.presentation.isDemo, asOf: input.asOf, today: p.today },
    viewer: { role: roleLabel(ctx), writer, canFinalize: writer && (admin || ctx.isProductLead), guest: input.guest },
    screen: { kind: input.screen.kind, tab, initiativeSlug: initiative?.slug ?? null, href: screenHref },
    initiative,
    // With an initiative in view the portfolio is background: keep the summary, trim the lists.
    portfolio: {
      summary: p.summary,
      initiatives: p.rows.filter(r => !r.initiative.archivedAt).slice(0, initiative ? LIMITS.items : LIMITS.initiatives).map(r => ({ name: r.initiative.name, slug: r.initiative.slug, stage: STAGE_LABEL[r.initiative.stage], owner: r.ownerLabel, targetLive: factDate(r.target), attention: r.attention.length, setup: r.setup.label, href: `/initiatives/${r.initiative.slug}` })),
      attention: p.attentionRows.flatMap(r => r.attention.map(a => ({ initiative: r.initiative.name, label: a.label, detail: clip(a.detail), href: a.href }))).slice(0, initiative ? 5 : LIMITS.items),
      upcoming: p.upcoming.filter(u => dayDifference(p.today, u.date) <= 28).slice(0, initiative ? 5 : LIMITS.upcoming).map(u => ({ initiative: u.name, kind: u.kind === 'TARGET_LIVE' ? 'Target Live' : 'Milestone', label: clip(u.label, 120), date: displayDate(u.date), href: `/initiatives/${u.slug}/delivery` })),
      setupQueue: setupQueue(p.rows, forRecommend, writer),
      recentChanges: p.changes.slice(0, initiative ? 5 : LIMITS.changes).map(c => ({ initiative: c.name, sentence: clip(c.sentence), actor: c.actorLabel, at: displayDate(c.occurredAt.slice(0, 10)), href: c.href })),
    },
    review, recommendations, navigation,
  };
  return { ...context, hrefs: collectHrefs(context) };
}

/** Every `href` string anywhere in the context, deduplicated, in first-seen order. */
export function collectHrefs(value: unknown): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v)) { if (k === 'href' && typeof x === 'string' && x.startsWith('/')) out.add(x); else walk(x); } }
  };
  walk(value);
  return [...out];
}

/** Rough token count (characters / 4) of the serialized context, for budget reporting. */
export const approximateTokens = (context: AssistantContext) => Math.ceil(JSON.stringify(context).length / 4);
