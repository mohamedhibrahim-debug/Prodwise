import { NextResponse } from "next/server";

import { getRepository } from "@/lib/data";
import { contextForRequest } from "@/lib/auth/service";
import { AccessError } from "@/lib/auth/core";

export const dynamic = "force-dynamic";

/**
 * Navigation data for the command palette.
 *
 * Deliberately NOT fetched in the root layout. Doing that would add a query to
 * every request in the application — including Readiness, which currently
 * issues exactly one — to populate a surface most requests never open. The
 * palette fetches this once, the first time it is opened, and holds it for the
 * rest of the session, so the cost is zero on every page render and zero on
 * every subsequent open.
 *
 * Read-only, and exposes nothing new: these are the same fields the Initiatives
 * list already renders. No mutation reaches this route.
 */
export async function GET() {
  try { await contextForRequest(); }
  catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.code === 'UNAUTHENTICATED' ? 401 : 403, headers: { 'Cache-Control': 'no-store' } });
    throw error;
  }
  const initiatives = await getRepository().listInitiatives();
  // Non-secret deployment identity for authenticated release verification.
  const releaseSha = process.env.VERCEL_GIT_COMMIT_SHA ?? '';
  const releaseHeader: Record<string, string> = /^[a-f0-9]{40}$/i.test(releaseSha) ? { 'X-Prodwise-Commit': releaseSha } : {};

  return NextResponse.json({
    initiatives: initiatives.map((i) => ({
      slug: i.slug,
      archivedAt: i.archivedAt ?? null,
      name: i.name,
      stage: i.stage,
      businessLine: i.businessLine,
      overallState: i.overallState,
    })),
  }, { headers: { 'Cache-Control': 'private, no-store', ...releaseHeader } });
}
