import 'server-only';

/** Cookie holding the NotesApi JWT. httpOnly: page JavaScript never sees the token. */
export const TOKEN_COOKIE = 'notes_token';
/** Short-lived CSRF state for the Google OAuth round trip. */
export const STATE_COOKIE = 'notes_oauth_state';
export const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // matches the API's token lifetime

/** NotesApi base URL, reachable from this server only (internal ingress in Azure). */
export function notesApiUrl(): string {
  const url = process.env.NOTES_API_URL;
  if (!url) throw new Error('NOTES_API_URL is not configured');
  return url.replace(/\/$/, '');
}

/** The public origin users reach this app on, for OAuth redirects. */
export function appUrl(requestOrigin: string): string {
  return (process.env.APP_URL ?? requestOrigin).replace(/\/$/, '');
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: TOKEN_MAX_AGE_SECONDS,
};
