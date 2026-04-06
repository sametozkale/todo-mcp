/**
 * Canonical production origin (HTTPS, no trailing slash).
 * Set `NEXT_PUBLIC_SITE_URL` in Vercel/local to match the URL users actually open
 * (production: `https://www.yalp.work`).
 */
export const DEFAULT_PUBLIC_SITE_URL = "https://www.yalp.work";

/** Public site origin (no trailing slash). Used for metadata, sitemap, JSON-LD, MCP base URLs in the app. */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  let s = (raw || DEFAULT_PUBLIC_SITE_URL).replace(/\/+$/, "");
  if (!s) return DEFAULT_PUBLIC_SITE_URL;

  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }

  try {
    return new URL(s).origin;
  } catch {
    return DEFAULT_PUBLIC_SITE_URL;
  }
}
