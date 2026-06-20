import type { Metadata } from "next";
import { withSocialImage } from "@/lib/seo-metadata";
import { getCachedAuth } from "@/lib/supabase/cached-auth";
import { NotesClient } from "../notes-client";

export const metadata: Metadata = withSocialImage({
  title: "All Notes",
  description: "All your notes.",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

export default async function NotesAllPage() {
  const { supabase, user } = await getCachedAuth();

  if (!user) {
    return null;
  }

  const { data: notes, error } = await supabase
    .from("notes")
    .select("id, title, is_completed, note_list_id, created_at, parent_id")
    .eq("user_id", user.id)
    .is("parent_id", null)
    .order("all_position", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="mx-auto w-full max-w-2xl pt-6">
        <p className="text-sm text-[color:var(--color-danger)]" role="alert">
          {error.message}
        </p>
      </main>
    );
  }

  return (
    <main suppressHydrationWarning className="mx-auto w-full max-w-2xl px-4 pt-4 sm:pt-6">
      <h1 className="sr-only">All Notes</h1>
      <NotesClient
        initialNotes={notes ?? []}
        view="all"
        composerNoteListId={null}
        sectionHeaderLabel={`All ${(notes ?? []).length}`}
      />
    </main>
  );
}
