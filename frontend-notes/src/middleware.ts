import { NextRequest, NextResponse } from 'next/server';

// Kept in sync with TOKEN_COOKIE in lib/server/notesApi.ts (middleware can't import server-only code).
const TOKEN_COOKIE = 'notes_token';

/** Pages need a session cookie; the API proxy authorizes itself (cookie or Authorization header). */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === '/login' || pathname.startsWith('/api/auth/') || pathname.startsWith('/api/proxy/');

  if (isPublic || request.cookies.has(TOKEN_COOKIE)) {
    return NextResponse.next();
  }
  // APP_URL is the public origin; behind a proxy request.url can carry an internal host/port.
  return NextResponse.redirect(new URL('/login', process.env.APP_URL ?? request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
