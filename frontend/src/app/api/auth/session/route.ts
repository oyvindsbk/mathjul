import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  return NextResponse.json({ token: token ?? null });
}
