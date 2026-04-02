import { revalidatePath } from "next/cache";

/**
 * Revalidates core list views directly (faster and more targeted than layout-level invalidation).
 */
export function revalidateAppShell() {
  revalidatePath("/all");
  revalidatePath("/today");
}

/**
 * After list/todo mutations: refresh app shell + any affected dynamic list pages.
 */
export function revalidateTodoListPaths(listSlugs?: readonly string[]) {
  revalidateAppShell();
  if (listSlugs?.length) {
    const seen = new Set<string>();
    for (const s of listSlugs) {
      const slug = s.trim().toLowerCase();
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      revalidatePath(`/${slug}`);
    }
  }
}

