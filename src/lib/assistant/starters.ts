import type { AnswerLanguage, AssistantScreen, InitiativeTab } from './types.ts';

/**
 * Starter actions per screen (§19.5). Pure and cheap: the panel shows them
 * before any request, and each one is an ordinary question the route answers.
 * `deterministic` starters are answered without a provider from recorded state
 * (recommend(), setup gaps, the route map), so they work when Claude is off.
 */
export interface Starter { key: string; label: string; question: string; deterministic: boolean }
type Text = Record<AnswerLanguage, { label: string; question: string }>;
interface StarterSpec { key: string; deterministic: boolean; text: Text }

const t = (key: string, deterministic: boolean, en: [string, string], ar: [string, string]): StarterSpec => ({ key, deterministic, text: { en: { label: en[0], question: en[1] }, ar: { label: ar[0], question: ar[1] } } });

const NEXT = t('next', true, ['What should I do next?', 'What should I do next?'], ['أعمل إيه بعد كده؟', 'إيه الـ Next Best Action دلوقتي؟']);
const MISSING = t('missing', true, ['What am I missing?', 'What am I missing in the current record?'], ['إيه الناقص؟', 'إيه الناقص في السجل الحالي؟']);
const ATTENTION = t('attention', false, ['What needs attention?', 'What needs my attention right now, and why?'], ['إيه اللي محتاج انتباه؟', 'إيه اللي محتاج انتباهي دلوقتي وليه؟']);
const CHANGED = t('changed', false, ['What changed?', 'What changed since the last Final review?'], ['إيه اللي اتغير؟', 'إيه اللي اتغير من آخر مراجعة Final؟']);

const BY_SCREEN: Record<AssistantScreen, StarterSpec[]> = {
  home: [ATTENTION, NEXT, CHANGED, MISSING],
  initiatives: [
    t('attention-list', false, ['Which initiatives need attention?', 'Which initiatives need attention, and for what recorded reason?'], ['أنهي مبادرات محتاجة انتباه؟', 'أنهي مبادرات محتاجة انتباه، وإيه السبب المسجل؟']),
    t('setup', true, ['What is still to set up?', 'What am I missing in initiative setup?'], ['إيه اللي لسه محتاج إعداد؟', 'إيه الناقص في إعداد المبادرات؟']),
    NEXT,
  ],
  initiative: [
    t('summary', false, ['Summarize this initiative', 'Summarize the current recorded state of this initiative.'], ['لخّص المبادرة دي', 'لخّص الحالة المسجلة الحالية للمبادرة دي.']),
    ATTENTION, NEXT,
    t('not-recorded', true, ['What is not recorded?', 'What am I missing on this initiative?'], ['إيه اللي مش مسجل؟', 'إيه الناقص في المبادرة دي؟']),
  ],
  roadmap: [
    t('upcoming', false, ['What is coming up?', 'Which Target Live dates and milestones are coming up?'], ['إيه اللي جاي؟', 'إيه تواريخ الـ Target Live والـ milestones الجاية؟']),
    t('unplaced', true, ['Which have no Target Live?', 'What am I missing so every initiative is placed on the Roadmap?'], ['أنهي مبادرات من غير Target Live؟', 'إيه الناقص عشان كل مبادرة تتحط على الـ Roadmap؟']),
    t('explain-target', false, ['Explain Target Live', 'Explain what Target Live means in Prodwise and how it differs from Actual Live.'], ['اشرح الـ Target Live', 'اشرح يعني إيه Target Live في Prodwise والفرق بينه وبين Actual Live.']),
  ],
  analysis: [
    t('no-target', false, ['Which metrics have no target?', 'Which metrics have no approved target or no observations?'], ['أنهي metrics من غير target؟', 'أنهي metrics من غير target معتمد أو من غير observations؟']),
    t('last-captured', false, ['When was data last captured?', 'When was each metric last captured, and is any stale?'], ['آخر مرة اتسجلت بيانات إمتى؟', 'كل metric اتسجل آخر مرة إمتى، وفيه حاجة قديمة؟']),
    t('how-metric', true, ['How do I define a metric?', 'Where do I define a metric?'], ['أعرّف metric إزاي؟', 'فين أعرّف metric؟']),
  ],
  'weekly-review': [
    t('prepare', false, ['Help me prepare this review', 'Help me prepare this week’s review from the recorded changes.'], ['ساعدني أحضّر المراجعة دي', 'ساعدني أحضّر مراجعة الأسبوع ده من التغييرات المسجلة.']),
    CHANGED,
    t('finalize', false, ['What is left before finalizing?', 'What is left before this review can be finalized?'], ['إيه الباقي قبل الـ finalize؟', 'إيه الباقي قبل ما المراجعة دي تتعمل لها finalize؟']),
  ],
  administration: [
    t('invite', true, ['How do I invite a member?', 'Where do I invite a member?'], ['أدعو عضو إزاي؟', 'فين أدعو عضو جديد؟']),
    t('roles', false, ['What can each role do?', 'What can each organization role do in Prodwise?'], ['كل role يقدر يعمل إيه؟', 'كل role في المنظمة يقدر يعمل إيه في Prodwise؟']),
    t('connect-jira', true, ['How do I connect Jira?', 'Where do I connect Jira?'], ['أوصّل Jira إزاي؟', 'فين أوصّل Jira؟']),
  ],
  notifications: [ATTENTION, NEXT],
  account: [
    t('connect-sources', true, ['Where do I connect sources?', 'Where do I connect Jira, Gmail, Google Drive or Figma?'], ['فين أوصّل المصادر؟', 'فين أوصّل Jira أو Gmail أو Google Drive أو Figma؟']),
    t('language', false, ['Can I ask in Arabic?', 'Can I ask Prodwise in Arabic or a mix of Arabic and English?'], ['أقدر أسأل بالعربي؟', 'أقدر أسأل Prodwise بالعربي أو بخليط عربي وإنجليزي؟']),
  ],
  other: [ATTENTION, NEXT, MISSING],
};

