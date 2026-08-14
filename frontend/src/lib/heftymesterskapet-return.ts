/**
 * Return-target handling for the Heftymesterskapet login round trip.
 *
 * The scoring page is served from the backend origin, so signing in means leaving that origin for
 * the frontend's Google flow and coming back afterwards with a handoff code. An unvalidated return
 * parameter would turn this login into an open redirect that forwards handoff codes to whatever
 * origin an attacker names, so the destination is checked against the backend origin here and
 * nowhere else.
 */

/** Cookie carrying the return intent across the OAuth round trip. */
export const RETURN_COOKIE = "heftymesterskapet_return";

/** Query parameter used to request a return to the scoring page. */
export const RETURN_PARAM = "heftyReturn";

/**
 * The backend origin, which is the only place a return target may point. Reads the same
 * configuration the rest of the app uses to reach the API.
 */
function backendOrigin(): string | null {
  const raw =
    process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? null;
  if (!raw) return null;

  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * Returns the absolute URL to return to, or null if the candidate is missing or not allowed.
 *
 * Only the exact scoring page on the backend origin is accepted. Comparing parsed origins (rather
 * than matching a prefix) is deliberate: `https://backend.example.com.evil.test` starts with the
 * expected string but is a different origin.
 */
export function resolveReturnTarget(candidate: string | null): string | null {
  if (!candidate) return null;

  const origin = backendOrigin();
  if (!origin) return null;

  let url: URL;
  try {
    url = new URL(candidate, origin);
  } catch {
    return null;
  }

  if (url.origin !== origin) return null;
  if (url.pathname !== "/heftymesterskapet.html") return null;

  // Rebuild from parts rather than echoing the input, so nothing else in the candidate
  // (query, fragment, credentials) survives into the redirect.
  return `${url.origin}${url.pathname}`;
}
