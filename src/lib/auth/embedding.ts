/**
 * Framing detection for the public entry pages.
 *
 * The session cookie is SameSite=Lax (see service.ts). Inside a frame owned by
 * another site a browser neither stores nor sends it, so signing in or starting
 * the demo there "succeeds" for one response and then every navigation returns
 * to Sign in. These pages therefore offer a top-level tab instead of the forms.
 *
 * The check is by origin, the strictest reading a document can make without a
 * public-suffix list: a same-site but cross-origin host also sees the notice,
 * which costs that embedder one extra click rather than a broken session.
 */
export interface FrameView {
  /** `window.self` */ self: unknown;
  /** `window.top`, null when the browsing context has been discarded */ top: unknown;
  /** The document's own origin. */ origin: string;
  /** Reads the top window's origin; throws for a cross-origin ancestor. */ readTopOrigin: () => string;
}

export function isCrossOriginEmbedded(view: FrameView): boolean {
  if (view.top === null || view.top === undefined || view.self === view.top) return false;
  try { return view.readTopOrigin() !== view.origin; }
  catch { return true; } // A cross-origin ancestor denies access to its location.
}

export function frameViewOf(w: Window): FrameView {
  return { self: w.self, top: w.top, origin: w.location.origin, readTopOrigin: () => (w.top as Window).location.origin };
}

/** The same page, same origin, for a top-level tab: path and query only, so `returnTo` survives and no host can be injected. */
export function standaloneHref(location: { pathname: string; search: string }): string {
  return `${location.pathname}${location.search}`;
}
