function forwardedOrigin(request: Request): string {
  const headers = request.headers;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const proto =
    headers.get("x-forwarded-proto") ??
    new URL(request.url).protocol.replace(":", "");

  if (!host) return new URL(request.url).origin;
  const first = host.split(",")[0]?.trim() ?? host;
  return `${proto}://${first}`;
}

/**
 * Public origin for links and redirects. Prefers the configured site URL; other
 * wise uses the proxy-forwarded host, because behind Render/TLS Next sees the
 * container's internal address (localhost:10000) in request.url.
 */
export function siteUrl(request?: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (request) return forwardedOrigin(request);
  return "http://localhost:3000";
}

/** Absolute redirect target that survives a TLS-terminating proxy. */
export function redirectUrl(request: Request, path: string): URL {
  return new URL(path, siteUrl(request));
}
