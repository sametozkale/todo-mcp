"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidateAppShell, revalidateTodoListPaths } from "@/lib/revalidate-todo-pages";
import { FREE_LIMITS, isProPlan, type PlanType } from "@/lib/subscription";

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

  const { data: subRow } = await supabase
    .from("user_subscriptions")
    .select("plan_type, subscription_status")
    .eq("user_id", user.id)
    .maybeSingle();

  const plan = (subRow?.plan_type ?? "free") as PlanType;
  const isPro = isProPlan(plan, subRow?.subscription_status ?? "inactive");

  if (!isPro) {
    const { count: totalActive, error: totalErr } = await supabase
      .from("todos")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .or("is_completed.is.null,is_completed.eq.false");

    if (totalErr) {
      return { error: totalErr.message };
    }

    if ((totalActive ?? 0) >= FREE_LIMITS.allListTodos) {
      return {
        error: "You've reached the 25 active todo limit on the free plan. Upgrade to add more.",
      };
    }
  }

  /** All view: unassigned (no list). Named list: that list's id. */
  const effectiveListId: string | null = listId;

  if (effectiveListId) {
    const { data: listRow, error: listErr } = await supabase
      .from("lists")
      .select("id, slug")
      .eq("id", effectiveListId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (listErr || !listRow) {
      return { error: "Invalid list." };
    }

    if (!isPro) {
      const { count, error: countErr } = await supabase
        .from("todos")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("list_id", listRow.id)
        .or("is_completed.is.null,is_completed.eq.false");

      if (countErr) {
        return { error: countErr.message };
      }

      if ((count ?? 0) >= FREE_LIMITS.extraListTodos) {
        return {
          error: "This list is full (10/10). Upgrade to add more todos.",
        };
      }
    }
  }

  const minListBase = supabase
    .from("todos")
    .select("position")
    .eq("user_id", user.id)
    .order("position", { ascending: true })
    .limit(1);

  const { data: minListPosRow } =
    effectiveListId == null
      ? await minListBase.is("list_id", null).maybeSingle()
      : await minListBase.eq("list_id", effectiveListId).maybeSingle();

  const { data: minAllPosRow } = await supabase
    .from("todos")
    .select("all_position")
    .eq("user_id", user.id)
    .order("all_position", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const nextListPosition = (minListPosRow?.position ?? 0) - 1;
  const nextAllPosition = (minAllPosRow?.all_position ?? 0) - 1;

  const { error } = await supabase.from("todos").insert({
    user_id: user.id,
    list_id: effectiveListId,
    title,
    position: nextListPosition,
    all_position: nextAllPosition,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateAppShell();
  return { success: true as const };
}

export async function updateTodoTitleAction(id: string, title: string) {
  const trimmed = title.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return { error: "Title cannot be empty." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  const { error } = await supabase
    .from("todos")
    .update({ title: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

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

export async function duplicateTodoAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  const { data: source, error: sourceErr } = await supabase
    .from("todos")
    .select("id, user_id, title, list_id, is_completed, completed_at, position, all_position")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sourceErr || !source) {
    return { error: "Todo not found." };
  }

  const nextListPosition = (source.position ?? 0) + 1;
  const nextAllPosition = (source.all_position ?? 0) + 1;

  if (source.list_id == null) {
    // Keep integer ordering stable by shifting items below source.
    const { data: listRows } = await supabase
      .from("todos")
      .select("id, position")
      .eq("user_id", user.id)
      .is("list_id", null)
      .gt("position", source.position ?? 0)
      .order("position", { ascending: true });
    if (listRows?.length) {
      await Promise.all(
        listRows.map((row) =>
          supabase
            .from("todos")
            .update({ position: (row.position ?? 0) + 1 })
            .eq("id", row.id)
            .eq("user_id", user.id),
        ),
      );
    }
  } else {
    const { data: listRows } = await supabase
      .from("todos")
      .select("id, position")
      .eq("user_id", user.id)
      .eq("list_id", source.list_id)
      .gt("position", source.position ?? 0)
      .order("position", { ascending: true });
    if (listRows?.length) {
      await Promise.all(
        listRows.map((row) =>
          supabase
            .from("todos")
            .update({ position: (row.position ?? 0) + 1 })
            .eq("id", row.id)
            .eq("user_id", user.id),
        ),
      );
    }
  }

  const { data: allRows } = await supabase
    .from("todos")
    .select("id, all_position")
    .eq("user_id", user.id)
    .gt("all_position", source.all_position ?? 0)
    .order("all_position", { ascending: true });
  if (allRows?.length) {
    await Promise.all(
      allRows.map((row) =>
        supabase
          .from("todos")
          .update({ all_position: (row.all_position ?? 0) + 1 })
          .eq("id", row.id)
          .eq("user_id", user.id),
      ),
    );
  }

  const { error } = await supabase.from("todos").insert({
    user_id: user.id,
    title: source.title,
    list_id: source.list_id,
    is_completed: source.is_completed,
    completed_at: source.completed_at,
    position: nextListPosition,
    all_position: nextAllPosition,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateAppShell();
  return { success: true as const };
}

export async function moveTodoToListAction(id: string, targetListId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  const { data: source, error: sourceErr } = await supabase
    .from("todos")
    .select("id, list_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sourceErr || !source) {
    return { error: "Todo not found." };
  }

  if (targetListId === source.list_id) {
    return { success: true as const };
  }

  if (targetListId) {
    const { data: listRow, error: listErr } = await supabase
      .from("lists")
      .select("id")
      .eq("id", targetListId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (listErr || !listRow) {
      return { error: "Target list not found." };
    }
  }

  const minListBase = supabase
    .from("todos")
    .select("position")
    .eq("user_id", user.id)
    .order("position", { ascending: true })
    .limit(1);

  const { data: minListPosRow } =
    targetListId == null
      ? await minListBase.is("list_id", null).maybeSingle()
      : await minListBase.eq("list_id", targetListId).maybeSingle();

  const nextListPosition = (minListPosRow?.position ?? 0) - 1;

  const { error } = await supabase
    .from("todos")
    .update({ list_id: targetListId, position: nextListPosition })
    .eq("id", id)
    .eq("user_id", user.id);

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

  // Only `all_position` — per-list `position` stays untouched so list views keep their own order.
  const updates = await Promise.all(
    ids.map((id, idx) =>
      supabase
        .from("todos")
        .update({ all_position: idx })
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
