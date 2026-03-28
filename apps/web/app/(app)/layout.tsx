import { createClient } from "@/lib/supabase/server";
import { PRODUCT_HOME } from "@/lib/routes";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "./app-header";
import { ListsProvider } from "./lists-shell";
import { SubscriptionProvider, type SubscriptionSnapshot, type UsageSnapshot } from "@/hooks/useSubscription";

const SHOULD_DEBUG_INGEST = process.env.NODE_ENV !== "production" && process.env.DEBUG_INGEST === "true";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // #region debug auth redirect next
    if (SHOULD_DEBUG_INGEST) {
      await fetch("http://127.0.0.1:7553/ingest/d34f2416-bf5f-42a3-84ba-50ccb0574dd2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "f7ebea",
        },
        body: JSON.stringify({
          sessionId: "f7ebea",
          runId: "pre-fix",
          hypothesisId: "H1-layout-redirect-next",
          location: "apps/web/app/(app)/layout.tsx",
          message: "Unauthenticated redirect from (app) layout",
          data: { productHome: PRODUCT_HOME },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion

    redirect(`/login?next=${encodeURIComponent(PRODUCT_HOME)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const { data: listRows } = await supabase
    .from("lists")
    .select("id, title, slug, position")
    .eq("user_id", user.id)
    .order("position", { ascending: true });

  const { data: todoListIds } = await supabase
    .from("todos")
    .select("list_id, is_completed")
    .eq("user_id", user.id);

  const activeTodos = (todoListIds ?? []).filter((t) => t.is_completed !== true);
  const allCount = activeTodos.length;
  const byListId: Record<string, number> = {};
  for (const row of activeTodos) {
    if (row.list_id) byListId[row.list_id] = (byListId[row.list_id] ?? 0) + 1;
  }

  /** Inbox: active todos not assigned to a list (captures from / All). */
  const allListTodosCount = activeTodos.filter((t) => t.list_id == null).length;
  const lists = listRows ?? [];
  const extraListsCount = lists.length;
  const maxExtraListTodosCount =
    lists.length === 0 ? 0 : Math.max(...lists.map((l) => byListId[l.id] ?? 0));

  const { data: subRow } = await supabase
    .from("user_subscriptions")
    .select("plan_type, subscription_status, current_period_end, cancel_at_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  const initialSubscription: SubscriptionSnapshot = {
    plan: (subRow?.plan_type ?? "free") as SubscriptionSnapshot["plan"],
    subscription_status: subRow?.subscription_status ?? "inactive",
    current_period_end: subRow?.current_period_end ?? null,
    cancel_at_period_end: subRow?.cancel_at_period_end ?? false,
  };

  const initialUsage: UsageSnapshot = {
    totalActiveTodosCount: allCount,
    allListTodosCount,
    extraListsCount,
    maxExtraListTodosCount,
    activeTodosByListId: byListId,
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#fafafa]">
      <SubscriptionProvider initialSubscription={initialSubscription} initialUsage={initialUsage}>
        <AppHeader
          initialProfile={{
            fullName: profile?.full_name ?? "",
            avatarUrl: profile?.avatar_url ?? null,
          }}
          userEmail={user.email ?? null}
        />
        <ListsProvider lists={listRows ?? []} counts={{ all: allCount, byListId }}>
          <div className="flex flex-1 flex-col px-4 pb-24 pt-2 sm:px-6">{children}</div>
        </ListsProvider>
      </SubscriptionProvider>
    </div>
  );
}
