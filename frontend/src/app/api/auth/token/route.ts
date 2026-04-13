import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    if (
      process.env.NODE_ENV === "development" &&
      process.env.NEXT_PUBLIC_ALLOW_UNAUTHENTICATED === "true"
    ) {
      // Fetch a real signed JWT from the backend dev-token endpoint
      const apiBase =
        process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5238";
      const backendRes = await fetch(`${apiBase}/api/auth/dev-token`, {
        method: "POST",
      });

      if (!backendRes.ok) {
        return NextResponse.json(
          { error: "Backend dev-token endpoint failed" },
          { status: 502 }
        );
      }

      const { token, email } = (await backendRes.json()) as {
        token: string;
        email: string;
      };

      return NextResponse.json(
        {
          token,
          user: { id: "dev-user", email, name: "Developer" },
        },
        {
          status: 200,
          headers: {
            "Set-Cookie": `auth_token=${token}; Path=/; HttpOnly; SameSite=Strict`,
          },
        }
      );
    }

    // In production, authentication uses Google OAuth via /api/auth/google-token
    return NextResponse.json(
      { error: "Fake login only available in development" },
      { status: 401 }
    );
  } catch (error) {
    console.error("Token endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
