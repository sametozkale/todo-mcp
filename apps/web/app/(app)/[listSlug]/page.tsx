import type { Metadata } from "next";
import { getCachedUserListBySlug } from "@/lib/lists/cached-list-by-slug";
import { notFound } from "next/navigation";
import { TodayClient } from "../today/today-client";

type Props = {
  params: Promise<{ listSlug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { listSlug } = await params;
  const noIndex = { robots: { index: false, follow: false } } as const;
  const { list } = await getCachedUserListBySlug(listSlug);

  if (!list) {
    return { title: "List", ...noIndex };
  }
  return {
    title: list.title,
    description: `Tasks in ${list.title}.`,
    ...noIndex,
  };
}

export default async function UserListPage({ params }: Props) {
  const { listSlug } = await params;
  const { supabase, user, list } = await getCachedUserListBySlug(listSlug);

  if (!user) {
    return null;
  }

  if (!list) {
    notFound();
  }

  const { data: todos, error } = await supabase
    .from("todos")
    .select("id, title, is_completed, list_id, created_at")
    .eq("user_id", user.id)
    .eq("list_id", list.id)
    .order("position", { ascending: true, nullsFirst: true })
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
    <main suppressHydrationWarning className="mx-auto w-full max-w-2xl px-4 pt-4 sm:pt-6">
      <h1 className="sr-only">{list.title}</h1>
      <TodayClient
        initialTodos={todos ?? []}
        view="list"
        composerListId={list.id}
        sectionHeaderLabel={list.title}
      />
    </main>
  );
}
