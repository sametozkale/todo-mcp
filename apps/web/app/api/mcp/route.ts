import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { slugifyListTitle } from "@/lib/list-slug";
import { FREE_LIMITS, isProPlan, type PlanType } from "@/lib/subscription";

type ToolName =
  | "list_lists"
  | "create_list"
  | "resolve_list"
  | "list_todos"
  | "create_todo"
  | "update_todo"
  | "delete_todo";

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service role env vars.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function getPepper(): string {
  return process.env.YALP_API_KEY_PEPPER ?? "";
}

function hashApiKey(apiKey: string): string {
  const hasValidPrefix = apiKey.startsWith("yalp_");
  if (!hasValidPrefix || apiKey.length < 20) {
    // Still allow back-compat raw matches, but reject obviously malformed input early.
    return "";
  }
  return crypto
    .createHash("sha256")
    .update(`${apiKey}.${getPepper()}`)
    .digest("hex");
}

async function authUserIdFromApiKey(supabase: ReturnType<typeof getServiceSupabase>, apiKey: string) {
  const hash = hashApiKey(apiKey);

  // Back-compat: older keys may have been stored as raw in key_hash.
  const { data, error } = await supabase
    .from("api_keys")
    .select("user_id, id")
    .or(hash ? `key_hash.eq.${hash},key_hash.eq.${apiKey}` : `key_hash.eq.${apiKey}`)
    .maybeSingle();

  if (error || !data) return { userId: null as string | null, keyRowId: null as string | null };
  return { userId: data.user_id as string, keyRowId: data.id as string };
}

