import type { Metadata } from "next";
import { withSocialImage } from "@/lib/seo-metadata";
import { isReservedListSlug } from "@/lib/reserved-list-slugs";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { NoteDetailClient, type NoteDetailParent } from "../note-detail-client";

type Props = {
  params: Promise<{ noteId: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const noIndex = { robots: { index: false, follow: false } } as const;
  return withSocialImage({
    title: "Note",
    description: "Note details.",
    ...noIndex,
  });
}

function resolveBackHrefFromSource(rawFrom: string | string[] | undefined): string | null {
  if (typeof rawFrom !== "string") return null;
  if (!/^\/notes\/[a-z0-9-]+$/i.test(rawFrom)) return null;
  const rest = rawFrom.slice("/notes/".length).toLowerCase();
  if (!rest) return null;
  if (rest === "all") return rawFrom;
  if (rest === "today") return "/notes/all";
  if (isReservedListSlug(rest)) return null;
  return rawFrom;
}

export default async function NoteDetailPage({ params, searchParams }: Props) {
  const { noteId } = await params;
  const { from } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: parentRow, error: parentErr } = await supabase
    .from("notes")
    .select("id, title, description, note_list_id, parent_id")
    .eq("id", noteId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (parentErr || !parentRow || parentRow.parent_id) {
    notFound();
  }

  const parent: NoteDetailParent = {
    id: parentRow.id,
    title: parentRow.title,
    note_list_id: parentRow.note_list_id,
    description: parentRow.description,
  };

  const fromBackHref = resolveBackHrefFromSource(from);
  let backHref = fromBackHref ?? "/notes/all";
  if (!fromBackHref && parent.note_list_id) {
    const { data: listRow } = await supabase
      .from("note_lists")
      .select("slug")
      .eq("id", parent.note_list_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (listRow?.slug) {
      backHref = `/notes/${listRow.slug}`;
    }
  }

  return (
    <main suppressHydrationWarning className="mx-auto w-full max-w-2xl px-4 pt-4 sm:pt-6">
      <h1 className="sr-only">Note details</h1>
      <NoteDetailClient backHref={backHref} initialParent={parent} />
    </main>
  );
}
