import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { TodayClient } from "../today/today-client";

type Props = {
  params: Promise<{ listSlug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { listSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { title: "List — Flowdo" };
  }
  const { data: list } = await supabase
    .from("lists")
    .select("title")
    .eq("user_id", user.id)
    .eq("slug", listSlug.toLowerCase())
    .maybeSingle();

  if (!list) {
    return { title: "List — Flowdo" };
  }
  return {
    title: `${list.title} — Flowdo`,
    description: `Tasks in ${list.title}.`,
  };
}

export default async function UserListPage({ params }: Props) {
  const { listSlug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const slug = listSlug.toLowerCase();

  const { data: list, error: listErr } = await supabase
    .from("lists")
    .select("id, title, slug")
    .eq("user_id", user.id)
    .eq("slug", slug)
    .maybeSingle();

  if (listErr || !list) {
    notFound();
  }

  const { data: todos, error } = await supabase
    .from("todos")
    .select("id, title, is_completed, created_at")
    .eq("user_id", user.id)
    .eq("list_id", list.id)
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
    <main className="mx-auto w-full max-w-2xl px-4 pb-32 pt-4 sm:pt-6">
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
