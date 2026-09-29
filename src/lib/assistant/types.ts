import type { Recommendation } from './recommend.ts';

/**
 * Ask Prodwise — shared contracts (no server imports, safe for the Wave 3 panel).
 *
 * Everything here is advisory. The assistant reads what the pages already
 * render and can never change a record: there is no write path in this module
 * tree, and the answer contract carries only text, record links and the keys
 * of deterministic recommendations.
 */
export const ASSISTANT_SCREENS = ['home', 'initiatives', 'initiative', 'roadmap', 'analysis', 'weekly-review', 'administration', 'notifications', 'account', 'other'] as const;
export type AssistantScreen = typeof ASSISTANT_SCREENS[number];
/** Tabs of the initiative workspace the panel may name; anything else reads as the Brief. */
export const INITIATIVE_TABS = ['brief', 'knowledge', 'sources', 'decisions', 'delivery', 'actions', 'context', 'history', 'manage', 'setup', 'evidence', 'memory'] as const;
export type InitiativeTab = typeof INITIATIVE_TABS[number];

export type AnswerLanguage = 'en' | 'ar';
export type LanguagePreference = 'auto' | 'en' | 'ar';

/** A link the answer may carry. Its href must be one the context produced. */
export interface AnswerLink { label: string; href: string }
export interface AnswerItem { text: string; href?: string }
export type AnswerBlock =
  | { kind: 'text'; text: string }
  | { kind: 'facts'; title?: string; items: AnswerItem[] }
  | { kind: 'missing'; title?: string; items: AnswerItem[] }
  | { kind: 'pending'; title?: string; items: AnswerItem[] }
  | { kind: 'recommendations'; title?: string; items: Recommendation[] };

export interface AssistantAnswer {
  language: AnswerLanguage;
  blocks: AnswerBlock[];
  links: AnswerLink[];
  /** Where the words came from. Deterministic answers never touched a provider. */
  source: 'deterministic' | 'model';
  /** Honest labelling for the Demo organization (decision D9). */
  synthetic: boolean;
  /** The screen and initiative the answer was grounded in. */
  basedOn: { screen: AssistantScreen; initiative: { name: string; slug: string; href: string } | null; asOf: string };
}

export const ASK_FAILURE_CODES = ['NOT_CONFIGURED', 'TIMED_OUT', 'PROVIDER_FAILED', 'INVALID_RESPONSE', 'RATE_LIMITED', 'OUT_OF_SCOPE', 'INVALID_REQUEST'] as const;
export type AskFailureCode = typeof ASK_FAILURE_CODES[number];

export type AskResult =
  | { ok: true; answer: AssistantAnswer }
  | { ok: false; code: AskFailureCode; language: AnswerLanguage; message: string; retryAfterSeconds?: number };

export interface HistoryTurn { role: 'user' | 'assistant'; text: string }
export const HISTORY_LIMIT = 6;
export const QUESTION_LIMIT = 2000;
export const HISTORY_TURN_LIMIT = 1500;

/** Plain sentences the panel can show for each failure, in both languages. Never provider text. */
export const FAILURE_MESSAGE: Record<AskFailureCode, Record<AnswerLanguage, string>> = {
  NOT_CONFIGURED: { en: 'Ask Prodwise is not configured in this environment. Starters that read recorded state still work.', ar: 'Ask Prodwise غير مُفعّل في هذه البيئة. الأسئلة الجاهزة التي تقرأ الحالة المسجلة ما زالت تعمل.' },
  TIMED_OUT: { en: 'The answer took too long. Nothing was changed; you can ask again.', ar: 'استغرقت الإجابة وقتًا طويلًا. لم يتغير شيء؛ يمكنك السؤال مرة أخرى.' },
  PROVIDER_FAILED: { en: 'Ask Prodwise could not answer right now. Nothing was changed; try again shortly.', ar: 'تعذّر على Ask Prodwise الإجابة الآن. لم يتغير شيء؛ حاول مرة أخرى بعد قليل.' },
  INVALID_RESPONSE: { en: 'The answer did not pass Prodwise’s checks, so it was not shown. Nothing was changed; try again.', ar: 'لم تجتز الإجابة فحوصات Prodwise فلم تُعرض. لم يتغير شيء؛ حاول مرة أخرى.' },
  RATE_LIMITED: { en: 'You have asked many questions in a short time. Wait a few minutes and try again.', ar: 'طرحت أسئلة كثيرة في وقت قصير. انتظر بضع دقائق ثم حاول مرة أخرى.' },
  OUT_OF_SCOPE: { en: 'Ask Prodwise answers questions about your initiatives, records and how to use Prodwise. Ask about one of those.', ar: 'Ask Prodwise يجيب عن أسئلة تخص مبادراتك وسجلاتك وطريقة استخدام Prodwise. اسأل عن أحد هذه الموضوعات.' },
  INVALID_REQUEST: { en: 'The question could not be read. Type a question of up to 2,000 characters.', ar: 'تعذّر قراءة السؤال. اكتب سؤالًا لا يتجاوز 2000 حرف.' },
};
