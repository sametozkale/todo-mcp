"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidateAppShell, revalidateTodoListPaths } from "@/lib/revalidate-todo-pages";

export type AddTodoState = { error?: string; success?: boolean } | null;

export async function addTodoAction(_prevState: AddTodoState, formData: FormData): Promise<AddTodoState> {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    return { error: "Enter a task title." };
  }

  const listIdRaw = formData.get("list_id");
  const listId =
    typeof listIdRaw === "string" && listIdRaw.length > 0 ? listIdRaw : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  if (listId) {
    const { data: listRow, error: listErr } = await supabase
      .from("lists")
      .select("id")
      .eq("id", listId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (listErr || !listRow) {
      return { error: "Invalid list." };
    }
  }

  const { error } = await supabase.from("todos").insert({
    user_id: user.id,
    list_id: listId,
    title,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateAppShell();
  return { success: true as const };
}

export async function toggleTodoAction(id: string, completed: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  const { error } = await supabase
    .from("todos")
    .update({
      is_completed: completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidateAppShell();
  return { success: true as const };
}

export async function deleteTodoAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  const { error } = await supabase.from("todos").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidateAppShell();
  return { success: true as const };
}

export async function reorderTodosAction(listId: string, orderedTodoIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  if (!listId) {
    return { error: "Invalid list." };
  }

  const { data: listRow, error: listErr } = await supabase
    .from("lists")
    .select("id, slug")
    .eq("id", listId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (listErr || !listRow) {
    return { error: "Invalid list." };
  }

  const ids = orderedTodoIds.filter(Boolean);
  if (ids.length === 0) {
    return { success: true as const };
  }

  const updates = await Promise.all(
    ids.map((id, idx) =>
      supabase
        .from("todos")
        .update({ position: idx })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("list_id", listId),
    ),
  );

  const firstError = updates.find((r) => r.error)?.error;
  if (firstError) {
    return { error: firstError.message };
  }

  // Ensure the specific list page is revalidated too, not just the shared shell.
  // This prevents stale ordering when a user navigates away and returns.
  if (listRow?.slug) {
    revalidateTodoListPaths([listRow.slug]);
  } else {
    revalidateAppShell();
  }
  return { success: true as const };
}

export async function reorderAllTodosAction(orderedTodoIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  const ids = orderedTodoIds.filter(Boolean);
  if (ids.length === 0) {
    return { success: true as const };
  }

  const updates = await Promise.all(
    ids.map((id, idx) =>
      supabase
        .from("todos")
        .update({ position: idx })
        .eq("id", id)
        .eq("user_id", user.id),
    ),
  );

  const firstError = updates.find((r) => r.error)?.error;
  if (firstError) {
    return { error: firstError.message };
  }

  revalidateAppShell();
  return { success: true as const };
}
