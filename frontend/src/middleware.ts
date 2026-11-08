/**
 * DVT Talent AI — Next.js Auth Middleware
 * Protects /dashboard, /portal, and all workspace sub-routes.
 * Validates JWT presence and expiry before allowing navigation.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/portal", "/candidates", "/campaigns", "/analytics", "/settings"];
const PUBLIC_PATHS = ["/auth/login", "/auth/register", "/auth/callback", "/api"];

function isJwtExpired(rawToken: string): boolean {
  try {
    const clean = rawToken.replace(/^Bearer\s+/i, "");
    const parts = clean.split(".");
    if (parts.length !== 3) return false;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    const payload = JSON.parse(json);
    if (typeof payload.exp === "number") {
      return payload.exp * 1000 < Date.now();
    }
    return false;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get("dvt_token")?.value;
  const hasRefreshCookie = Boolean(request.cookies.get("dvt_refresh_token")?.value);

  if (!token || (isJwtExpired(token) && !hasRefreshCookie)) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    if (pathname.startsWith("/portal")) {
      loginUrl.searchParams.set("portal", "candidate");
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
