export function siteUrl(request?: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (request) return new URL(request.url).origin;
  return "http://localhost:3000";
}
