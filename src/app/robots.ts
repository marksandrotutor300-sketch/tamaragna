import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/account", "/admin/", "/replay/", "/transfer"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
