import type { Metadata } from "next";
import { withSocialImage } from "@/lib/seo-metadata";
import { getCachedAuth } from "@/lib/supabase/cached-auth";
import { TodayClient } from "../today/today-client";

export const metadata: Metadata = withSocialImage({
  title: "All",
  description: "All your tasks.",
  robots: { index: false, follow: false },
});

export const dynamic = "force-dynamic";

export default async function AllPage() {
  const { supabase, user } = await getCachedAuth();

  if (!user) {
    return null;
  }

  const { data: todos, error } = await supabase
    .from("todos")
    .select("id, title, is_completed, list_id, created_at")
    .eq("user_id", user.id)
    .order("all_position", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

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

  return (
    <main suppressHydrationWarning className="mx-auto w-full max-w-2xl px-4 pt-4 sm:pt-6">
      <h1 className="sr-only">All</h1>
      <TodayClient
        initialTodos={todos ?? []}
        view="all"
        composerListId={null}
        initialShowCompleted={profile?.show_completed_tasks ?? true}
        sectionHeaderLabel={`All ${(todos ?? []).length}`}
      />
    </main>
  );
}
