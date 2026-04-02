import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const view = url.searchParams.get("view");
  if (view !== "all" && view !== "today") {
    return NextResponse.json({ error: "Invalid view" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (view === "all") {
    const { data, error } = await supabase
      .from("todos")
      .select("id, title, is_completed, list_id, created_at")
      .eq("user_id", user.id)
      .order("all_position", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ todos: data ?? [] });
  }

  const { data: todayList, error: listErr } = await supabase
    .from("lists")
    .select("id")
    .eq("user_id", user.id)
    .eq("slug", "today")
    .maybeSingle();

  if (listErr || !todayList) {
    return NextResponse.json({ todos: [] });
  }

  const { data, error } = await supabase
    .from("todos")
    .select("id, title, is_completed, list_id, created_at")
    .eq("user_id", user.id)
    .eq("list_id", todayList.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ todos: data ?? [] });
}
