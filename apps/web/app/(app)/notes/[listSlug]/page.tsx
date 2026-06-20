import type { Metadata } from "next";
import { withSocialImage } from "@/lib/seo-metadata";
import { getCachedUserNoteListBySlug } from "@/lib/note-lists/cached-note-list-by-slug";
import { notFound, redirect } from "next/navigation";
import { NotesClient } from "../notes-client";

type Props = {
  params: Promise<{ listSlug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { listSlug } = await params;
  const noIndex = { robots: { index: false, follow: false } } as const;
  return withSocialImage({
    title: listSlug === "today" ? "Today" : "Notes",
    description: "Notes in your folder.",
    ...noIndex,
  });
}

export default async function UserNoteListPage({ params }: Props) {
  const { listSlug } = await params;
  if (listSlug.toLowerCase() === "today") {
    redirect("/notes/all");
  }
  const { supabase, user, list } = await getCachedUserNoteListBySlug(listSlug);

  if (!user) {
    return null;
  }

  if (!list) {
    notFound();
  }

  const { data: notes, error } = await supabase
    .from("notes")
    .select("id, title, is_completed, note_list_id, created_at, parent_id")
    .eq("user_id", user.id)
    .eq("note_list_id", list.id)
    .is("parent_id", null)
    .order("position", { ascending: true, nullsFirst: true })
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
      <h1 className="sr-only">{list.title}</h1>
      <NotesClient
        initialNotes={notes ?? []}
        view="list"
        composerNoteListId={list.id}
        sectionHeaderLabel={list.title}
      />
    </main>
  );
}
