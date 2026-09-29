import { NextResponse, type NextRequest } from 'next/server';
import { AccessError } from '@/lib/auth/core';
import { contextForRequest, isDemoGuestSession } from '@/lib/auth/service';
import { buildAssistantContext } from '@/lib/assistant/context';
import { askProdwise } from '@/lib/assistant/answer';
import { classifyIntent } from '@/lib/assistant/fallbacks';
import { answerLanguage } from '@/lib/assistant/language';
import { readAssistantPreferences } from '@/lib/assistant/preferences';
import { GUEST_RULE, MEMBER_RULE, SlidingWindowLimiter } from '@/lib/assistant/rate-limit';
import { ASSISTANT_SCREENS, FAILURE_MESSAGE, HISTORY_LIMIT, HISTORY_TURN_LIMIT, QUESTION_LIMIT, type AskFailureCode, type AskResult, type AssistantScreen, type HistoryTurn, type LanguagePreference } from '@/lib/assistant/types';

export const dynamic = 'force-dynamic';
/** 25s provider bound plus context assembly, inside the platform's 60s limit. */
export const maxDuration = 40;

/**
 * POST /api/assistant — Ask Prodwise. Advisory only: this route has no write
 * path. It authenticates the caller, bounds their rate, assembles the context
 * from their own session, and returns a validated answer or a refusal code.
 *
 * Privacy: the question, the context and the answer are never logged; one
 * line records the code, HTTP status and duration.
 */
const limiter = new SlidingWindowLimiter();
const STATUS: Record<AskFailureCode, number> = { INVALID_REQUEST: 400, RATE_LIMITED: 429, NOT_CONFIGURED: 503, TIMED_OUT: 504, PROVIDER_FAILED: 502, INVALID_RESPONSE: 502, OUT_OF_SCOPE: 200 };
const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/, TAB = /^[a-z-]{1,24}$/;

interface Body { question: string; screen: AssistantScreen; tab: string | null; initiativeSlug: string | null; preferredLanguage: LanguagePreference | null; history: HistoryTurn[] }
function parseBody(raw: unknown): Body | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.question !== 'string' || !b.question.trim() || b.question.length > QUESTION_LIMIT) return null;
  if (b.screen !== undefined && !(ASSISTANT_SCREENS as readonly unknown[]).includes(b.screen)) return null;
  const screen = b.screen === undefined ? 'other' : b.screen as AssistantScreen;
  const tab = typeof b.tab === 'string' && TAB.test(b.tab) ? b.tab : null;
  const initiativeSlug = typeof b.initiativeSlug === 'string' && SLUG.test(b.initiativeSlug) ? b.initiativeSlug : null;
  const preferredLanguage = b.preferredLanguage === 'auto' || b.preferredLanguage === 'en' || b.preferredLanguage === 'ar' ? b.preferredLanguage : null;
  if (b.preferredLanguage !== undefined && b.preferredLanguage !== null && !preferredLanguage) return null;
  const history: HistoryTurn[] = [];
  if (b.history !== undefined) {
    if (!Array.isArray(b.history) || b.history.length > HISTORY_LIMIT) return null;
    for (const t of b.history) {
      if (!t || typeof t !== 'object') return null;
      const turn = t as Record<string, unknown>;
      if ((turn.role !== 'user' && turn.role !== 'assistant') || typeof turn.text !== 'string' || turn.text.length > HISTORY_TURN_LIMIT) return null;
      history.push({ role: turn.role, text: turn.text });
    }
  }
  return { question: b.question, screen, tab, initiativeSlug, preferredLanguage, history };
}

const json = (body: AskResult | { ok: false; code: string; message: string }, status: number, headers: Record<string, string> = {}) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const refuse = (code: AskFailureCode, language: 'en' | 'ar' = 'en', extra: Record<string, unknown> = {}) => ({ ok: false as const, code, language, message: FAILURE_MESSAGE[code][language], ...extra });

export async function POST(request: NextRequest) {
  const started = Date.now();
  let code = 'OK', status = 200;
  const log = () => console.info(`[assistant] code=${code} status=${status} ms=${Date.now() - started}`);
  try {
    if (request.headers.get('origin') !== request.nextUrl.origin) { code = 'ORIGIN_REFUSED'; status = 403; log(); return json({ ok: false, code, message: 'Request origin refused.' }, status); }
    let ctx;
    try { ctx = await contextForRequest(); }
    catch (error) {
      if (error instanceof AccessError) { code = error.code; status = error.code === 'UNAUTHENTICATED' ? 401 : 403; log(); return json({ ok: false, code, message: error.message }, status); }
      throw error;
    }
    let raw: unknown = null;
    try { raw = await request.json(); } catch { raw = null; }
    const body = parseBody(raw);
    // Refusals answer in the person's language too (Devil R1-M10).
    const rawQuestion = raw && typeof raw === 'object' && typeof (raw as { question?: unknown }).question === 'string' ? (raw as { question: string }).question.slice(0, QUESTION_LIMIT) : '';
    if (!body) { code = 'INVALID_REQUEST'; status = 400; log(); return json(refuse('INVALID_REQUEST', answerLanguage(rawQuestion)), status); }

    const preferredLanguage = body.preferredLanguage ?? (await readAssistantPreferences()).preferences.language;
    const language = answerLanguage(body.question, preferredLanguage);
    // Questions answered from the record without the provider cost nothing and do not spend the limit (Devil R1-M8).
    const guest = await isDemoGuestSession();
    const decision = classifyIntent(body.question) ? null : limiter.take(`${guest ? 'guest' : 'user'}:${ctx.actor.id}`, guest ? GUEST_RULE : MEMBER_RULE);
    if (decision && !decision.allowed) {
      const seconds = Math.ceil(decision.retryAfterMs / 1000);
      code = 'RATE_LIMITED'; status = 429; log();
      return json(refuse('RATE_LIMITED', language, { retryAfterSeconds: seconds }), status, { 'Retry-After': String(seconds) });
    }
    const context = await buildAssistantContext({ kind: body.screen, tab: body.tab, initiativeSlug: body.initiativeSlug });
    const result = await askProdwise({ question: body.question, context, preferredLanguage, history: body.history });
    code = result.ok ? 'OK' : result.code; status = result.ok ? 200 : STATUS[result.code]; log();
    return json(result, status, decision ? { 'X-RateLimit-Remaining': String(decision.remaining) } : {});
  } catch {
    code = 'FAILED'; status = 500; log();
    return json(refuse('PROVIDER_FAILED'), status);
  }
}
