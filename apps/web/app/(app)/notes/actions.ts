"use server";

import { createClient } from "@/lib/supabase/server";
import {
  revalidateNoteAppShell,
  revalidateNoteDetailPaths,
  revalidateNoteListPaths,
} from "@/lib/revalidate-note-pages";
import { FREE_LIMITS, isProPlan, type PlanType } from "@/lib/subscription";
import { getPostHogClient } from "@/lib/posthog";
import { isBulkReorderRpcDisabled } from "@/lib/perf-flags";

export type AddNoteState = { error?: string; success?: boolean } | null;

function isMissingRpc(errorMessage: string | undefined, fnName: string): boolean {
  if (!errorMessage) return false;
  const msg = errorMessage.toLowerCase();
  return msg.includes("schema cache") && msg.includes(fnName.toLowerCase());
}

/** Map legacy DB/RPC copy ("list") to Notes UI terminology ("folder"). */
function normalizeNoteFolderError(message: string): string {
  return message
    .replace(/\bInvalid list\./g, "Invalid folder.")
    .replace(/\bInvalid list order\./g, "Invalid folder order.")
    .replace(/This list is full/g, "This folder is full");
}

export async function addNoteAction(_prevState: AddNoteState, formData: FormData): Promise<AddNoteState> {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    return { error: "Enter a note title." };
  }

  const noteListIdRaw = formData.get("note_list_id");
  const noteListId =
    typeof noteListIdRaw === "string" && noteListIdRaw.length > 0 ? noteListIdRaw : null;

  const parentIdRaw = formData.get("parent_id");
  const parentId =
    typeof parentIdRaw === "string" && parentIdRaw.length > 0 ? parentIdRaw : null;

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_note_fast", {
    p_title: title,
    p_note_list_id: noteListId,
    p_parent_id: parentId,
  });
  if (error && !isMissingRpc(error.message, "create_note_fast")) {
    return { error: normalizeNoteFolderError(error.message) };
  }
  if (error && isMissingRpc(error.message, "create_note_fast")) {
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
        .from("notes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .or("is_completed.is.null,is_completed.eq.false");
      if (totalErr) return { error: totalErr.message };
      if ((totalActive ?? 0) >= FREE_LIMITS.allListNotes) {
        return { error: "You've reached the 25 active note limit on the free plan. Upgrade to add more." };
      }
    }

    let effectiveNoteListId: string | null = noteListId;
    if (parentId) {
      const { data: parentRow, error: pErr } = await supabase
        .from("notes")
        .select("id, note_list_id, parent_id")
        .eq("id", parentId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (pErr || !parentRow) return { error: "Invalid parent note." };
      if (parentRow.parent_id) return { error: "Nested sub-notes are not supported." };
      effectiveNoteListId = parentRow.note_list_id;
    }

    if (effectiveNoteListId && !isPro) {
      const { count, error: countErr } = await supabase
        .from("notes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("note_list_id", effectiveNoteListId)
        .or("is_completed.is.null,is_completed.eq.false");
      if (countErr) return { error: countErr.message };
      if ((count ?? 0) >= FREE_LIMITS.extraListNotes) {
        return { error: "This folder is full (10/10). Upgrade to add more notes." };
      }
    }

    const { data: minAllPosRow } = await supabase
      .from("notes")
      .select("all_position")
      .eq("user_id", user.id)
      .order("all_position", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const nextAllPosition = (minAllPosRow?.all_position ?? 0) - 1;

    let nextListPosition: number;
    if (parentId) {
      const { data: minSubPosRow } = await supabase
        .from("notes")
        .select("position")
        .eq("user_id", user.id)
        .eq("parent_id", parentId)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      nextListPosition = (minSubPosRow?.position ?? 0) - 1;
    } else {
      const minListBase = supabase
        .from("notes")
        .select("position")
        .eq("user_id", user.id)
        .is("parent_id", null)
        .order("position", { ascending: true })
        .limit(1);
      const { data: minListPosRow } =
        effectiveNoteListId == null
          ? await minListBase.is("note_list_id", null).maybeSingle()
          : await minListBase.eq("note_list_id", effectiveNoteListId).maybeSingle();
      nextListPosition = (minListPosRow?.position ?? 0) - 1;
    }

    const { error: insertErr } = await supabase.from("notes").insert({
      user_id: user.id,
      note_list_id: effectiveNoteListId,
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
      event: "note_created",
      properties: {
        has_list: !!noteListId,
        is_sub_note: !!parentId,
      },
    });
  }

  revalidateNoteAppShell();
  if (parentId) {
    revalidateNoteDetailPaths(parentId);
  }
  return { success: true as const };
}

export async function updateNoteTitleAction(id: string, title: string) {
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
    .from("notes")
    .select("parent_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("notes")
    .update({ title: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidateNoteAppShell();
  revalidateNoteDetailPaths(id, before?.parent_id ?? null);
  return { success: true as const };
}

export async function updateNoteDescriptionAction(id: string, description: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  const normalized = description.trim() || null;

  const { error } = await supabase
    .from("notes")
    .update({ description: normalized, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: normalizeNoteFolderError(error.message) };
  }

  revalidateNoteDetailPaths(id);
  return { success: true as const };
}

export async function toggleNoteAction(id: string, completed: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  const { data: before } = await supabase
    .from("notes")
    .select("parent_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("notes")
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
      event: "note_completed",
      properties: { is_sub_note: !!before?.parent_id },
    });
  }

  revalidateNoteAppShell();
  revalidateNoteDetailPaths(id, before?.parent_id ?? null);
  return { success: true as const };
}

export async function deleteNoteAction(id: string) {
  const supabase = await createClient();
  const { data: deletedRows, error } = await supabase.rpc("delete_note_fast", { p_id: id });
  let deleted = deletedRows?.[0] ?? null;
  if (error && !isMissingRpc(error.message, "delete_note_fast")) return { error: error.message };
  if (error && isMissingRpc(error.message, "delete_note_fast")) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not signed in." };
    const { data: before } = await supabase
      .from("notes")
      .select("parent_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    const { error: delErr } = await supabase.from("notes").delete().eq("id", id).eq("user_id", user.id);
    if (delErr) return { error: delErr.message };
    deleted = { parent_id: before?.parent_id ?? null };
  }

  const { data: { user: deleteUser } } = await supabase.auth.getUser();
  if (deleteUser) {
    getPostHogClient().capture({
      distinctId: deleteUser.id,
      event: "note_deleted",
    });
  }

  revalidateNoteAppShell();
  revalidateNoteDetailPaths(id, deleted?.parent_id ?? null);
  return { success: true as const };
}

export async function duplicateNoteAction(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  const { data: srcMeta } = await supabase
    .from("notes")
    .select("parent_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!isBulkReorderRpcDisabled()) {
    const { error: rpcErr } = await supabase.rpc("duplicate_note_fast", { p_source_id: id });
    if (!rpcErr) {
      revalidateNoteAppShell();
      revalidateNoteDetailPaths(id, srcMeta?.parent_id ?? null);
      return { success: true as const };
    }
    if (!isMissingRpc(rpcErr.message, "duplicate_note_fast")) {
      return { error: rpcErr.message };
    }
  }

  const { data: source, error: sourceErr } = await supabase
    .from("notes")
    .select(
      "id, user_id, title, note_list_id, parent_id, is_completed, completed_at, position, all_position",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sourceErr || !source) {
    return { error: "Note not found." };
  }

  const nextListPosition = (source.position ?? 0) + 1;
  const nextAllPosition = (source.all_position ?? 0) + 1;

  if (source.parent_id) {
    const { data: sibRows } = await supabase
      .from("notes")
      .select("id, position")
      .eq("user_id", user.id)
      .eq("parent_id", source.parent_id)
      .gt("position", source.position ?? 0)
      .order("position", { ascending: true });
    if (sibRows?.length) {
      await Promise.all(
        sibRows.map((row) =>
          supabase
            .from("notes")
            .update({ position: (row.position ?? 0) + 1 })
            .eq("id", row.id)
            .eq("user_id", user.id),
        ),
      );
    }
  } else if (source.note_list_id == null) {
    const { data: listRows } = await supabase
      .from("notes")
      .select("id, position")
      .eq("user_id", user.id)
      .is("note_list_id", null)
      .is("parent_id", null)
      .gt("position", source.position ?? 0)
      .order("position", { ascending: true });
    if (listRows?.length) {
      await Promise.all(
        listRows.map((row) =>
          supabase
            .from("notes")
            .update({ position: (row.position ?? 0) + 1 })
            .eq("id", row.id)
            .eq("user_id", user.id),
        ),
      );
    }
  } else {
    const { data: listRows } = await supabase
      .from("notes")
      .select("id, position")
      .eq("user_id", user.id)
      .eq("note_list_id", source.note_list_id)
      .is("parent_id", null)
      .gt("position", source.position ?? 0)
      .order("position", { ascending: true });
    if (listRows?.length) {
      await Promise.all(
        listRows.map((row) =>
          supabase
            .from("notes")
            .update({ position: (row.position ?? 0) + 1 })
            .eq("id", row.id)
            .eq("user_id", user.id),
        ),
      );
    }
  }

  const { data: allRows } = await supabase
    .from("notes")
    .select("id, all_position")
    .eq("user_id", user.id)
    .gt("all_position", source.all_position ?? 0)
    .order("all_position", { ascending: true });
  if (allRows?.length) {
    await Promise.all(
      allRows.map((row) =>
        supabase
          .from("notes")
          .update({ all_position: (row.all_position ?? 0) + 1 })
          .eq("id", row.id)
          .eq("user_id", user.id),
      ),
    );
  }

  const { error } = await supabase.from("notes").insert({
    user_id: user.id,
    title: source.title,
    note_list_id: source.note_list_id,
    parent_id: source.parent_id,
    is_completed: source.is_completed,
    completed_at: source.completed_at,
    position: nextListPosition,
    all_position: nextAllPosition,
  });

  if (error) {
    return { error: error.message };
  }

  revalidateNoteAppShell();
  revalidateNoteDetailPaths(id, source.parent_id);
  return { success: true as const };
}

export async function moveNoteToNoteListAction(id: string, targetNoteListId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  const { data: source, error: sourceErr } = await supabase
    .from("notes")
    .select("id, note_list_id, parent_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sourceErr || !source) {
    return { error: "Note not found." };
  }

  if (targetNoteListId === source.note_list_id) {
    return { success: true as const };
  }

  if (targetNoteListId) {
    const { data: listRow, error: listErr } = await supabase
      .from("note_lists")
      .select("id")
      .eq("id", targetNoteListId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (listErr || !listRow) {
      return { error: "Target folder not found." };
    }
  }

  const minListBase = supabase
    .from("notes")
    .select("position")
    .eq("user_id", user.id)
    .is("parent_id", null)
    .order("position", { ascending: true })
    .limit(1);

  const { data: minListPosRow } =
    targetNoteListId == null
      ? await minListBase.is("note_list_id", null).maybeSingle()
      : await minListBase.eq("note_list_id", targetNoteListId).maybeSingle();

  const nextListPosition = (minListPosRow?.position ?? 0) - 1;

  const { error } = await supabase
    .from("notes")
    .update({ note_list_id: targetNoteListId, position: nextListPosition, parent_id: null })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidateNoteAppShell();
  revalidateNoteDetailPaths(id, source.parent_id);
  return { success: true as const };
}

export async function reorderNotesAction(noteListId: string, orderedTodoIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  if (!noteListId) {
    return { error: "Invalid folder." };
  }

  const { data: listRow, error: listErr } = await supabase
    .from("note_lists")
    .select("id, slug")
    .eq("id", noteListId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (listErr || !listRow) {
    return { error: "Invalid folder." };
  }

  const ids = orderedTodoIds.filter(Boolean);
  if (ids.length === 0) {
    return { success: true as const };
  }

  if (!isBulkReorderRpcDisabled()) {
    const { error: rpcErr } = await supabase.rpc("reorder_notes_in_list_positions", {
      p_note_list_id: noteListId,
      p_ordered_ids: ids,
    });
    if (!rpcErr) {
      if (listRow?.slug) {
        revalidateNoteListPaths([listRow.slug]);
      } else {
        revalidateNoteAppShell();
      }
      return { success: true as const };
    }
    if (!isMissingRpc(rpcErr.message, "reorder_notes_in_list_positions")) {
      return { error: rpcErr.message };
    }
  }

  const updates = await Promise.all(
    ids.map((id, idx) =>
      supabase
        .from("notes")
        .update({ position: idx })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("note_list_id", noteListId)
        .is("parent_id", null),
    ),
  );

  const firstError = updates.find((r) => r.error)?.error;
  if (firstError) {
    return { error: firstError.message };
  }

  if (listRow?.slug) {
    revalidateNoteListPaths([listRow.slug]);
  } else {
    revalidateNoteAppShell();
  }
  return { success: true as const };
}

export async function reorderAllNotesAction(orderedTodoIds: string[]) {
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
    const { error: rpcErr } = await supabase.rpc("reorder_notes_all_positions", {
      p_ordered_ids: ids,
    });
    if (!rpcErr) {
      revalidateNoteAppShell();
      return { success: true as const };
    }
    if (!isMissingRpc(rpcErr.message, "reorder_notes_all_positions")) {
      return { error: rpcErr.message };
    }
  }

  const updates = await Promise.all(
    ids.map((id, idx) =>
      supabase
        .from("notes")
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

  revalidateNoteAppShell();
  return { success: true as const };
}

export async function reorderSubNotesAction(parentId: string, orderedTodoIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not signed in." };
  }

  const { data: parent, error: pErr } = await supabase
    .from("notes")
    .select("id, parent_id")
    .eq("id", parentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (pErr || !parent) {
    return { error: "Parent note not found." };
  }
  if (parent.parent_id) {
    return { error: "Invalid parent." };
  }

  const ids = orderedTodoIds.filter(Boolean);
  if (ids.length === 0) {
    return { success: true as const };
  }

  if (!isBulkReorderRpcDisabled()) {
    const { error: rpcErr } = await supabase.rpc("reorder_sub_notes_positions", {
      p_parent_id: parentId,
      p_ordered_ids: ids,
    });
    if (!rpcErr) {
      revalidateNoteAppShell();
      revalidateNoteDetailPaths(parentId);
      return { success: true as const };
    }
    if (!isMissingRpc(rpcErr.message, "reorder_sub_notes_positions")) {
      return { error: rpcErr.message };
    }
  }

  const updates = await Promise.all(
    ids.map((id, idx) =>
      supabase
        .from("notes")
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

  revalidateNoteAppShell();
  revalidateNoteDetailPaths(parentId);
  return { success: true as const };
}
