import { revalidatePath } from "next/cache";

/**
 * Revalidates the shared `(app)` layout and main list routes in one pass — avoids
 * revalidating every `/{slug}` on each todo toggle (major latency win).
 */
export function revalidateAppShell() {
  revalidatePath("/all", "layout");
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

