import type { Metadata } from "next";
import { withSocialImage } from "@/lib/seo-metadata";
import { isReservedListSlug } from "@/lib/reserved-list-slugs";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { TodoDetailClient, type TodoDetailParent } from "../todo-detail-client";
import type { TodoRow } from "@/app/(app)/today/todo-row";

type Props = {
  params: Promise<{ todoId: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const noIndex = { robots: { index: false, follow: false } } as const;
  return withSocialImage({
    title: "Task",
    description: "Task details.",
    ...noIndex,
  });
}

function resolveBackHrefFromSource(rawFrom: string | string[] | undefined): string | null {
  if (typeof rawFrom !== "string") return null;
  // Allow only root-level list routes like "/today", "/all", "/my-list"
  if (!/^\/[a-z0-9-]+$/i.test(rawFrom)) return null;
  const slug = rawFrom.slice(1).toLowerCase();
  if (!slug) return null;
  if (slug === "all" || slug === "today") return rawFrom;
  if (isReservedListSlug(slug)) return null;
  return rawFrom;
}

export default async function TodoDetailPage({ params, searchParams }: Props) {
  const { todoId } = await params;
  const { from } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: parentRow, error: parentErr } = await supabase
    .from("todos")
    .select("id, title, is_completed, list_id, parent_id")
    .eq("id", todoId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (parentErr || !parentRow || parentRow.parent_id) {
    notFound();
  }

  const parent: TodoDetailParent = {
    id: parentRow.id,
    title: parentRow.title,
    is_completed: parentRow.is_completed,
    list_id: parentRow.list_id,
  };

  const { data: subRows, error: subErr } = await supabase
    .from("todos")
    .select("id, title, is_completed, list_id, parent_id")
    .eq("user_id", user.id)
    .eq("parent_id", parent.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (subErr) {
    return (
      <main className="mx-auto w-full max-w-2xl pt-6">
        <p className="text-sm text-[color:var(--color-danger)]" role="alert">
          {subErr.message}
        </p>
      </main>
    );
  }

  const fromBackHref = resolveBackHrefFromSource(from);
  let backHref = fromBackHref ?? "/all";
  if (!fromBackHref && parent.list_id) {
    const { data: listRow } = await supabase
      .from("lists")
      .select("slug")
      .eq("id", parent.list_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (listRow?.slug) {
      backHref = `/${listRow.slug}`;
    }
  }

  const initialSubTodos: TodoRow[] = (subRows ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    is_completed: r.is_completed,
    list_id: r.list_id,
    parent_id: parent.id,
  }));

  return (
    <main suppressHydrationWarning className="mx-auto w-full max-w-2xl px-4 pt-4 sm:pt-6">
      <h1 className="sr-only">Task details</h1>
      <TodoDetailClient backHref={backHref} initialParent={parent} initialSubTodos={initialSubTodos} />
    </main>
  );
}
