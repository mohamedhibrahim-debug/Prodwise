import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { finishConnect, stateCookieName } from "@/lib/connectors/service";
import { ConnectorError, connectorFromSlug, CONNECTOR_SLUG } from "@/lib/connectors/types";

export const dynamic = "force-dynamic";

/**
 * OAuth redirect target. Provider error text, codes and tokens never reach the
 * browser or logs: the person lands back on Connections with a result code.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const connector = connectorFromSlug((await params).provider);
  const back = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin), { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  if (!connector) return back("/account/connections?result=INVALID_REQUEST");
  const store = await cookies(), name = stateCookieName(connector), cookie = store.get(name)?.value;
  store.delete({ name, path: "/api/connectors" });
  try {
    const returnTo = await finishConnect(connector, request.nextUrl.searchParams, cookie);
    const target = new URL(returnTo, request.nextUrl.origin); target.searchParams.set("connected", CONNECTOR_SLUG[connector]);
    return back(`${target.pathname}${target.search}`);
  } catch (e) {
    const code = e instanceof ConnectorError ? e.code : "PROVIDER_UNAVAILABLE";
    if (!(e instanceof ConnectorError)) console.error("connector_callback_failed", { connector, kind: e instanceof Error ? e.name : "unknown" });
    return back(`/account/connections?connector=${CONNECTOR_SLUG[connector]}&result=${code}`);
  }
}
