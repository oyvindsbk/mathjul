import { NextRequest, NextResponse } from "next/server";
import {
  RETURN_COOKIE,
  resolveReturnTarget,
} from "@/lib/heftymesterskapet-return";

export const dynamic = "force-dynamic";

/**
 * Trades the freshly minted JWT for a single-use handoff code and appends it to the return URL.
 *
 * The scoring page lives on the backend origin and cannot read the cookie set below, so the token
 * has to cross origins. It crosses as a short-lived, single-use code rather than as the JWT
 * itself, because redirect URLs end up in browser history, server logs, and Referer headers.
 *
 * If the exchange fails the editor is still returned to the page — it will simply render read-only
 * and offer the login again, which beats stranding them on an error screen.
 */
async function buildHeftyReturnUrl(
  apiUrl: string,
  returnTarget: string,
  token: string
): Promise<URL> {
  const url = new URL(returnTarget);

  try {
    const handoffResponse = await fetch(
      `${apiUrl}/api/heftymesterskapet/handoff`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }
    );

    if (handoffResponse.ok) {
      const { code } = (await handoffResponse.json()) as { code?: string };
      if (code) {
        url.searchParams.set("code", code);
      }
    } else if (handoffResponse.status === 403) {
      // Signed in, but not on the editor list. Tell the page so it can say so.
      url.searchParams.set("notEditor", "1");
    }
  } catch (err) {
    console.error("Heftymesterskapet handoff failed:", err);
  }

  return url;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const stateParam = searchParams.get("state");

  // Derive base URL early — needed for all redirects so we never redirect to 0.0.0.0
  const baseUrl =
    process.env.NEXTAUTH_URL ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;

  if (error || !code) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(new URL("/login?error=oauth_denied", baseUrl));
  }

  // Validate CSRF state: must match the cookie set during the initiation step
  const storedState = request.cookies.get("oauth_state")?.value;
  if (!stateParam || !storedState || stateParam !== storedState) {
    console.error("OAuth state mismatch — possible CSRF attempt");
    return NextResponse.redirect(new URL("/login?error=auth_failed", baseUrl));
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth credentials not configured");
    }
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    // Exchange authorisation code for tokens (server-side — client_secret stays secret)
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      throw new Error(`Google code exchange failed (${tokenResponse.status}): ${body}`);
    }

    const { id_token: idToken } = (await tokenResponse.json()) as {
      id_token: string;
    };

    if (!idToken) {
      throw new Error("No id_token in Google token response");
    }

    // Send id_token to backend — backend verifies with Google and returns our app JWT
    const apiUrl =
      process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiUrl) {
      throw new Error("Backend API URL not configured");
    }

    const backendResponse = await fetch(`${apiUrl}/api/auth/google-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (!backendResponse.ok) {
      const body = await backendResponse.text();
      throw new Error(`Backend token request failed (${backendResponse.status}): ${body}`);
    }

    const { token } = (await backendResponse.json()) as { token: string };

    if (!token) {
      throw new Error("No token in backend response");
    }

    // If this login started from the Heftymesterskapet page, send the editor back there with a
    // single-use handoff code instead of landing them on the recipe home page.
    const returnTarget = resolveReturnTarget(
      request.cookies.get(RETURN_COOKIE)?.value ?? null
    );
    const destination = returnTarget
      ? await buildHeftyReturnUrl(apiUrl, returnTarget, token)
      : new URL("/", baseUrl);

    const response = NextResponse.redirect(destination);
    if (returnTarget) {
      response.cookies.delete(RETURN_COOKIE);
    }
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    // Clear the one-time CSRF state cookie
    response.cookies.delete("oauth_state");

    return response;
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(new URL("/login?error=auth_failed", baseUrl));
  }
}
