import { NextRequest, NextResponse } from 'next/server';
import { TOKEN_COOKIE, appUrl, cookieOptions, notesApiUrl } from '@/lib/server/notesApi';

export const dynamic = 'force-dynamic';

/** Local development only: signs in as NotesApi's configured dev email. */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const response = await fetch(`${notesApiUrl()}/api/auth/dev-token`, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  const base = appUrl(request.nextUrl.origin);
  if (!response?.ok) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', base), 303);
  }

  const { token } = (await response.json()) as { token: string };
  const redirect = NextResponse.redirect(new URL('/', base), 303);
  redirect.cookies.set(TOKEN_COOKIE, token, cookieOptions);
  return redirect;
}