const BY_TAB: Partial<Record<InitiativeTab, StarterSpec[]>> = {
  knowledge: [
    t('knowledge-summary', false, ['What is confirmed here?', 'Which Knowledge entries are confirmed, and which are awaiting confirmation?'], ['إيه المؤكد هنا؟', 'أنهي Knowledge entries مؤكدة وأنهي لسه مستنية تأكيد؟']),
    t('risk-vs-decision', false, ['Risk vs Decision?', 'What is the difference between a Risk and a Decision in Knowledge?'], ['إيه الفرق بين Risk و Decision؟', 'إيه الفرق بين Risk و Decision في الـ Knowledge؟']),
    NEXT,
  ],
  sources: [
    t('pending', false, ['What is pending confirmation?', 'What is pending confirmation from the linked sources?'], ['إيه المستني تأكيد؟', 'إيه اللي مستني تأكيد من المصادر المربوطة؟']),
    t('add-source', true, ['How do I add a source?', 'Where do I connect Jira or add evidence?'], ['أضيف مصدر إزاي؟', 'فين أوصّل Jira أو أضيف evidence؟']),
    NEXT,
  ],
  decisions: [
    t('open-decision', false, ['Explain the open decision', 'Explain the open decision and what each recorded value says.'], ['اشرح القرار المفتوح', 'اشرح القرار المفتوح وكل قيمة مسجلة بتقول إيه.']),
    NEXT,
  ],
  delivery: [
    t('explain-target', false, ['Explain the Target Live', 'Explain the recorded Target Live and how it moved.'], ['اشرح الـ Target Live', 'اشرح الـ Target Live المسجل وإزاي اتحرك.']),
    t('not-recorded', true, ['What is not recorded?', 'What am I missing in the delivery facts?'], ['إيه اللي مش مسجل؟', 'إيه الناقص في الـ delivery facts؟']),
    NEXT,
  ],
  actions: [
    t('overdue', false, ['What is overdue?', 'Which commitments are overdue or blocked?'], ['إيه المتأخر؟', 'أنهي commitments متأخرة أو blocked؟']),
    NEXT,
  ],
  context: [
    t('open-items', false, ['What is open here?', 'Which risks and questions are open, and which are overdue?'], ['إيه المفتوح هنا؟', 'أنهي risks و questions مفتوحة وأنهي متأخرة؟']),
    NEXT,
  ],
  setup: [
    t('setup-next', true, ['What is left to set up?', 'What am I missing in setup?'], ['إيه الباقي في الإعداد؟', 'إيه الناقص في الإعداد؟']),
    t('how-target', true, ['How do I set Target Live?', 'Where do I set the Target Live?'], ['أحدد الـ Target Live إزاي؟', 'فين أحدد الـ Target Live؟']),
  ],
};

/** At most four starters for a screen (and initiative tab), in the answer language. */
export function starters(screen: AssistantScreen, options: { tab?: string | null; language?: AnswerLanguage } = {}): Starter[] {
  const language = options.language ?? 'en';
  const tab = screen === 'initiative' && options.tab ? BY_TAB[options.tab as InitiativeTab] : undefined;
  const specs = tab ?? BY_SCREEN[screen] ?? BY_SCREEN.other;
  return specs.slice(0, 4).map(s => ({ key: s.key, label: s.text[language].label, question: s.text[language].question, deterministic: s.deterministic }));
}
