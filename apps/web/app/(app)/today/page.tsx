import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TodayClient } from "./today-client";

export const metadata: Metadata = {
  title: "Today — Yalp",
  description: "Your tasks for today.",
};

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: todayList, error: listErr } = await supabase
    .from("lists")
    .select("id, slug")
    .eq("user_id", user.id)
    .eq("slug", "today")
    .maybeSingle();

  if (listErr || !todayList) {
    redirect("/all");
  }

  const { data: todos, error } = await supabase
    .from("todos")
    .select("id, title, is_completed, created_at")
    .eq("user_id", user.id)
    .eq("list_id", todayList.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

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
    <main className="mx-auto w-full max-w-2xl px-4 pt-4 sm:pt-6">
      <h1 className="sr-only">Today</h1>
      <TodayClient
        initialTodos={todos ?? []}
        view="today"
        composerListId={todayList.id}
        sectionHeaderLabel="Today"
      />
    </main>
  );
}
