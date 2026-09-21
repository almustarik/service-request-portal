import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE } from '@/lib/auth/session';

/**
 * A fast redirect for the common cases, not an authorization check: it only
 * looks for the presence of a session cookie. Signature and expiry are verified
 * server-side in the protected layout and in every route handler, so forging
 * this cookie gets a visitor a redirect, never data.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasCookie = request.cookies.has(SESSION_COOKIE);

  if (!hasCookie && pathname !== '/login') {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  if (hasCookie && pathname === '/login') {
    return NextResponse.redirect(new URL('/requests', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/requests/:path*', '/performance/:path*'],
};
