import { PRODUCT_HOME } from "@/lib/routes";

/**
 * Allows only safe internal app paths and falls back otherwise.
 */
export function sanitizeInternalNextPath(raw: string | null | undefined, fallback = PRODUCT_HOME) {
  const value = String(raw ?? "").trim();
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes(":")) return fallback;
  return value;
}
