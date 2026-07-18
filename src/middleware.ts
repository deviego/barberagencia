import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware:
 * - Propaga o host (para resolução de tenant nos Server Components).
 * - Aplica security headers básicos.
 * Guards de papel/entitlement por rota entram junto com o Supabase Auth (M0/M1).
 */
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-host", request.headers.get("host") ?? "");

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ttf|woff2?)$).*)"],
};
