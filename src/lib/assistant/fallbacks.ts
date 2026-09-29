import type { AssistantContext } from './context-model.ts';
import type { AnswerBlock, AnswerItem, AnswerLanguage, AnswerLink } from './types.ts';

/**
 * Deterministic answers that need no provider. They cover the three questions
 * that must never depend on a model: "what should I do next" (the
 * recommendations are computed, so the model could only restate them), "what
 * am I missing" (a list of what is not recorded, which must stay Rule 4 exact),
 * and "where do I …" (a curated route map). Each is pure, bilingual and cheap.
 */
export type Intent = 'next' | 'missing' | 'navigate';
export interface Deterministic { blocks: AnswerBlock[]; links: AnswerLink[] }

const NEXT = /next best action|what should i do( next| first| now)?\s*[?.!]*$|what do i do( next| now)?\s*[?.!]*$|^\s*what('s| is) next\s*[?.!]*$|what to do (next|now|first)\s*[?.!]*$|recommended next action|أعمل إيه|اعمل ايه|اعمل ايه|بعد كده|الخطوة (الجاية|التالية|القادمة)|الإجراء التالي|التوصية/i;
const MISSING = /what am i missing|what('s| is) missing|what is (still )?(left|remaining) (to|in) (set ?up|record|setup)|(left|still) to set up|left in (the )?setup|what is not recorded|إيه الناقص|الناقص|مش مسجل|غير مسجل|الباقي في الإعداد|لسه محتاج إعداد/i;
const NAVIGATE = /\b(where|how) (do|can|should|would) i\b|\bhow to\b|\bwhere (is|are)\b|فين|إزاي|ازاي|إزّاي|كيف/i;

/** Questions about a specific value, meaning or reason need the record read, not a canned route. */
const CONTENT = /\b(date|when|why|what does|what is the|interpret|mean|means|meaning|value|status of|how (is|are)|how much|how many|explain)\b|ليه|لماذا|يعني إيه|معنى|تاريخ|إمتى|امتى|حال/i;

export function classifyIntent(question: string): Intent | null {
  const q = question.trim();
  if (MISSING.test(q)) return 'missing';
  if (NEXT.test(q)) return 'next';
  if (NAVIGATE.test(q) && navigationTopic(q) && !CONTENT.test(q)) return 'navigate';
  return null;
}

type Topic = 'connect' | 'invite' | 'target' | 'metric' | 'evidence' | 'knowledge' | 'decision' | 'commitment' | 'context' | 'review' | 'password' | 'appearance' | 'notifications' | 'roadmap' | 'manage' | 'create' | 'relationship' | 'language';
const TOPICS: [Topic, RegExp][] = [
  ['connect', /\bjira\b|\bgmail\b|google drive|\bdrive\b|\bfigma\b|connect(ed)? sources?|connector|أوصل|اوصل|أوصّل|المصادر/i],
  ['invite', /\binvite\b|\bmember\b|\bmembers\b|\badmin\b|\brole\b|\broles\b|أدعو|ادعو|عضو|أعضاء|دور/i],
  ['target', /target live|actual live|milestone|delivery fact|next step|تارجت|الـ ?target|تاريخ/i],
  ['metric', /\bmetric|\bkpi\b|\bmeasure|observation|analysis|مقياس|قياس|metrics?/i],
  ['evidence', /\bevidence\b|\bsource\b|\bsources\b|proposal|paste|import|meeting note|دليل|مصدر|اقتراح|evidence/i],
  ['knowledge', /\bknowledge\b|\bentry\b|\bclaim\b|requirement|business rule|assumption|معرفة|knowledge/i],
  ['decision', /\bdecision|\bdecide\b|\bconflict|differ|قرار|اختلاف|decision/i],
  ['commitment', /\bcommitment|\baction\b|\bactions\b|\btask\b|التزام|commitment/i],
  ['context', /\brisk\b|\brisks\b|\bquestion\b|\bquestions\b|مخاطر|خطر|سؤال|أسئلة|risk/i],
  ['review', /weekly review|\breview\b|finali[sz]e|baseline|مراجعة|review/i],
  ['password', /password|sign in|log ?in|sign out|كلمة (السر|المرور)|باسورد/i],
  ['appearance', /dark mode|light mode|appearance|theme|المظهر|الوضع (الداكن|الليلي)|dark/i],
  ['notifications', /notification|bell|إشعار|تنبيه|notification/i],
  ['roadmap', /roadmap|timeline|خارطة|roadmap/i],
  ['relationship', /relationship|depend|blocks|part of|علاقة|اعتماد|يعتمد/i],
  ['manage', /\barchive|\bowner\b|\brename\b|business line|\bstage\b|\bscope\b|أرشف|مالك|المرحلة|النطاق/i],
  ['create', /create (an? )?(new )?initiative|new initiative|add (an? )?initiative|أنشئ|أضيف مبادرة|مبادرة جديدة/i],
  ['language', /\barabic\b|\benglish\b|language|ask prodwise|assistant|عربي|إنجليزي|اللغة|المساعد/i],
];
export function navigationTopic(question: string): Topic | null { for (const [topic, re] of TOPICS) if (re.test(question)) return topic; return null; }

const T = {
  basedOn: { en: (what: string, asOf: string) => `Based on the recorded state of ${what} as of ${asOf}. Actions come only from recorded decisions, blockers, dates, proposals, the review and setup — nothing is inferred.`, ar: (what: string, asOf: string) => `بناءً على الحالة المسجلة لـ ${what} حتى ${asOf}. الإجراءات تأتي فقط من القرارات والـ blockers والتواريخ والاقتراحات والمراجعة والإعداد المسجلة — لا شيء مستنتج.` },
  recommended: { en: 'Recommended next action', ar: 'الإجراء التالي الموصى به' },
  nothing: { en: (what: string) => `Nothing recorded on ${what} calls for an action right now. That is not a readiness judgement: it means no decision, blocker, past date, pending proposal or setup gap is recorded.`, ar: (what: string) => `لا يوجد شيء مسجل في ${what} يستدعي إجراءً الآن. هذا ليس حكمًا على الجاهزية: يعني فقط أنه لا يوجد قرار أو blocker أو تاريخ فائت أو اقتراح معلق أو نقص في الإعداد مسجل.` },
  notRecorded: { en: 'Not recorded', ar: 'غير مسجل' },
  pending: { en: 'Pending confirmation', ar: 'في انتظار التأكيد' },
  missingIntro: { en: (what: string) => `What is not recorded on ${what}. Absence of a record is not evidence that the thing does not exist — only that nobody has recorded it in Prodwise.`, ar: (what: string) => `ما هو غير مسجل في ${what}. غياب السجل ليس دليلًا على أن الشيء غير موجود — فقط أن أحدًا لم يسجله في Prodwise.` },
  complete: { en: (what: string) => `On ${what}, every setup requirement is recorded, and Target Live, Actual Live, the next milestone, the next step and development start each have a recorded value. This checks recorded fields only; it is not a readiness or release judgement.`, ar: (what: string) => `في ${what}، كل متطلبات الإعداد مسجلة، ولكل من Target Live وActual Live والـ next milestone والـ next step وDevelopment start قيمة مسجلة. هذا فحص للحقول المسجلة فقط، وليس حكمًا على الجاهزية أو الإطلاق.` },
  awaiting: { en: (n: number) => `${n} Knowledge ${n === 1 ? 'entry is' : 'entries are'} awaiting confirmation and ${n === 1 ? 'is' : 'are'} not Product Truth yet.`, ar: (n: number) => `${n} من إدخالات الـ Knowledge في انتظار التأكيد وليست Product Truth بعد.` },
  proposals: { en: (n: number, src: string | null) => `${n} pending ${n === 1 ? 'proposal' : 'proposals'}${src ? ` from “${src}”` : ''} — not part of Product Truth until a person confirms or rejects ${n === 1 ? 'it' : 'them'}.`, ar: (n: number, src: string | null) => `${n} ${n === 1 ? 'اقتراح معلق' : 'اقتراحات معلقة'}${src ? ` من "${src}"` : ''} — ليست جزءًا من Product Truth حتى يؤكدها شخص أو يرفضها.` },
  portfolioIncomplete: { en: (n: number, unknown: number) => `${n} ${n === 1 ? 'initiative has' : 'initiatives have'} setup incomplete${unknown ? `, and ${unknown} ${unknown === 1 ? 'has' : 'have'} no dated Target Live recorded` : ''}.`, ar: (n: number, unknown: number) => `${n} ${n === 1 ? 'مبادرة إعدادها' : 'مبادرات إعدادها'} غير مكتمل${unknown ? `، و${unknown} منها بدون Target Live بتاريخ مسجل` : ''}.` },
  goTo: { en: 'Go to', ar: 'اذهب إلى' },
};

const NAV_TEXT: Record<Topic, Record<AnswerLanguage, string>> = {
  connect: { en: 'Connect Jira, Gmail, Google Drive or Figma under My account → Connected sources. Each connection is yours alone; what it imports becomes evidence on the initiative you choose, and nothing becomes Knowledge until a person confirms it. Jira items are then mapped to an initiative from its Setup → Sources step.', ar: 'وصّل Jira أو Gmail أو Google Drive أو Figma من My account ← Connected sources. كل اتصال يخصك وحدك؛ ما يستورده يصبح evidence على المبادرة التي تختارها، ولا يصبح شيء Knowledge حتى يؤكده شخص. بعدها تُربط عناصر Jira بالمبادرة من خطوة Setup ← Sources.' },
  invite: { en: 'Members are invited from Administration → Members (Org Owner or Admin). The invited person sets their own password when they accept; Viewer is read-only, Member can record, Admin can administer. Only an Org Owner can grant Admin.', ar: 'يُدعى الأعضاء من Administration ← Members (بواسطة Org Owner أو Admin). الشخص المدعو يحدد كلمة المرور بنفسه عند القبول؛ Viewer للقراءة فقط، Member يستطيع التسجيل، Admin يستطيع الإدارة. الـ Org Owner وحده يمنح Admin.' },
  target: { en: 'Target Live, Actual Live, the next milestone, blocker and next step are delivery facts. Record them on the initiative’s Delivery facts page, or during Setup → Delivery. Each fact records who confirmed it and on what basis; a date can be recorded as explicitly unknown.', ar: 'الـ Target Live والـ Actual Live والـ milestone التالي والـ blocker والـ next step كلها delivery facts. سجّلها من صفحة Delivery facts في المبادرة أو من Setup ← Delivery. كل fact يسجل من أكده وعلى أي أساس؛ ويمكن تسجيل التاريخ كـ Unknown صراحةً.' },
  metric: { en: 'Metrics live in Analysis. Open the initiative’s analysis page to define a metric (name, definition, unit, source), record observations per period, and approve a target with a named approver and date. A definition exists only after an explicit confirm step.', ar: 'الـ metrics في Analysis. افتح صفحة تحليل المبادرة لتعريف metric (اسم وتعريف ووحدة ومصدر)، وتسجيل observations لكل فترة، واعتماد target باسم المعتمد وتاريخه. التعريف لا يوجد إلا بعد خطوة تأكيد صريحة.' },
  evidence: { en: 'Evidence is added on the initiative’s Sources page: paste text or meeting notes, or import from a connected source. Prodwise reads it into proposals; each proposal waits for a person to confirm or reject it before anything enters Knowledge.', ar: 'تُضاف الـ evidence من صفحة Sources في المبادرة: الصق نصًا أو محاضر اجتماع، أو استورد من مصدر موصول. يقرأها Prodwise إلى اقتراحات؛ كل اقتراح ينتظر شخصًا يؤكده أو يرفضه قبل أن يدخل أي شيء إلى الـ Knowledge.' },
  knowledge: { en: 'Knowledge holds the initiative’s confirmed entries: requirements, decisions, business rules, risks, dependencies and assumptions. Add an entry on the Knowledge page; it starts as awaiting confirmation and becomes confirmed only through an explicit verify step with evidence or a written note.', ar: 'الـ Knowledge يحتوي الإدخالات المؤكدة للمبادرة: requirements وdecisions وbusiness rules وrisks وdependencies وassumptions. أضف إدخالًا من صفحة Knowledge؛ يبدأ في انتظار التأكيد ولا يصبح مؤكدًا إلا بخطوة تحقق صريحة بدليل أو ملاحظة مكتوبة.' },
  decision: { en: 'Decisions lists recorded differences between confirmed values on the same subject and attribute. A person decides which value stands (or defers or dismisses); the other entry becomes superseded and stays in history.', ar: 'صفحة Decisions تعرض الاختلافات المسجلة بين قيم مؤكدة على نفس الموضوع والخاصية. شخص يقرر أي قيمة تبقى (أو يؤجل أو يرفض)؛ الإدخال الآخر يصبح superseded ويبقى في التاريخ.' },
  commitment: { en: 'Commitments are recorded on the initiative’s Commitments page: a title, an assignee, a due date and a status. They can also be created from a confirmed meeting proposal or a weekly-review next step.', ar: 'تُسجل الـ commitments من صفحة Commitments في المبادرة: عنوان ومسؤول وتاريخ استحقاق وحالة. ويمكن إنشاؤها أيضًا من اقتراح اجتماع مؤكد أو من next step في المراجعة الأسبوعية.' },
  context: { en: 'Risks and open questions are on the initiative’s Risks & questions page. A risk is tracked from a confirmed Knowledge risk entry; an open question records who is expected to answer and by when.', ar: 'الـ risks والأسئلة المفتوحة في صفحة Risks & questions في المبادرة. يُتابع الـ risk من إدخال risk مؤكد في الـ Knowledge؛ والسؤال المفتوح يسجل من يُتوقع أن يجيب ومتى.' },
  review: { en: 'The Weekly Review is prepared from recorded changes since the last Final. Each PM reviews their sections, then an Org Owner, Admin, Platform Owner or Product Lead finalizes it, which freezes the week’s record as the next baseline.', ar: 'تُحضّر الـ Weekly Review من التغييرات المسجلة منذ آخر Final. كل PM يراجع أقسامه، ثم يقوم Org Owner أو Admin أو Platform Owner أو Product Lead بعمل finalize، فيُجمّد سجل الأسبوع كـ baseline للمراجعة التالية.' },
  password: { en: 'Change your password and sign out under My account → Security. Other sessions are signed out when the password changes.', ar: 'غيّر كلمة المرور وسجّل الخروج من My account ← Security. الجلسات الأخرى تُسجَّل خروجها عند تغيير كلمة المرور.' },
  appearance: { en: 'Light or Dark working surfaces are chosen under My account → Appearance. The choice is remembered in this browser only.', ar: 'اختر الوضع الفاتح أو الداكن من My account ← Appearance. يُحفظ الاختيار في هذا المتصفح فقط.' },
  notifications: { en: 'Notifications lists recorded events routed to you — decisions needed, commitments due, review steps. They are derived from records on every read and never stored.', ar: 'صفحة Notifications تعرض الأحداث المسجلة الموجهة إليك — قرارات مطلوبة، commitments مستحقة، خطوات المراجعة. تُشتق من السجلات عند كل قراءة ولا تُخزَّن.' },
  roadmap: { en: 'The Roadmap places initiatives by their recorded Target Live and milestones. An initiative with no recorded Target Live is listed as unplaced until a date or an explicit “unknown” is recorded.', ar: 'الـ Roadmap يضع المبادرات حسب الـ Target Live والـ milestones المسجلة. المبادرة بدون Target Live مسجل تُعرض كغير موضوعة حتى يُسجل تاريخ أو Unknown صريح.' },
  relationship: { en: 'Relationships (depends on, part of, related to) are recorded under Manage initiative → Relationships. Date impact is derived from the recorded Target Live and milestones of both initiatives, never inferred from anything else.', ar: 'تُسجل العلاقات (depends on، part of، related to) من Manage initiative ← Relationships. أثر التواريخ يُشتق من الـ Target Live والـ milestones المسجلة للمبادرتين فقط.' },
  manage: { en: 'Name, business line, stage, objective, owner, scope context and archiving are under Manage initiative.', ar: 'الاسم والـ business line والمرحلة والهدف والمالك وسياق النطاق والأرشفة كلها تحت Manage initiative.' },
  create: { en: 'Create an initiative from Initiatives → Create initiative (a name and a business line are enough). Setup then walks through sources, delivery facts and the first confirmed entry, and can be resumed at any time.', ar: 'أنشئ مبادرة من Initiatives ← Create initiative (يكفي الاسم والـ business line). بعدها يمر الإعداد بالمصادر والـ delivery facts وأول إدخال مؤكد، ويمكن استئنافه في أي وقت.' },
  language: { en: 'Ask Prodwise answers in English or Arabic, and follows the language you write in when the preference is Auto. Change it under My account → Ask Prodwise, along with whether the control is shown.', ar: 'Ask Prodwise يجيب بالإنجليزية أو العربية، ويتبع اللغة التي تكتب بها عندما يكون التفضيل Auto. غيّره من My account ← Ask Prodwise، مع اختيار إظهار الزر أو إخفائه.' },
};
const NAV_LINKS: Record<Topic, { labels: string[]; generic: string[] }> = {
  connect: { labels: ['Connected sources', 'Setup'], generic: ['/account/connections'] },
  invite: { labels: ['Administration', 'My account'], generic: ['/administration/organization', '/account'] },
  target: { labels: ['Delivery facts', 'Setup', 'Roadmap'], generic: ['/roadmap', '/initiatives'] },
  metric: { labels: ['Initiative analysis', 'Analysis'], generic: ['/analysis/portfolio'] },
  evidence: { labels: ['Sources', 'Connected sources'], generic: ['/account/connections', '/initiatives'] },
  knowledge: { labels: ['Knowledge'], generic: ['/initiatives'] },
  decision: { labels: ['Decisions'], generic: ['/initiatives'] },
  commitment: { labels: ['Commitments'], generic: ['/initiatives'] },
  context: { labels: ['Risks & questions'], generic: ['/initiatives'] },
  review: { labels: ['Weekly Review'], generic: ['/weekly-review'] },
  password: { labels: ['My account'], generic: ['/account'] },
  appearance: { labels: ['My account'], generic: ['/account'] },
  notifications: { labels: ['Notifications'], generic: ['/notifications'] },
  roadmap: { labels: ['Roadmap'], generic: ['/roadmap'] },
  relationship: { labels: ['Manage initiative'], generic: ['/initiatives'] },
  manage: { labels: ['Manage initiative'], generic: ['/initiatives'] },
  create: { labels: ['Create initiative', 'Initiatives'], generic: ['/initiatives'] },
  language: { labels: ['My account'], generic: ['/account'] },
};

const subject = (c: AssistantContext) => c.initiative?.name ?? c.organization.name;

function nextAnswer(c: AssistantContext, language: AnswerLanguage): Deterministic {
  const what = subject(c), asOf = c.organization.today;
  const blocks: AnswerBlock[] = [{ kind: 'text', text: T.basedOn[language](what, asOf) }];
  if (c.recommendations.length) blocks.push({ kind: 'recommendations', title: T.recommended[language], items: c.recommendations });
  else {
    blocks.push({ kind: 'text', text: T.nothing[language](what) });
    const missing = missingItems(c);
    if (missing.length) blocks.push({ kind: 'missing', title: T.notRecorded[language], items: missing.slice(0, 8) });
  }
  return { blocks, links: c.initiative ? [{ label: c.initiative.name, href: c.initiative.href }] : [] };
}

function missingItems(c: AssistantContext): AnswerItem[] {
  const items: AnswerItem[] = [];
  if (c.initiative) {
    const i = c.initiative;
    for (const g of i.setupGaps) items.push({ text: `${g.label}: ${g.detail}`, href: g.href });
    const d = i.delivery;
    for (const [label, value] of [['Target Live', d.targetLive], ['Actual Live', d.actualLive], ['Next milestone', d.nextMilestone], ['Next step', d.nextStep], ['Development start', d.developmentStart]] as const) if (value === 'Not recorded' && !items.some(x => x.text.startsWith(label))) items.push({ text: `${label}: Not recorded`, href: d.href });
    if (i.scope === 'Not recorded' && !i.setupGaps.some(g => g.label === 'Current scope / phase')) items.push({ text: 'Current scope / phase: Not recorded', href: `${i.href}/manage?section=context` });
  } else {
    for (const q of c.portfolio.setupQueue) items.push({ text: `${q.label}: ${q.detail}`, href: q.href });
  }
  return items;
}

function missingAnswer(c: AssistantContext, language: AnswerLanguage): Deterministic {
  const what = subject(c);
  const items = missingItems(c);
  const blocks: AnswerBlock[] = [{ kind: 'text', text: items.length ? T.missingIntro[language](what) : T.complete[language](what) }];
  if (!c.initiative && c.portfolio.summary.setupIncomplete) blocks.push({ kind: 'text', text: T.portfolioIncomplete[language](c.portfolio.summary.setupIncomplete, c.portfolio.summary.unknownTargets) });
  if (items.length) blocks.push({ kind: 'missing', title: T.notRecorded[language], items: items.slice(0, 8) });
  const pending: AnswerItem[] = [];
  if (c.initiative?.proposals?.pending) pending.push({ text: T.proposals[language](c.initiative.proposals.pending, c.initiative.proposals.latestSourceTitle), href: c.initiative.proposals.href });
  if (c.initiative?.knowledge.counts.awaitingConfirmation) pending.push({ text: T.awaiting[language](c.initiative.knowledge.counts.awaitingConfirmation), href: c.initiative.knowledge.href });
  if (pending.length) blocks.push({ kind: 'pending', title: T.pending[language], items: pending });
  return { blocks, links: c.initiative ? [{ label: 'Setup', href: `${c.initiative.href}/setup` }] : [{ label: 'Initiatives', href: '/initiatives' }] };
}

function navigateAnswer(c: AssistantContext, language: AnswerLanguage, topic: Topic): Deterministic {
  const spec = NAV_LINKS[topic];
  const byLabel = new Map(c.navigation.map(n => [n.label, n]));
  const links: AnswerLink[] = [];
  for (const label of spec.labels) { const n = byLabel.get(label); if (n && !links.some(l => l.href === n.href)) links.push({ label: n.label, href: n.href }); }
  for (const href of spec.generic) { const n = c.navigation.find(x => x.href === href); if (n && !links.some(l => l.href === n.href)) links.push({ label: n.label, href: n.href }); }
  let text = NAV_TEXT[topic][language];
  if (topic === 'invite' && !c.navigation.some(n => n.href === '/administration/organization')) text += language === 'ar' ? ' لا تملك صلاحية الإدارة في هذه المنظمة؛ اطلب من Org Owner أو Admin.' : ' You do not have administration authority in this organization; ask an Org Owner or Admin.';
  if (!c.initiative && ['target', 'metric', 'evidence', 'knowledge', 'decision', 'commitment', 'context', 'relationship', 'manage'].includes(topic)) text += language === 'ar' ? ' افتح المبادرة المعنية أولًا من Initiatives.' : ' Open the initiative first from Initiatives.';
  return { blocks: [{ kind: 'text', text }], links: links.slice(0, 5) };
}

/** A grounded answer without a provider, or null when the question needs one. */
export function deterministicAnswer(question: string, context: AssistantContext, language: AnswerLanguage): Deterministic | null {
  const intent = classifyIntent(question);
  if (intent === 'next') return nextAnswer(context, language);
  if (intent === 'missing') return missingAnswer(context, language);
  if (intent === 'navigate') { const topic = navigationTopic(question); return topic ? navigateAnswer(context, language, topic) : null; }
  return null;
}
