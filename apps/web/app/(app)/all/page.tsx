import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { TodayClient } from "../today/today-client";

export const metadata: Metadata = {
  title: "All",
  description: "All your tasks.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AllPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: todos, error } = await supabase
    .from("todos")
    .select("id, title, is_completed, created_at")
    .eq("user_id", user.id)
    .order("all_position", { ascending: true, nullsFirst: true })
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
    <main className="mx-auto w-full max-w-2xl px-4 pt-4 sm:pt-6">
      <h1 className="sr-only">All</h1>
      <TodayClient
        initialTodos={todos ?? []}
        view="all"
        composerListId={null}
        sectionHeaderLabel={`All ${(todos ?? []).length}`}
      />
    </main>
  );
}
