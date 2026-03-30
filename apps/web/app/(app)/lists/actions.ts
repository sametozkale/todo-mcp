"use server";

import { createClient } from "@/lib/supabase/server";
import { slugifyListTitle, validateListSlugForCreate } from "@/lib/list-slug";
import { revalidateAppShell, revalidateTodoListPaths } from "@/lib/revalidate-todo-pages";
import { isProPlan, type PlanType } from "@/lib/subscription";

export type CreateListResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export async function createListAction(title: string): Promise<CreateListResult> {
  const trimmed = title.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter a list name." };
  }
  const slug = slugifyListTitle(trimmed);
  const err = validateListSlugForCreate(slug);
  if (err) {
    return { ok: false, error: err };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { data: subRow } = await supabase
    .from("user_subscriptions")
    .select("plan_type, subscription_status")
    .eq("user_id", user.id)
    .maybeSingle();

  const plan = (subRow?.plan_type ?? "free") as PlanType;
  const isPro = isProPlan(plan, subRow?.subscription_status ?? "inactive");

  if (!isPro) {
    const { count, error: countErr } = await supabase
      .from("lists")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countErr) {
      return { ok: false, error: countErr.message };
    }

    if ((count ?? 0) >= 1) {
      return {
        ok: false,
        error: "Free plan allows 1 list. Upgrade for unlimited lists.",
      };
    }
  }

  const { data: maxRow } = await supabase
    .from("lists")
    .select("position")
    .eq("user_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (maxRow?.position ?? -1) + 1;

  const { error } = await supabase.from("lists").insert({
    user_id: user.id,
    title: trimmed || slug,
    slug,
    position: nextPosition,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "A list with this name already exists.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidateTodoListPaths([slug]);
  return { ok: true, slug };
}

export type ReorderListsResult = { ok: true } | { ok: false; error: string };

/**
 * Persists left-to-right tab order. `orderedListIds` must be a permutation of the user's list ids.
 */
export async function reorderListsAction(orderedListIds: string[]): Promise<ReorderListsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { data: rows, error: fetchErr } = await supabase
    .from("lists")
    .select("id")
    .eq("user_id", user.id);

  if (fetchErr) {
    return { ok: false, error: fetchErr.message };
  }

  const serverIds = new Set((rows ?? []).map((r) => r.id));
  if (orderedListIds.length !== serverIds.size) {
    return { ok: false, error: "Invalid list order." };
  }
  for (const id of orderedListIds) {
    if (!serverIds.has(id)) {
      return { ok: false, error: "Invalid list order." };
    }
  }

  const updates = orderedListIds.map((id, index) =>
    supabase.from("lists").update({ position: index }).eq("id", id).eq("user_id", user.id),
  );
  const results = await Promise.all(updates);
  for (const { error } of results) {
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  revalidateAppShell();
  return { ok: true };
}

export type DeleteListMode = "move_tasks_to_unassigned" | "delete_tasks";

export type DeleteListResult = { ok: true } | { ok: false; error: string };

export async function deleteListAction(
  listId: string,
  mode: DeleteListMode,
): Promise<DeleteListResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const { data: list, error: listErr } = await supabase
    .from("lists")
    .select("id, slug")
    .eq("id", listId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (listErr || !list) {
    return { ok: false, error: "List not found." };
  }

  const slug = list.slug;

  const { count, error: countErr } = await supabase
    .from("todos")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("list_id", listId);

  if (countErr) {
    return { ok: false, error: countErr.message };
  }

  const n = count ?? 0;

  if (n > 0) {
    if (mode === "move_tasks_to_unassigned") {
      const { error: moveErr } = await supabase
        .from("todos")
        .update({ list_id: null })
        .eq("user_id", user.id)
        .eq("list_id", listId);

      if (moveErr) {
        return { ok: false, error: moveErr.message };
      }
    } else {
      const { error: delTodoErr } = await supabase
        .from("todos")
        .delete()
        .eq("user_id", user.id)
        .eq("list_id", listId);

      if (delTodoErr) {
        return { ok: false, error: delTodoErr.message };
      }
    }
  }

  const { error: delListErr } = await supabase
    .from("lists")
    .delete()
    .eq("id", listId)
    .eq("user_id", user.id);

  if (delListErr) {
    return { ok: false, error: delListErr.message };
  }

  revalidateTodoListPaths([slug]);
  return { ok: true };
}
