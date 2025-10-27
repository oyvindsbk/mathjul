import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Fake JWT token for local development
const FAKE_DEV_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZXYtdXNlciIsImVtYWlsIjoiZGV2QGV4YW1wbGUuY29tIiwibmFtZSI6IkRldmVsb3BlciJ9.fake-signature";

export async function POST(request: NextRequest) {
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

    // In production, this endpoint would interact with Azure Static Web Apps
    // For now, return an error since we're not handling production flow
    return NextResponse.json(
      {
        error:
          "Authentication token endpoint - requires Azure Static Web Apps in production",
      },
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
