import { cookies } from "next/headers";

function getServerApiBase(): string {
  const internalUrl = process.env.BACKEND_API_URL || process.env.INTERNAL_API_URL;
  if (internalUrl && internalUrl.startsWith("http")) {
    return internalUrl.replace(/\/$/, "");
  }
  const publicUrl = process.env.NEXT_PUBLIC_API_URL;
  if (publicUrl && publicUrl.startsWith("http")) {
    return publicUrl.replace(/\/$/, "");
  }
  return "http://127.0.0.1:8000/api/v1";
}

/**
 * Server-side API fetch helper for Next.js 15 Server Components.
 * Reads the mirrored `dvt_token` cookie and forwards Bearer auth to FastAPI.
 * Returns null on missing auth, 401/error responses, or unreachable backend so
 * client islands can gracefully handle token refresh or redirects.
 */
export async function serverApiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("dvt_token")?.value;
    if (!token) {
      return null;
    }

    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = `${getServerApiBase()}${normalizedPath}`;
    const headers = new Headers(init.headers);
    headers.set("Authorization", token.startsWith("Bearer ") ? token : `Bearer ${token}`);
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    const res = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as T;
  } catch {
    return null;
  }
}
