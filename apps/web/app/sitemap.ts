import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

/** Public static URLs only — no authenticated or user-specific paths. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();

  const paths = ["", "/login", "/signup"] as const;

  return paths.map((path, i) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: i === 0 ? 1 : 0.8,
  }));
}
