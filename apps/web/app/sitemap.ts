import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

/** Public static URLs only — no authenticated or user-specific paths. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();

  const routes = [
    { path: "", changeFrequency: "daily" as const, priority: 1 },
    { path: "/why-i-built", changeFrequency: "weekly" as const, priority: 0.8 },
    { path: "/roadmap", changeFrequency: "weekly" as const, priority: 0.8 },
    { path: "/changelog", changeFrequency: "weekly" as const, priority: 0.75 },
    { path: "/students", changeFrequency: "monthly" as const, priority: 0.75 },
    { path: "/privacy", changeFrequency: "yearly" as const, priority: 0.5 },
    { path: "/terms", changeFrequency: "yearly" as const, priority: 0.5 },
    { path: "/login", changeFrequency: "monthly" as const, priority: 0.6 },
    { path: "/signup", changeFrequency: "monthly" as const, priority: 0.7 },
  ];

  return routes.map((route) => ({
    url: `${base}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
