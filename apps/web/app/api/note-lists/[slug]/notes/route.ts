import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isReservedListSlug } from "@/lib/reserved-list-slugs";
import { attachSubNoteCounts } from "@/lib/server/sub-note-counts";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  const { slug } = await params;
  const normalized = slug.trim().toLowerCase();
  if (!normalized || isReservedListSlug(normalized)) {
    return NextResponse.json({ error: "Invalid folder slug" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: list, error: listErr } = await supabase
    .from("note_lists")
    .select("id")
    .eq("user_id", user.id)
    .eq("slug", normalized)
    .maybeSingle();

  if (listErr || !list) {
    return NextResponse.json({ notes: [] });
  }

  const { data, error } = await supabase
    .from("notes")
    .select("id, title, is_completed, note_list_id, created_at, parent_id")
    .eq("user_id", user.id)
    .eq("note_list_id", list.id)
    .is("parent_id", null)
    .order("position", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notesWithSubCounts = await attachSubNoteCounts(supabase, user.id, data ?? []);
  return NextResponse.json({ notes: notesWithSubCounts });
}
