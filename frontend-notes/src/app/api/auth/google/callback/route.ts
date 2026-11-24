import { NextRequest, NextResponse } from 'next/server';
import {
  STATE_COOKIE,
  TOKEN_COOKIE,
  appUrl,
  cookieOptions,
  notesApiUrl,
} from '@/lib/server/notesApi';

export const dynamic = 'force-dynamic';

/** Exchanges the Google code for an id_token, then for a NotesApi token (allowlisted emails only). */
export async function GET(request: NextRequest) {
  const base = appUrl(request.nextUrl.origin);
  const fail = (error: string) => {
    const response = NextResponse.redirect(new URL(`/login?error=${error}`, base));
    response.cookies.delete(STATE_COOKIE);
    return response;
  };

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const storedState = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !storedState || state !== storedState) {
    return fail('auth_failed');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail('auth_failed');

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${base}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResponse.ok) return fail('auth_failed');
    const { id_token: idToken } = (await tokenResponse.json()) as { id_token?: string };
    if (!idToken) return fail('auth_failed');

    const apiResponse = await fetch(`${notesApiUrl()}/api/auth/google-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (apiResponse.status === 403) return fail('not_allowed');
    if (!apiResponse.ok) return fail('auth_failed');
    const { token } = (await apiResponse.json()) as { token: string };

    const response = NextResponse.redirect(new URL('/', base));
    response.cookies.set(TOKEN_COOKIE, token, cookieOptions);
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (error) {
    console.error('Google sign-in failed', error);
    return fail('auth_failed');
  }
}
