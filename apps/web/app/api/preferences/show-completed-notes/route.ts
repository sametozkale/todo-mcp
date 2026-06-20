import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { showCompleted?: boolean };
  try {
    body = (await request.json()) as { showCompleted?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.showCompleted !== "boolean") {
    return NextResponse.json({ error: "showCompleted must be a boolean" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ show_completed_notes: body.showCompleted })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
