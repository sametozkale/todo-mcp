import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isReservedListSlug } from "@/lib/reserved-list-slugs";
import { attachSubTodoCounts } from "@/lib/server/sub-todo-counts";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, { params }: Props) {
  const { slug } = await params;
  const normalized = slug.trim().toLowerCase();
  if (!normalized || isReservedListSlug(normalized)) {
    return NextResponse.json({ error: "Invalid list slug" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: list, error: listErr } = await supabase
    .from("lists")
    .select("id")
    .eq("user_id", user.id)
    .eq("slug", normalized)
    .maybeSingle();

  if (listErr || !list) {
    return NextResponse.json({ todos: [] });
  }

  const { data, error } = await supabase
    .from("todos")
    .select("id, title, is_completed, list_id, created_at, parent_id")
    .eq("user_id", user.id)
    .eq("list_id", list.id)
    .is("parent_id", null)
    .order("position", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const todosWithSubCounts = await attachSubTodoCounts(supabase, user.id, data ?? []);
  return NextResponse.json({ todos: todosWithSubCounts });
}
