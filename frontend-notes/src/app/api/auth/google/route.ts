import { NextRequest, NextResponse } from 'next/server';
import { STATE_COOKIE, appUrl } from '@/lib/server/notesApi';

export const dynamic = 'force-dynamic';

/** Starts Google sign-in. A random state in a short-lived cookie guards the callback against CSRF. */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'Google sign-in is not configured' }, { status: 500 });
  }

  const stateBytes = new Uint8Array(32);
  crypto.getRandomValues(stateBytes);
  const state = Buffer.from(stateBytes).toString('base64url');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl(request.nextUrl.origin)}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email',
    prompt: 'select_account',
    state,
  });

  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}
