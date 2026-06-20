import { revalidatePath } from "next/cache";

export function revalidateNoteAppShell() {
  revalidatePath("/notes/all");
}

export function revalidateNoteListPaths(listSlugs?: readonly string[]) {
  revalidateNoteAppShell();
  if (listSlugs?.length) {
    const seen = new Set<string>();
    for (const s of listSlugs) {
      const slug = s.trim().toLowerCase();
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      revalidatePath(`/notes/${slug}`);
    }
  }
}

export function revalidateNoteDetailPaths(noteId: string, parentNoteId?: string | null) {
  revalidatePath(`/note/${noteId}`);
  if (parentNoteId) {
    revalidatePath(`/note/${parentNoteId}`);
  }
}
