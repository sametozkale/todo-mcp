import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { attachSubNoteCounts } from "@/lib/server/sub-note-counts";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const view = url.searchParams.get("view");
  if (view !== "all") {
    return NextResponse.json({ error: "Invalid view" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("notes")
    .select("id, title, is_completed, note_list_id, created_at, parent_id")
    .eq("user_id", user.id)
    .is("parent_id", null)
    .order("all_position", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notesWithSubCounts = await attachSubNoteCounts(supabase, user.id, data ?? []);
  return NextResponse.json({ notes: notesWithSubCounts });
}
