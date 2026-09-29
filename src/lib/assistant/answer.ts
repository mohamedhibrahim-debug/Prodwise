import { modelJson } from '../evidence/extract.ts';
import type { AssistantContext } from './context-model.ts';
import { answerLanguage } from './language.ts';
import { deterministicAnswer } from './fallbacks.ts';
import { OUTPUT_FORMAT, SYSTEM_PROMPT, userMessage, validateAnswer } from './prompt.ts';
import { FAILURE_MESSAGE, HISTORY_LIMIT, HISTORY_TURN_LIMIT, QUESTION_LIMIT, type AskFailureCode, type AskResult, type AssistantAnswer, type HistoryTurn, type LanguagePreference } from './types.ts';

/**
 * One question → one answer. The context is built by the caller (the route)
 * from the person's own session; this module never reads data itself, so it
 * can be tested end to end with a mock provider.
 *
 * Provider shape mirrors src/lib/delivery/ai.ts and src/lib/evidence/extract.ts:
 * a direct fetch to the Messages API, ANTHROPIC_API_KEY / ANTHROPIC_MODEL,
 * effort low, a hard timeout, stop_reason checks, tolerant JSON parsing and a
 * strict server-side validation of the result. Nothing the provider returns is
 * shown unvalidated, and no provider text is surfaced on failure.
 */
export const PROVIDER_TIMEOUT_MS = 25_000;
export const MAX_OUTPUT_TOKENS = 600;

export interface AskInput { question: string; context: AssistantContext; preferredLanguage?: LanguagePreference; history?: HistoryTurn[] }
export interface AskDeps { fetcher?: typeof fetch; env?: { ANTHROPIC_API_KEY?: string; ANTHROPIC_MODEL?: string } }

const fail = (code: AskFailureCode, language: 'en' | 'ar', retryAfterSeconds?: number): AskResult => ({ ok: false, code, language, message: FAILURE_MESSAGE[code][language], ...(retryAfterSeconds ? { retryAfterSeconds } : {}) });

/** History as the model sees it: bounded turns of plain text, newest last. */
export function boundHistory(history: HistoryTurn[] | undefined): HistoryTurn[] {
  return (history ?? []).filter(t => t && (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string' && t.text.trim()).slice(-HISTORY_LIMIT).map(t => ({ role: t.role, text: t.text.trim().slice(0, HISTORY_TURN_LIMIT) }));
}

export async function askProdwise(input: AskInput, deps: AskDeps = {}): Promise<AskResult> {
  const question = (input.question ?? '').trim();
  const language = answerLanguage(question, input.preferredLanguage ?? 'auto');
  if (!question || question.length > QUESTION_LIMIT) return fail('INVALID_REQUEST', language);
  const { context } = input;
  const basedOn: AssistantAnswer['basedOn'] = { screen: context.screen.kind, initiative: context.initiative ? { name: context.initiative.name, slug: context.initiative.slug, href: context.initiative.href } : null, asOf: context.organization.asOf };
  const finish = (answer: Pick<AssistantAnswer, 'language' | 'blocks' | 'links'>, source: AssistantAnswer['source']): AskResult => ({ ok: true, answer: { ...answer, source, synthetic: context.organization.isDemo, basedOn } });

  const deterministic = deterministicAnswer(question, context, language);
  if (deterministic) return finish({ language, ...deterministic }, 'deterministic');

  const env = deps.env ?? process.env;
  const key = env.ANTHROPIC_API_KEY?.trim(), model = env.ANTHROPIC_MODEL?.trim();
  if (!key || !model) return fail('NOT_CONFIGURED', language);
  const fetcher = deps.fetcher ?? fetch;
  try {
    const response = await fetcher('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01', 'x-api-key': key },
      body: JSON.stringify({ model, max_tokens: MAX_OUTPUT_TOKENS, output_config: { effort: 'low', format: OUTPUT_FORMAT }, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: userMessage({ question, answerLanguage: language, context, history: boundHistory(input.history) }) }] }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    if (!response.ok) return fail('PROVIDER_FAILED', language);
    const body = await response.json() as { stop_reason?: string; content?: { type: string; text?: string }[] };
    if (body.stop_reason === 'max_tokens' || body.stop_reason === 'refusal') return fail('INVALID_RESPONSE', language);
    const raw = (body.content ?? []).filter(c => c.type === 'text').map(c => c.text ?? '').join('');
    const parsed = modelJson(raw);
    if (parsed === undefined) return fail('INVALID_RESPONSE', language);
    const validated = validateAnswer(parsed, context, language);
    if (validated.kind === 'invalid') return fail('INVALID_RESPONSE', language);
    if (validated.kind === 'out-of-scope') return fail('OUT_OF_SCOPE', validated.language);
    return finish(validated.answer, 'model');
  } catch (error) {
    return fail(error instanceof Error && error.name === 'TimeoutError' ? 'TIMED_OUT' : 'PROVIDER_FAILED', language);
  }
}
