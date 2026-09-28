/** Which records a URL names. Pure: no data access. */
export interface Lookup { initiative?: string; source?: string; submission?: string; claim?: string; evidence?: string; malformed?: true }

const decode = (part: string) => { try { return decodeURIComponent(part); } catch { return null; } };

export function lookupFor(pathname: string): Lookup | null {
  let m = /^\/initiatives\/([^/]+)(?:\/(.*))?$/.exec(pathname);
  if (m && m[1] !== 'new') {
    const slug = decode(m[1]!), rest = m[2] ?? '';
    if (slug === null) return { malformed: true };
    const sub = /^evidence\/([^/]+)/.exec(rest)?.[1];
    const claim = /^(?:knowledge|memory)\/([^/]+)\/(?:edit|confirm|verify)$/.exec(rest)?.[1];
    const evidence = /^knowledge\/sources\/([^/]+)\/edit$/.exec(rest)?.[1];
    return { initiative: slug, ...(sub && sub !== 'new' ? { submission: sub } : {}), ...(claim && claim !== 'sources' ? { claim } : {}), ...(evidence ? { evidence } : {}) };
  }
  m = /^\/analysis\/projects\/([^/]+)$/.exec(pathname);
  if (m) { const slug = decode(m[1]!); return slug === null ? { malformed: true } : { initiative: slug }; }
  m = /^\/sources\/([^/]+)$/.exec(pathname);
  if (m) return { source: m[1]! };
  return null;
}
