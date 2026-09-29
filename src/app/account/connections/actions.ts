"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { beginConnect, disconnect, stateCookieName } from "@/lib/connectors/service";
import { CONNECTOR_SLUG, ConnectorError, connectorFromSlug, connectorMessage } from "@/lib/connectors/types";

export interface ConnectionActionState { error: string | null; message: string | null }

/** Starts OAuth with a short-lived, sealed, HttpOnly state cookie bound to this person and organization. */
export async function connectAction(_previous: ConnectionActionState, form: FormData): Promise<ConnectionActionState> {
  const connector = connectorFromSlug(String(form.get("connector") ?? ""));
  if (!connector) return { error: "Choose a supported source.", message: null };
  let url: string;
  try {
    const started = await beginConnect(connector, String(form.get("returnTo") ?? "/account/connections"));
    // No cookie only in local fixture mode, where there is no provider sign-in to return from.
    if (started.cookie) (await cookies()).set(stateCookieName(connector), started.cookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/connectors", maxAge: 600 });
    url = started.url;
  } catch (e) {
    return { error: e instanceof ConnectorError ? connectorMessage(e.code, connector) : "The connection could not be started. Nothing changed.", message: null };
  }
  redirect(url);
}

export async function disconnectAction(_previous: ConnectionActionState, form: FormData): Promise<ConnectionActionState> {
  const connector = connectorFromSlug(String(form.get("connector") ?? ""));
  if (!connector) return { error: "Choose a supported source.", message: null };
  try { await disconnect(connector); } catch { return { error: "The connection could not be removed. Try again.", message: null }; }
  revalidatePath("/account/connections");
  // The row re-renders as "Not connected", so the confirmation travels with the page, not the button.
  redirect(`/account/connections?disconnected=${CONNECTOR_SLUG[connector]}#connector-${CONNECTOR_SLUG[connector]}`);
}
