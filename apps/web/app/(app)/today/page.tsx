import type { Metadata } from "next";
import { withSocialImage } from "@/lib/seo-metadata";
import { getCachedAuth } from "@/lib/supabase/cached-auth";
import { attachSubTodoCounts } from "@/lib/server/sub-todo-counts";
import { redirect } from "next/navigation";
import { TodayClient } from "./today-client";

export const metadata: Metadata = withSocialImage({
  title: "Today",
  description: "Your tasks for today.",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const { supabase, user } = await getCachedAuth();

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
    .select("id, title, is_completed, list_id, created_at, parent_id")
    .eq("user_id", user.id)
    .eq("list_id", todayList.id)
    .is("parent_id", null)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  const { data: profile } = await supabase
    .from("profiles")
    .select("show_completed_tasks")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return (
      <main className="mx-auto w-full max-w-2xl pt-6">
        <p className="text-sm text-[color:var(--color-danger)]" role="alert">
          {error.message}
        </p>
      </main>
    );
  }

  const todosWithSubCounts = await attachSubTodoCounts(supabase, user.id, todos ?? []);

  return (
    <main suppressHydrationWarning className="mx-auto w-full max-w-2xl px-4 pt-4 sm:pt-6">
      <h1 className="sr-only">Today</h1>
      <TodayClient
        initialTodos={todosWithSubCounts}
        view="today"
        composerListId={todayList.id}
        initialShowCompleted={profile?.show_completed_tasks ?? true}
        sectionHeaderLabel="Today"
      />
    </main>
  );
}
