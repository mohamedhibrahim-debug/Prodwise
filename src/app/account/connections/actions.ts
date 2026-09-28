"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { beginConnect, disconnect, stateCookieName } from "@/lib/connectors/service";
import { ConnectorError, connectorFromSlug, connectorMessage } from "@/lib/connectors/types";

export interface ConnectionActionState { error: string | null; message: string | null }

/** Starts OAuth with a short-lived, sealed, HttpOnly state cookie bound to this person and organization. */
export async function connectAction(_previous: ConnectionActionState, form: FormData): Promise<ConnectionActionState> {
  const connector = connectorFromSlug(String(form.get("connector") ?? ""));
  if (!connector) return { error: "Choose a supported source.", message: null };
  let url: string;
  try {
    const started = await beginConnect(connector, String(form.get("returnTo") ?? "/account/connections"));
    (await cookies()).set(stateCookieName(connector), started.cookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/connectors", maxAge: 600 });
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
  return { error: null, message: "Disconnected. Prodwise deleted its stored access; sources you imported and their snapshots stay." };
}
