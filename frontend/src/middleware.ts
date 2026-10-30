/**
 * DVT Talent AI — Next.js Auth Middleware
 * Protects /dashboard and all sub-routes.
 * Redirects to /auth/login if no valid access token is found.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/candidates", "/campaigns", "/analytics", "/settings"];
const PUBLIC_PATHS = ["/auth/login", "/auth/register", "/api"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow all public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check if this is a protected route
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Look for token in cookies (preferred standard: dvt_token)
  const token = request.cookies.get("dvt_token")?.value;

  if (!token) {
    // 🛡️ SDET: Secure redirection to login for protected assets
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
