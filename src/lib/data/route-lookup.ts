/** Which records a URL names. Pure: no data access. */
export interface Lookup { initiative?: string; source?: string; submission?: string; claim?: string }

export function lookupFor(pathname: string): Lookup | null {
  let m = /^\/initiatives\/([^/]+)(?:\/(.*))?$/.exec(pathname);
  if (m && m[1] !== 'new') {
    const slug = decodeURIComponent(m[1]!), rest = m[2] ?? '';
    const sub = /^evidence\/([^/]+)/.exec(rest)?.[1], claim = /^(?:knowledge|memory)\/([^/]+)\/(?:edit|confirm|verify)$/.exec(rest)?.[1];
    return { initiative: slug, ...(sub && sub !== 'new' ? { submission: sub } : {}), ...(claim ? { claim } : {}) };
  }
  m = /^\/analysis\/projects\/([^/]+)$/.exec(pathname);
  if (m) return { initiative: decodeURIComponent(m[1]!) };
  m = /^\/sources\/([^/]+)$/.exec(pathname);
  if (m) return { source: m[1]! };
  return null;
}

