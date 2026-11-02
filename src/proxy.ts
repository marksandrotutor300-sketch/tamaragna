import { NextResponse, type NextRequest } from "next/server";

/**
 * Cookie-authenticated mutations need a CSRF check. Browsers send Origin on
 * cross-site POSTs; same-origin requests and CLI clients (no Origin) pass.
 */
export function proxy(request: NextRequest): NextResponse {
  const method = request.method.toUpperCase();

  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const origin = request.headers.get("origin");
    if (origin) {
      try {
        if (new URL(origin).host !== request.nextUrl.host) {
          return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