function normalizeListRef(ref: string): string {
  const t = ref.trim();
  if (!t) return "today";
  // Accept forms like: "Today", "/today", "/todo-work", "todo-work", "work"
  const cleaned = t.replace(/^\//, "").replace(/^todo-/, "").replace(/^todo\//, "").replace(/^todo_/, "");
  const withoutPrefix = cleaned.replace(/^todo-/, "");
  const slug = slugifyListTitle(withoutPrefix);
  return slug || "today";
}

/** Default capture targets map to todos with list_id = null (same as web / All). */
const INBOX_SLUGS = new Set(["today", "all", "inbox"]);

type ListRow = {
  id: string;
  title: string;
  slug: string;
  position: number;
  created_at: string;
  updated_at: string;
  user_id: string;
};

type ResolveListResult =
  | { status: "list"; row: ListRow }
  | { status: "inbox" }
  | { status: "missing" }
  | { status: "list_limit" };

async function resolveListTarget(
  supabase: ReturnType<typeof getServiceSupabase>,
  userId: string,
  input: { listId?: string | null; listSlug?: string; listTitle?: string; listRef?: string; createIfMissing?: boolean },
): Promise<ResolveListResult> {
  if (input.listId) {
    const { data } = await supabase
      .from("lists")
      .select("id, title, slug, position, created_at, updated_at, user_id")
      .eq("id", input.listId)
      .eq("user_id", userId)
      .maybeSingle();
    return data ? { status: "list", row: data as ListRow } : { status: "missing" };
  }

  const slug =
    (input.listSlug && normalizeListRef(input.listSlug)) ||
    (input.listTitle && normalizeListRef(input.listTitle)) ||
    (input.listRef && normalizeListRef(input.listRef)) ||
    "today";

  const { data: existing } = await supabase
    .from("lists")
    .select("id, title, slug, position, created_at, updated_at, user_id")
    .eq("user_id", userId)
    .eq("slug", slug)
    .maybeSingle();

  if (existing) return { status: "list", row: existing as ListRow };

  if (INBOX_SLUGS.has(slug)) {
    return { status: "inbox" };
  }

  if (!input.createIfMissing) return { status: "missing" };

  const { data: subRow } = await supabase
    .from("user_subscriptions")
    .select("plan_type, subscription_status")
    .eq("user_id", userId)
    .maybeSingle();

  const plan = (subRow?.plan_type ?? "free") as PlanType;
  const isPro = isProPlan(plan, subRow?.subscription_status ?? "inactive");

  if (!isPro) {
    const { count, error: listCountErr } = await supabase
      .from("lists")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (listCountErr) throw listCountErr;

    if ((count ?? 0) >= FREE_LIMITS.extraLists) {
      return { status: "list_limit" };
    }
  }

  const { data: maxRow } = await supabase
    .from("lists")
    .select("position")
    .eq("user_id", userId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (maxRow?.position ?? -1) + 1;
  const title = input.listTitle?.trim() || slug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

  const { data: created, error } = await supabase
    .from("lists")
    .insert({ user_id: userId, title, slug, position: nextPosition })
    .select("id, title, slug, position, created_at, updated_at, user_id")
    .single();

  if (error) throw error;
  return { status: "list", row: created as ListRow };
}

export async function POST(req: Request) {
  let supabase: ReturnType<typeof getServiceSupabase>;
  try {
    supabase = getServiceSupabase();
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Server is missing SUPABASE_SERVICE_ROLE_KEY (required for MCP API).",
      },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as unknown;
  const payload = (typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;
  const tool = String(payload.tool ?? "") as ToolName;
  const apiKey = String(payload.apiKey ?? "").trim();

  if (!apiKey) {
    return NextResponse.json({ error: "Missing apiKey." }, { status: 400 });
  }

  const { userId, keyRowId } = await authUserIdFromApiKey(supabase, apiKey);
  if (!userId || !keyRowId) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
  }

  // Best-effort last_used_at update.
  (async () => {
    try {
      await supabase
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", keyRowId);
    } catch {
      // ignore
    }
  })();

  try {
    if (tool === "list_lists") {
      const { data, error } = await supabase
        .from("lists")
        .select("*")
        .eq("user_id", userId)
        .order("position");
      if (error) throw error;
      return NextResponse.json(data ?? []);
    }

    if (tool === "create_list") {
      const title = String(payload.title ?? "").trim();
      if (!title) return NextResponse.json({ error: "Missing title." }, { status: 400 });
      const slug = normalizeListRef(title);

      const { data: subRow } = await supabase
        .from("user_subscriptions")
        .select("plan_type, subscription_status")
        .eq("user_id", userId)
        .maybeSingle();

      const plan = (subRow?.plan_type ?? "free") as PlanType;
      const isPro = isProPlan(plan, subRow?.subscription_status ?? "inactive");

      if (!isPro) {
        const { count, error: countErr } = await supabase
          .from("lists")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);

        if (countErr) throw countErr;

        if ((count ?? 0) >= FREE_LIMITS.extraLists) {
          return NextResponse.json(
            { error: "Free plan allows 1 list. Upgrade for unlimited lists." },
            { status: 403 },
          );
        }
      }

      const { data: maxRow } = await supabase
        .from("lists")
        .select("position")
        .eq("user_id", userId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextPosition = (maxRow?.position ?? -1) + 1;

      const { data, error } = await supabase
        .from("lists")
        .insert({ user_id: userId, title, slug, position: nextPosition })
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json(data);
    }

    if (tool === "resolve_list") {
      const resolved = await resolveListTarget(supabase, userId, {
        listId: (payload.listId as string | null | undefined) ?? null,
        listSlug: typeof payload.listSlug === "string" ? payload.listSlug : undefined,
        listTitle: typeof payload.listTitle === "string" ? payload.listTitle : undefined,
        listRef: typeof payload.listRef === "string" ? payload.listRef : undefined,
        createIfMissing: Boolean(payload.createIfMissing),
      });
      if (resolved.status === "missing") {
        return NextResponse.json({ error: "List not found." }, { status: 404 });
      }
      if (resolved.status === "list_limit") {
        return NextResponse.json(
          { error: "Free plan allows 1 list. Upgrade for unlimited lists." },
          { status: 403 },
        );
      }
      if (resolved.status === "inbox") {
        return NextResponse.json({
          id: null,
          slug: "inbox",
          title: "Inbox",
          user_id: userId,
          note: "Unassigned todos (same as All on web). Use list_id null when creating todos.",
        });
      }
      return NextResponse.json(resolved.row);
    }

    if (tool === "list_todos") {
      const resolved = await resolveListTarget(supabase, userId, {
        listId: (payload.listId as string | null | undefined) ?? null,
        listSlug: typeof payload.listSlug === "string" ? payload.listSlug : undefined,
        listTitle: typeof payload.listTitle === "string" ? payload.listTitle : undefined,
        listRef: typeof payload.listRef === "string" ? payload.listRef : undefined,
        createIfMissing: false,
      });
      if (resolved.status === "missing") {
        return NextResponse.json({ error: "List not found." }, { status: 404 });
      }
      if (resolved.status === "list_limit") {
        return NextResponse.json(
          { error: "Free plan allows 1 list. Upgrade for unlimited lists." },
          { status: 403 },
        );
      }

      const query = supabase.from("todos").select("*").eq("user_id", userId).order("position");
      const { data, error } =
        resolved.status === "inbox"
          ? await query.is("list_id", null)
          : await query.eq("list_id", resolved.row.id);
      if (error) throw error;
      return NextResponse.json(data ?? []);
    }

    if (tool === "create_todo") {
      const title = String(payload.title ?? "").trim();
      if (!title) return NextResponse.json({ error: "Missing title." }, { status: 400 });
      const description = payload.description == null ? null : String(payload.description);
      const resolved = await resolveListTarget(supabase, userId, {
        listId: (payload.listId as string | null | undefined) ?? null,
        listSlug: typeof payload.listSlug === "string" ? payload.listSlug : undefined,
        listTitle: typeof payload.listTitle === "string" ? payload.listTitle : undefined,
        listRef: typeof payload.listRef === "string" ? payload.listRef : undefined,
        createIfMissing: true,
      });

      if (resolved.status === "missing") {
        return NextResponse.json({ error: "List not found." }, { status: 404 });
      }
      if (resolved.status === "list_limit") {
        return NextResponse.json(
          { error: "Free plan allows 1 list. Upgrade for unlimited lists." },
          { status: 403 },
        );
      }

      const listId = resolved.status === "inbox" ? null : resolved.row.id;

      const { data: subRow } = await supabase
        .from("user_subscriptions")
        .select("plan_type, subscription_status")
        .eq("user_id", userId)
        .maybeSingle();

      const plan = (subRow?.plan_type ?? "free") as PlanType;
      const isPro = isProPlan(plan, subRow?.subscription_status ?? "inactive");

      if (!isPro) {
        const { count: totalActive, error: totalErr } = await supabase
          .from("todos")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .or("is_completed.is.null,is_completed.eq.false");

        if (totalErr) throw totalErr;

        if ((totalActive ?? 0) >= FREE_LIMITS.allListTodos) {
          return NextResponse.json(
            {
              error:
                "You've reached the 25 active todo limit on the free plan. Upgrade to add more.",
            },
            { status: 403 },
          );
        }

        if (listId) {
          const { count, error: countErr } = await supabase
            .from("todos")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("list_id", listId)
            .or("is_completed.is.null,is_completed.eq.false");

          if (countErr) throw countErr;

          if ((count ?? 0) >= FREE_LIMITS.extraListTodos) {
            return NextResponse.json(
              { error: "This list is full (10/10). Upgrade to add more todos." },
              { status: 403 },
            );
          }
        }
      }

      const { data: minAllPosRow } = await supabase
        .from("todos")
        .select("all_position")
        .eq("user_id", userId)
        .order("all_position", { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      const insertPayload: Record<string, unknown> = {
        user_id: userId,
        title,
        description,
        list_id: listId,
        source: "mcp",
        all_position: (minAllPosRow?.all_position ?? 0) - 1,
      };

      if (listId) {
        const { data: minListPosRow } = await supabase
          .from("todos")
          .select("position")
          .eq("user_id", userId)
          .eq("list_id", listId)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();
        insertPayload.position = (minListPosRow?.position ?? 0) - 1;
      } else {
        const { data: minListPosRow } = await supabase
          .from("todos")
          .select("position")
          .eq("user_id", userId)
          .is("list_id", null)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();
        insertPayload.position = (minListPosRow?.position ?? 0) - 1;
      }

      const { data, error } = await supabase.from("todos").insert(insertPayload).select("*").single();
      if (error) throw error;
      return NextResponse.json(data);
    }

    if (tool === "update_todo") {
      const id = String(payload.id ?? "").trim();
      if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
      const updates: Record<string, unknown> = {};
      if (payload.title !== undefined) updates.title = String(payload.title);
      if (payload.description !== undefined) {
        updates.description = payload.description == null ? null : String(payload.description);
      }
      if (payload.is_completed !== undefined) {
        const completed = Boolean(payload.is_completed);
        updates.is_completed = completed;
        updates.completed_at = completed ? new Date().toISOString() : null;
      }

      const { data, error } = await supabase
        .from("todos")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (error) throw error;
      return NextResponse.json(data);
    }

    if (tool === "delete_todo") {
      const id = String(payload.id ?? "").trim();
      if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
      const { error } = await supabase.from("todos").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown tool." }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error." },
      { status: 500 },
    );
  }
}

