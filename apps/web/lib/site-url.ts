/**
 * Canonical production origin (HTTPS, no trailing slash).
 * Set `NEXT_PUBLIC_SITE_URL` in Vercel/local to match the URL users actually open
 * (e.g. `https://todo-mcp-web.vercel.app` until `yalp.ai` DNS is live).
 */
export const DEFAULT_PUBLIC_SITE_URL = "https://yalp.ai";

/** Public site origin (no trailing slash). Used for metadata, sitemap, JSON-LD, MCP base URLs in the app. */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (raw || DEFAULT_PUBLIC_SITE_URL).replace(/\/+$/, "");
}
