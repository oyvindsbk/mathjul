import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // In development, bypass auth entirely when NEXT_PUBLIC_ALLOW_UNAUTHENTICATED is set
  if (process.env.NEXT_PUBLIC_ALLOW_UNAUTHENTICATED === "true") {
    return NextResponse.next();
  }

  const token = request.cookies.get("auth_token")?.value;
  const { pathname } = request.nextUrl;

  // Allow these routes without authentication
  const publicRoutes = ["/login", "/api/auth/callback", "/api/auth/google", "/.auth", "/api/auth/token", "/api/auth/fake-callback", "/api/auth/session", "/robots.txt"];
  // "/delt/<token>" is the share page: the token in the URL is the credential, so
  // it must render without an auth_token cookie. Matched as its own prefix rather
  // than added to publicRoutes, since a bare startsWith("/delt") would silently
  // open any future route whose name merely begins with those letters.
  const isPublicRoute =
    publicRoutes.some((route) => pathname.startsWith(route)) || pathname.startsWith("/delt/");

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // If no token, redirect to login (applies to both dev and production)
  if (!token && !pathname.startsWith("/_next") && !pathname.startsWith("/public")) {
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
