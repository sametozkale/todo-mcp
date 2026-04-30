"use server";

import { createClient } from "@/lib/supabase/server";
import {
  revalidateAppShell,
  revalidateTodoDetailPaths,
  revalidateTodoListPaths,
} from "@/lib/revalidate-todo-pages";
import { FREE_LIMITS, isProPlan, type PlanType } from "@/lib/subscription";
import { getPostHogClient } from "@/lib/posthog";
import { isBulkReorderRpcDisabled } from "@/lib/perf-flags";

export type AddTodoState = { error?: string; success?: boolean } | null;

function isMissingRpc(errorMessage: string | undefined, fnName: string): boolean {
  if (!errorMessage) return false;
  const msg = errorMessage.toLowerCase();
  return msg.includes("schema cache") && msg.includes(fnName.toLowerCase());
}

export async function addTodoAction(_prevState: AddTodoState, formData: FormData): Promise<AddTodoState> {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    return { error: "Enter a task title." };
  }

  const listIdRaw = formData.get("list_id");
  const listId =
    typeof listIdRaw === "string" && listIdRaw.length > 0 ? listIdRaw : null;

  const parentIdRaw = formData.get("parent_id");
  const parentId =
    typeof parentIdRaw === "string" && parentIdRaw.length > 0 ? parentIdRaw : null;

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_todo_fast", {
    p_title: title,
    p_list_id: listId,
    p_parent_id: parentId,
  });
  if (error && !isMissingRpc(error.message, "create_todo_fast")) return { error: error.message };
  if (error && isMissingRpc(error.message, "create_todo_fast")) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not signed in." };

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
      if (totalErr) return { error: totalErr.message };
      if ((totalActive ?? 0) >= FREE_LIMITS.allListTodos) {
        return { error: "You've reached the 25 active todo limit on the free plan. Upgrade to add more." };
      }
    }

    let effectiveListId: string | null = listId;
    if (parentId) {
      const { data: parentRow, error: pErr } = await supabase
        .from("todos")
        .select("id, list_id, parent_id")
        .eq("id", parentId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (pErr || !parentRow) return { error: "Invalid parent todo." };
      if (parentRow.parent_id) return { error: "Nested sub-todos are not supported." };
      effectiveListId = parentRow.list_id;
    }

    if (effectiveListId && !isPro) {
      const { count, error: countErr } = await supabase
        .from("todos")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("list_id", effectiveListId)
        .or("is_completed.is.null,is_completed.eq.false");
      if (countErr) return { error: countErr.message };
      if ((count ?? 0) >= FREE_LIMITS.extraListTodos) {
        return { error: "This list is full (10/10). Upgrade to add more todos." };
      }
    }

    const { data: minAllPosRow } = await supabase
      .from("todos")
      .select("all_position")
      .eq("user_id", user.id)
      .order("all_position", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const nextAllPosition = (minAllPosRow?.all_position ?? 0) - 1;

    let nextListPosition: number;
    if (parentId) {
      const { data: minSubPosRow } = await supabase
        .from("todos")
        .select("position")
        .eq("user_id", user.id)
        .eq("parent_id", parentId)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      nextListPosition = (minSubPosRow?.position ?? 0) - 1;
    } else {
      const minListBase = supabase
        .from("todos")
        .select("position")
        .eq("user_id", user.id)
        .is("parent_id", null)
        .order("position", { ascending: true })
        .limit(1);
      const { data: minListPosRow } =
        effectiveListId == null
          ? await minListBase.is("list_id", null).maybeSingle()
          : await minListBase.eq("list_id", effectiveListId).maybeSingle();
      nextListPosition = (minListPosRow?.position ?? 0) - 1;
    }

    const { error: insertErr } = await supabase.from("todos").insert({
      user_id: user.id,
      list_id: effectiveListId,
      parent_id: parentId,
      title,
      position: nextListPosition,
      all_position: nextAllPosition,
    });
    if (insertErr) return { error: insertErr.message };
  }

  const posthog = getPostHogClient();
  const { data: { user: todoUser } } = await supabase.auth.getUser();
  if (todoUser) {
    posthog.capture({
      distinctId: todoUser.id,
      event: "todo_created",
      properties: {
        has_list: !!listId,
        is_sub_todo: !!parentId,
      },
    });
  }

  revalidateAppShell();
  if (parentId) {
    revalidateTodoDetailPaths(parentId);
  }
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

  const { data: before } = await supabase
    .from("todos")
    .select("parent_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("todos")
    .update({ title: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidateAppShell();
  revalidateTodoDetailPaths(id, before?.parent_id ?? null);
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

  const { data: before } = await supabase
    .from("todos")
    .select("parent_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

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

  if (completed) {
    getPostHogClient().capture({
      distinctId: user.id,
      event: "todo_completed",
      properties: { is_sub_todo: !!before?.parent_id },
    });
  }

  revalidateAppShell();
  revalidateTodoDetailPaths(id, before?.parent_id ?? null);
  return { success: true as const };
}

export async function deleteTodoAction(id: string) {
  const supabase = await createClient();
  const { data: deletedRows, error } = await supabase.rpc("delete_todo_fast", { p_id: id });
  let deleted = deletedRows?.[0] ?? null;
  if (error && !isMissingRpc(error.message, "delete_todo_fast")) return { error: error.message };
  if (error && isMissingRpc(error.message, "delete_todo_fast")) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not signed in." };
    const { data: before } = await supabase
      .from("todos")
      .select("parent_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    const { error: delErr } = await supabase.from("todos").delete().eq("id", id).eq("user_id", user.id);
    if (delErr) return { error: delErr.message };
    deleted = { parent_id: before?.parent_id ?? null };
  }

  const { data: { user: deleteUser } } = await supabase.auth.getUser();
  if (deleteUser) {
    getPostHogClient().capture({
      distinctId: deleteUser.id,
      event: "todo_deleted",
    });
  }

  revalidateAppShell();
  revalidateTodoDetailPaths(id, deleted?.parent_id ?? null);
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

  const { data: srcMeta } = await supabase
    .from("todos")
    .select("parent_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!isBulkReorderRpcDisabled()) {
    const { error: rpcErr } = await supabase.rpc("duplicate_todo_fast", { p_source_id: id });
    if (!rpcErr) {
      revalidateAppShell();
      revalidateTodoDetailPaths(id, srcMeta?.parent_id ?? null);
      return { success: true as const };
    }
    if (!isMissingRpc(rpcErr.message, "duplicate_todo_fast")) {
      return { error: rpcErr.message };
    }
  }

  const { data: source, error: sourceErr } = await supabase
    .from("todos")
    .select(
      "id, user_id, title, list_id, parent_id, is_completed, completed_at, position, all_position",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sourceErr || !source) {
    return { error: "Todo not found." };
  }

  const nextListPosition = (source.position ?? 0) + 1;
  const nextAllPosition = (source.all_position ?? 0) + 1;

  if (source.parent_id) {
    const { data: sibRows } = await supabase
      .from("todos")
      .select("id, position")
      .eq("user_id", user.id)
      .eq("parent_id", source.parent_id)
      .gt("position", source.position ?? 0)
      .order("position", { ascending: true });
    if (sibRows?.length) {
      await Promise.all(
        sibRows.map((row) =>
          supabase
            .from("todos")
            .update({ position: (row.position ?? 0) + 1 })
            .eq("id", row.id)
            .eq("user_id", user.id),
        ),
      );
    }
  } else if (source.list_id == null) {
    const { data: listRows } = await supabase
      .from("todos")
      .select("id, position")
      .eq("user_id", user.id)
      .is("list_id", null)
      .is("parent_id", null)
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
      .is("parent_id", null)
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
    parent_id: source.parent_id,
    is_completed: source.is_completed,
    completed_at: source.completed_at,
    position: nextListPosition,
    all_position: nextAllPosition,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateAppShell();
  revalidateTodoDetailPaths(id, source.parent_id);
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
    .select("id, list_id, parent_id")
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
    .is("parent_id", null)
    .order("position", { ascending: true })
    .limit(1);

  const { data: minListPosRow } =
    targetListId == null
      ? await minListBase.is("list_id", null).maybeSingle()
      : await minListBase.eq("list_id", targetListId).maybeSingle();

  const nextListPosition = (minListPosRow?.position ?? 0) - 1;

  const { error } = await supabase
    .from("todos")
    .update({ list_id: targetListId, position: nextListPosition, parent_id: null })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidateAppShell();
  revalidateTodoDetailPaths(id, source.parent_id);
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

  if (!isBulkReorderRpcDisabled()) {
    const { error: rpcErr } = await supabase.rpc("reorder_todos_in_list_positions", {
      p_list_id: listId,
      p_ordered_ids: ids,
    });
    if (!rpcErr) {
      if (listRow?.slug) {
        revalidateTodoListPaths([listRow.slug]);
      } else {
        revalidateAppShell();
      }
      return { success: true as const };
    }
    if (!isMissingRpc(rpcErr.message, "reorder_todos_in_list_positions")) {
      return { error: rpcErr.message };
    }
  }

  const updates = await Promise.all(
    ids.map((id, idx) =>
      supabase
        .from("todos")
        .update({ position: idx })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("list_id", listId)
        .is("parent_id", null),
    ),
  );

  const firstError = updates.find((r) => r.error)?.error;
  if (firstError) {
    return { error: firstError.message };
  }

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

  if (!isBulkReorderRpcDisabled()) {
    const { error: rpcErr } = await supabase.rpc("reorder_todos_all_positions", {
      p_ordered_ids: ids,
    });
    if (!rpcErr) {
      revalidateAppShell();
      return { success: true as const };
    }
    if (!isMissingRpc(rpcErr.message, "reorder_todos_all_positions")) {
      return { error: rpcErr.message };
    }
  }

  const updates = await Promise.all(
    ids.map((id, idx) =>
      supabase
        .from("todos")
        .update({ all_position: idx })
        .eq("id", id)
        .eq("user_id", user.id)
        .is("parent_id", null),
    ),
  );

  const firstError = updates.find((r) => r.error)?.error;
  if (firstError) {
    return { error: firstError.message };
  }

  revalidateAppShell();
  return { success: true as const };
}

export async function reorderSubTodosAction(parentId: string, orderedTodoIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  const { data: parent, error: pErr } = await supabase
    .from("todos")
    .select("id, parent_id")
    .eq("id", parentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (pErr || !parent) {
    return { error: "Parent todo not found." };
  }
  if (parent.parent_id) {
    return { error: "Invalid parent." };
  }

  const ids = orderedTodoIds.filter(Boolean);
  if (ids.length === 0) {
    return { success: true as const };
  }

  if (!isBulkReorderRpcDisabled()) {
    const { error: rpcErr } = await supabase.rpc("reorder_sub_todos_positions", {
      p_parent_id: parentId,
      p_ordered_ids: ids,
    });
    if (!rpcErr) {
      revalidateAppShell();
      revalidateTodoDetailPaths(parentId);
      return { success: true as const };
    }
    if (!isMissingRpc(rpcErr.message, "reorder_sub_todos_positions")) {
      return { error: rpcErr.message };
    }
  }

  const updates = await Promise.all(
    ids.map((id, idx) =>
      supabase
        .from("todos")
        .update({ position: idx })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("parent_id", parentId),
    ),
  );

  const firstError = updates.find((r) => r.error)?.error;
  if (firstError) {
    return { error: firstError.message };
  }

  revalidateAppShell();
  revalidateTodoDetailPaths(parentId);
  return { success: true as const };
}
