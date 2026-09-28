import { NextResponse, type NextRequest } from 'next/server';
import { contextForCookie, SESSION_COOKIE } from './lib/auth/service';
import { AccessError, safeReturnPath } from './lib/auth/core';
import { canBusinessWrite } from './lib/auth/roles';

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (/^\/(login|invite|signup)(\/|$)/.test(pathname) || pathname.startsWith('/_next/')
      || pathname.startsWith('/assets/') || /^\/(favicon.ico|icon.png|apple-icon.png)$/.test(pathname)) return NextResponse.next();
  try {
    const ctx=await contextForCookie(request.cookies.get(SESSION_COOKIE)?.value);
    if(!canBusinessWrite(ctx)&&(/^\/initiatives\/new\/?$/.test(pathname)||/\/(new|edit|verify|confirm)(\/|$)/.test(pathname))) return NextResponse.redirect(new URL('/account?restricted=viewer',request.url));
    return NextResponse.next();
  }
  catch (error) {
    // The OAuth callback is a browser navigation, not an API call: send a signed-out person to sign in.
    if (/^\/api\/connectors\/[^/]+\/callback$/.test(pathname) && error instanceof AccessError && error.code==='UNAUTHENTICATED') { const login = new URL('/login', request.url); login.searchParams.set('returnTo','/account/connections'); return NextResponse.redirect(login); }
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: error instanceof AccessError ? error.message : 'Workspace access is unavailable.' }, { status: error instanceof AccessError && error.code==='UNAUTHENTICATED' ? 401 : 403, headers: { 'Cache-Control': 'no-store' } });
    const login = new URL('/login', request.url);
    if (error instanceof AccessError && error.code==='UNAUTHENTICATED') login.searchParams.set('returnTo',safeReturnPath(pathname+request.nextUrl.search));
    else login.searchParams.set('access','unavailable');
    return NextResponse.redirect(login);
  }
}
export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
