import { CONNECTOR_LABEL, REQUIRED_ACCESS, type Connector, type ConnectorErrorCode } from "./types.ts";
import { PROVIDERS } from "./oauth.ts";

/**
 * What a person reads after a connection attempt did not end in a connection.
 * Three plain sentences (what happened · what it means for their data · what
 * to do now) and whether a retry restarts the sign-in. Never a provider body,
 * a token or an error string; the operator line names only our own settings.
 */
export interface ConnectRecovery {
  title: string;
  happened: string;
  next: string;
  /** A retry restarts the OAuth flow from Connections. */
  retry: boolean;
  /** Shown only to the installation's operator (Platform Owner). */
  operator: string | null;
}

export const CONNECT_RESULT_CODES: ConnectorErrorCode[] = ["SCOPE_REFUSED", "NOT_CONNECTED", "INVALID_REQUEST", "NEEDS_RECONNECT", "RATE_LIMITED", "PROVIDER_UNAVAILABLE", "NOT_CONFIGURED", "DEMO_ORGANIZATION", "VIEW_ONLY", "NO_ACCESS", "NOT_FOUND", "UNSUPPORTED"];

const scopeName = (s: string) => s.replace("https://www.googleapis.com/auth/", "");

export function connectRecovery(code: ConnectorErrorCode, connector: Connector): ConnectRecovery {
  const name = CONNECTOR_LABEL[connector];
  const scopes = REQUIRED_ACCESS[connector].map(scopeName).join(", ");
  const env = PROVIDERS[connector].env;
  const unchanged = `Nothing was connected and nothing changed in ${name}.`;
  switch (code) {
    case "SCOPE_REFUSED": return {
      title: `${name} refused the read-only access Prodwise asked for`,
      happened: `${name} ended the sign-in because its app registration does not allow one or more of the requested permissions. ${unchanged}`,
      next: `This is fixed in the ${name} app settings, not in your account. Once the app allows exactly ${scopes}, retry from here. Until then, sources from ${name} can be recorded by reference.`,
      retry: true,
      operator: `In the ${name} developer settings for the app behind ${env.id}, set the permissions to exactly: ${scopes}. Then retry the connection.`,
    };
    case "NOT_CONNECTED": return {
      title: `Access was not granted`,
      happened: `The ${name} sign-in ended without granting access — usually Cancel or Deny on the ${name} screen. ${unchanged}`,
      next: `Retry and approve the read-only access when ${name} asks. You can stop at any point; Prodwise only stores access after ${name} confirms it.`,
      retry: true, operator: null,
    };
    case "INVALID_REQUEST": return {
      title: `The ${name} sign-in did not complete`,
      happened: `The sign-in took longer than ten minutes, was started from another session or browser, or came back with details that did not match this one. ${unchanged}`,
      next: `Start again from here. The whole step takes under a minute.`,
      retry: true, operator: null,
    };
    case "NEEDS_RECONNECT": return {
      title: `${name} did not accept the sign-in code`,
      happened: `${name} approved the sign-in, but the one-time code it returned had expired or was already used before Prodwise could exchange it. ${unchanged}`,
      next: `Retry the sign-in. If it happens again, the ${name} app configuration may be pointing at a different Prodwise address.`,
      retry: true, operator: `Check that the ${name} app’s redirect URL is this installation’s public address followed by /api/connectors/${connector.toLowerCase().replace("_", "-")}/callback.`,
    };
    case "RATE_LIMITED": return {
      title: `${name} asked Prodwise to slow down`,
      happened: `${name} is limiting requests from this installation for a short while. ${unchanged}`,
      next: `Wait a minute, then retry.`,
      retry: true, operator: null,
    };
    case "PROVIDER_UNAVAILABLE": return {
      title: `${name} did not respond`,
      happened: `Prodwise reached ${name} but got no usable answer. ${unchanged}`,
      next: `Try again shortly. If ${name} reports an incident, wait for it to clear.`,
      retry: true, operator: null,
    };
    case "NOT_CONFIGURED": return {
      title: `${name} is not set up for this installation`,
      happened: `The ${name} app credentials are not configured on this Prodwise installation, so there is nothing to sign in to. ${unchanged}`,
      next: `Ask your administrator. Meanwhile, ${name} items can still be recorded as sources by reference.`,
      retry: false, operator: `Register the ${name} app and set ${env.id} and ${env.secret} (see the connector setup guide).`,
    };
    case "DEMO_ORGANIZATION": return {
      title: `Connectors are off in the Demo organization`,
      happened: `The Demo organization holds synthetic data, and real ${name} content must never enter it. ${unchanged}`,
      next: `Switch to your own organization to connect ${name}.`,
      retry: false, operator: null,
    };
    case "VIEW_ONLY": return {
      title: `Your access here is view-only`,
      happened: `Connecting ${name} lets you import evidence, which changes an initiative’s records; a Viewer cannot do that. ${unchanged}`,
      next: `Ask an organization administrator for Member access if you need to import sources.`,
      retry: false, operator: null,
    };
    case "NO_ACCESS":
    case "NOT_FOUND":
    case "UNSUPPORTED": return {
      title: `Prodwise could not read your ${name} profile`,
      happened: `${name} granted access but did not let Prodwise read the account it belongs to, so the connection was not stored. ${unchanged}`,
      next: `Retry. If it repeats, sign in to ${name} in this browser first and check that the account you approved is the one you meant.`,
      retry: true, operator: null,
    };
  }
}
