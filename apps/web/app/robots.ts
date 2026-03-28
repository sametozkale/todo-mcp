import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Indexing strategy: only public marketing + auth routes are meant to rank.
 * Authenticated app routes use noindex via (app)/layout metadata; this file
 * blocks known app paths for well-behaved crawlers.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  const host = base.replace(/^https?:\/\//, "");

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/signup"],
      disallow: [
        "/all",
        "/today",
        "/integrations",
        "/mcp",
        "/subscription",
        "/api/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host,
  };
}
