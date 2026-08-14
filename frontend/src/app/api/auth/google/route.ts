import { NextRequest, NextResponse } from "next/server";
import {
  RETURN_COOKIE,
  RETURN_PARAM,
  resolveReturnTarget,
} from "@/lib/heftymesterskapet-return";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Google OAuth is not configured" },
      { status: 500 }
    );
  }

  // Derive the base URL from the incoming request so it works on any host
  const baseUrl =
    process.env.NEXTAUTH_URL ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  // Generate a cryptographically random state to prevent CSRF in the OAuth callback
  const stateBytes = new Uint8Array(32);
  crypto.getRandomValues(stateBytes);
  const state = Buffer.from(stateBytes).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state,
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );

  // Store state in a short-lived HttpOnly cookie for validation in the callback
  response.cookies.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });

  // Carry the Heftymesterskapet return intent across the round trip in a cookie rather than in the
  // OAuth state parameter, so the destination never travels via Google. Validated on the way in so
  // an unusable target is dropped here instead of at the callback.
  const returnTarget = resolveReturnTarget(
    request.nextUrl.searchParams.get(RETURN_PARAM)
  );
  if (returnTarget) {
    response.cookies.set(RETURN_COOKIE, returnTarget, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes, same as the state cookie
      path: "/",
    });
  }

  return response;
}
