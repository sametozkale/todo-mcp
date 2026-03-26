import { isReservedListSlug } from "@/lib/reserved-list-slugs";

/**
 * Normalize a list title to a URL-safe slug (lowercase, hyphenated ASCII).
 */
export function slugifyListTitle(title: string): string {
  const raw = title
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return raw.length > 0 ? raw : "list";
}

export function validateListSlugForCreate(slug: string): string | null {
  if (slug.length === 0) {
    return "Enter a list name.";
  }
  if (slug.length > 120) {
    return "List name is too long.";
  }
  if (isReservedListSlug(slug)) {
    return "That name is reserved. Choose a different list name.";
  }
  return null;
}
