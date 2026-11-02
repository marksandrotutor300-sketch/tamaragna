import type { NextConfig } from "next";
import { withSerwist } from "@serwist/turbopack";

const isDevelopment = process.env.NODE_ENV !== "production";

function securityHeaders(): Array<{ key: string; value: string }> {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}`,
    "worker-src 'self'",
    "manifest-src 'self'",
  ].join("; ");

  const headers = [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];

  // HSTS only on an actual HTTPS deployment. The local production launcher
  // runs on http://localhost, where it is useless and can cause confusion.
  if (
    process.env.NODE_ENV === "production" &&
    (process.env.TAMARAGNA_HTTPS === "1" || process.env.VERCEL)
  ) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders(),
      },
    ];
  },
};

export default withSerwist(nextConfig);
