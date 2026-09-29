import { NextResponse, type NextRequest } from 'next/server';
import { AccessError } from '@/lib/auth/core';
import { contextForRequest } from '@/lib/auth/service';
import { isClaudeConfigured } from '@/lib/env';
import { readAssistantPreferences, writeAssistantPreferences } from '@/lib/assistant/preferences';
import { GUEST_RULE, MEMBER_RULE } from '@/lib/assistant/rate-limit';
import { safeMessage } from '@/lib/errors/safe-message';

export const dynamic = 'force-dynamic';

/**
 * GET  /api/assistant/preferences — the caller's Ask Prodwise preferences plus what the panel
 *      needs to start: whether a provider is configured (deterministic starters work either way)
 *      and the rate limits that apply.
 * PUT  /api/assistant/preferences — a partial update of the four known keys; answers the merged
 *      result. Never a product record; refused for shared Demo guest sessions.
 */
const headers = { 'Cache-Control': 'no-store' };
async function authenticated() {
  try { await contextForRequest(); return null; }
  catch (error) { if (error instanceof AccessError) return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.code === 'UNAUTHENTICATED' ? 401 : 403, headers }); throw error; }
}

export async function GET() {
  const denied = await authenticated(); if (denied) return denied;
  const { preferences, persisted } = await readAssistantPreferences();
  return NextResponse.json({ ok: true, preferences, persisted, configured: isClaudeConfigured, limits: { member: MEMBER_RULE, guest: GUEST_RULE } }, { headers });
}

export async function PUT(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ ok: false, code: 'ORIGIN_REFUSED', message: 'Request origin refused.' }, { status: 403, headers });
  const denied = await authenticated(); if (denied) return denied;
  let patch: unknown; try { patch = await request.json(); } catch { patch = null; }
  try {
    const preferences = await writeAssistantPreferences(patch);
    return NextResponse.json({ ok: true, preferences, persisted: true }, { headers });
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.code === 'DEMO_GUEST' ? 403 : 400, headers });
    return NextResponse.json({ ok: false, code: 'SAVE_FAILED', message: safeMessage(error, 'Your Ask Prodwise preferences could not be saved. Try again.') }, { status: 500, headers });
  }
}
