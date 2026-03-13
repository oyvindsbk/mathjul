import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(new URL("/login?error=oauth_denied", request.url));
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth credentials not configured");
    }

    // Derive base URL so it works on any host (dev or prod)
    const baseUrl =
      process.env.NEXTAUTH_URL ??
      `${request.nextUrl.protocol}//${request.nextUrl.host}`;
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

    // Set auth_token cookie and redirect to home page
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
  }
}
