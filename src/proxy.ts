import { NextResponse, type NextRequest } from "next/server";
import { isAllowedOrigin } from "@/lib/security/origin";

/**
 * Cookie-authenticated mutations need a CSRF check. Browsers send Origin on
 * cross-site POSTs; same-origin requests and CLI clients (no Origin) pass.
 * Render supplies the public host through x-forwarded-host, while Next can
 * expose an internal host in nextUrl.host, so compare all trusted hosts.
 */
export function proxy(request: NextRequest): NextResponse {
  const method = request.method.toUpperCase();

  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    if (
      !isAllowedOrigin(
        request.headers.get("origin"),
        request.headers,
        request.nextUrl.host,
      )
    ) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
