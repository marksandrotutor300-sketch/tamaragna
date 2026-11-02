const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

function normalizeHost(value: string | null | undefined): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  if (!first) return null;
  try {
    return new URL(`http://${first}`).host.toLowerCase();
  } catch {
    return null;
  }
}

function configuredHost(siteUrl: string | undefined): string | null {
  if (!siteUrl) return null;
  try {
    return new URL(siteUrl).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * CSRF origin check that works behind a TLS-terminating proxy.
 *
 * Render forwards the public host in `x-forwarded-host`; Next may expose an
 * internal host in `nextUrl.host`. Accept the configured public URL, the
 * forwarded host, the Host header and the Next URL host. A request without an
 * Origin header (CLI/native clients) still passes; browsers send Origin on
 * cross-site mutations.
 */
export function trustedOrigins(
  headers: Headers,
  nextUrlHost: string,
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL,
): Set<string> {
  const hosts = new Set<string>();
  for (const candidate of [
    normalizeHost(headers.get("x-forwarded-host")),
    normalizeHost(headers.get("host")),
    normalizeHost(nextUrlHost),
    configuredHost(siteUrl),
  ]) {
    if (candidate) hosts.add(candidate);
  }
  return hosts;
}

export function isAllowedOrigin(
  origin: string | null,
  headers: Headers,
  nextUrlHost: string,
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL,
): boolean {
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }

  const allowed = trustedOrigins(headers, nextUrlHost, siteUrl);
  if (allowed.has(originHost)) return true;

  // Some local proxies preserve only the loopback host without the port.
  const originBase = originHost.split(":")[0] ?? "";
  if (LOOPBACK_HOSTS.has(originBase)) {
    return [...allowed].some((host) => host.split(":")[0] === originBase);
  }

  return false;
}
