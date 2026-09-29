import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getRepository } from "@/lib/data";
import { AccessError } from "@/lib/auth/core";
import { assertWorkspaceScope } from "@/lib/auth/scope";
import { freshContextForRequest } from "@/lib/auth/service";
import { safeMessage } from "@/lib/errors/safe-message";
import { importItem, type ImportOutcome } from "@/lib/connectors/service";
import { ConnectorError, connectorFromSlug, connectorMessage } from "@/lib/connectors/types";
import { SOURCE_ROLES, type SourceRole } from "@/lib/workspace/source-mapping";

export const dynamic = "force-dynamic";

/**
 * Imports ONE selected item and streams its real steps as NDJSON:
 *   {"stage":"READING"} → {"stage":"SAVING"} → {"result":{…}}
 * The browser calls this once per selected item, so "Importing 2 of 3" is observed,
 * never estimated. Same checks as every other write: same-origin, signed-in session,
 * the form's organization scope, business-write role, Demo guard (inside importItem).
 * Saves a Source / Evidence snapshot only; nothing is confirmed as Knowledge.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin refused." }, { status: 403 });
  const connector = connectorFromSlug((await params).provider);
  let body: { slug?: unknown; reference?: unknown; role?: unknown; site?: unknown; includeComments?: unknown; scopeWorkspaceId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "The import request could not be read." }, { status: 400 }); }
  const slug = typeof body.slug === "string" ? body.slug : "", reference = typeof body.reference === "string" ? body.reference : "", role = body.role as SourceRole;
  if (!connector || !slug || !reference || !SOURCE_ROLES.includes(role)) return NextResponse.json({ error: "Choose an item and what this source is for." }, { status: 400 });
  let initiativeId: string;
  try {
    assertWorkspaceScope(body.scopeWorkspaceId, await freshContextForRequest());
    const initiative = await getRepository().getInitiativeBySlug(slug);
    if (!initiative) return NextResponse.json({ error: "This initiative is unavailable in your organization." }, { status: 404 });
    initiativeId = initiative.id;
  } catch (e) {
    const status = e instanceof AccessError && e.code === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: e instanceof AccessError ? e.message : "Your access could not be confirmed. Reload and try again." }, { status });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (x: unknown) => { try { controller.enqueue(encoder.encode(`${JSON.stringify(x)}\n`)); } catch { /* the browser went away; the import itself continues to its end */ } };
      let result: ImportOutcome;
      try {
        result = await importItem({ initiativeId, connector, reference, role, site: typeof body.site === "string" && body.site ? body.site : null, includeComments: body.includeComments === true }, stage => send({ stage }));
      } catch (e) {
        const code = e instanceof ConnectorError ? e.code : null;
        result = { reference, name: reference, ok: false, changed: false, submissionId: null, code, message: code ? null : e instanceof AccessError ? e.message : safeMessage(e, "The item could not be imported.") };
      }
      if (!result.ok && result.code) result = { ...result, message: connectorMessage(result.code, connector) };
      if (result.ok && result.changed) { try { for (const p of [`/initiatives/${slug}/sources`, `/initiatives/${slug}/knowledge/sources`, `/initiatives/${slug}/evidence`, `/initiatives/${slug}/history`, `/initiatives/${slug}`]) revalidatePath(p); } catch { /* pages are dynamic; the browser refreshes them */ } }
      send({ result });
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
}
