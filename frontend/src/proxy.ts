/**
 * DVT Talent AI — Next.js Proxy (Auth Guard)
 * Protects /dashboard, /portal, and all workspace sub-routes.
 * Validates JWT presence and expiry before allowing navigation.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/portal", "/candidates", "/campaigns", "/analytics", "/settings"];
const PUBLIC_PATHS = ["/auth/login", "/auth/register", "/auth/callback", "/auth/reset-password", "/auth/link-oauth", "/api"];

function parseJwtPayload(rawToken: string): Record<string, any> | null {
  try {
    const clean = rawToken.replace(/^Bearer\s+/i, "");
    const parts = clean.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isJwtExpired(rawToken: string): boolean {
  const payload = parseJwtPayload(rawToken);
  if (!payload || typeof payload.exp !== "number") {
    return true;
  }
  return payload.exp * 1000 < Date.now();
}

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const token = request.cookies.get("dvt_token")?.value;

  if (pathname === "/auth/login" || pathname === "/auth/register") {
    if (token && !isJwtExpired(token)) {
      const payload = parseJwtPayload(token);
      const fromParam = searchParams.get("from");
      const safeFrom =
        fromParam && fromParam.startsWith("/") && !fromParam.startsWith("//") ? fromParam : null;
      const defaultDest = payload?.is_superadmin
        ? "/dashboard/monitoring"
        : payload?.role === "candidate"
          ? "/portal"
          : "/dashboard";
      return NextResponse.redirect(new URL(safeFrom || defaultDest, request.url));
    }
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const hasRefreshCookie = Boolean(request.cookies.get("dvt_refresh_token")?.value);

  if (!token || (isJwtExpired(token) && !hasRefreshCookie)) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    if (pathname.startsWith("/portal")) {
      loginUrl.searchParams.set("portal", "candidate");
    }
    return NextResponse.redirect(loginUrl);
  }

  if (token && !pathname.startsWith("/portal")) {
    const payload = parseJwtPayload(token);
    const role = String(payload?.role || "").toLowerCase();
    const isSuperadmin = Boolean(payload?.is_superadmin);
    if (role === "candidate") {
      return NextResponse.redirect(new URL("/portal", request.url));
    }
    if (pathname.startsWith("/dashboard/monitoring") && !isSuperadmin) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (pathname.startsWith("/dashboard/team") && role !== "admin" && role !== "manager") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
