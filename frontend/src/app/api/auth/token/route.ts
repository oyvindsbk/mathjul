import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Fake JWT token for local development
const FAKE_DEV_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZXYtdXNlciIsImVtYWlsIjoiZGV2QGV4YW1wbGUuY29tIiwibmFtZSI6IkRldmVsb3BlciJ9.fake-signature";

export async function POST() {
  try {
    // In development with NEXT_PUBLIC_ALLOW_UNAUTHENTICATED, return a fake token
    if (
      process.env.NODE_ENV === "development" &&
      process.env.NEXT_PUBLIC_ALLOW_UNAUTHENTICATED === "true"
    ) {
      return NextResponse.json(
        {
          token: FAKE_DEV_TOKEN,
          user: {
            id: "dev-user",
            email: "dev@example.com",
            name: "Developer",
          },
        },
        {
          status: 200,
          headers: {
            "Set-Cookie": `auth_token=${FAKE_DEV_TOKEN}; Path=/; HttpOnly; SameSite=Strict`,
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
