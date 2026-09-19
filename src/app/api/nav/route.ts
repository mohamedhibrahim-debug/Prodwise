import { NextResponse } from "next/server";

import { getRepository } from "@/lib/data";

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
  const initiatives = await getRepository().listInitiatives();

  return NextResponse.json({
    initiatives: initiatives.map((i) => ({
      slug: i.slug,
      name: i.name,
      stage: i.stage,
      businessLine: i.businessLine,
      overallState: i.overallState,
    })),
  });
}
