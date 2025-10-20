import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  const { pathname } = request.nextUrl;

  // Allow these routes without authentication
  const publicRoutes = ["/login", "/api/auth/callback", "/.auth"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // For local development, allow access without token if ALLOW_UNAUTHENTICATED is set
  const isDevelopment = process.env.NODE_ENV === "development" && 
                        process.env.NEXT_PUBLIC_ALLOW_UNAUTHENTICATED === "true";

  // If no token and trying to access protected route, redirect to login
  if (!token && !isDevelopment && !pathname.startsWith("/_next") && !pathname.startsWith("/public")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
