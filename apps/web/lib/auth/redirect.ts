import { PRODUCT_HOME } from "@/lib/routes";

/**
 * Allows only safe internal app paths and falls back otherwise.
 */
export function sanitizeInternalNextPath(raw: string | null | undefined, fallback = PRODUCT_HOME) {
  const value = String(raw ?? "").trim();
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  const q = value.indexOf("?");
  const pathname = q === -1 ? value : value.slice(0, q);
  if (pathname.includes(":")) return fallback;
  /** Allow `:` only in query (e.g. redirect_uri=https://...) for OAuth return paths. */
  if (value.includes(":") && !pathname.startsWith("/oauth/")) return fallback;
  return value;
}
