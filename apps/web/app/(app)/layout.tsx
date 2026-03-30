import { PRODUCT_HOME } from "@/lib/routes";
import { SubscriptionProvider, type SubscriptionSnapshot, type UsageSnapshot } from "@/hooks/useSubscription";
import { isServerDebugIngestEnabled, sendDebugIngest } from "@/lib/debug-ingest";
import { getCachedAuth } from "@/lib/supabase/cached-auth";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "./app-header";
import { ListsProvider } from "./lists-shell";
import { WeatherClockWidget } from "./weather-clock-widget";

/** Authenticated app shell: not intended for search indexing (see app/robots.ts). */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { supabase, user } = await getCachedAuth();

  if (!user) {
    // #region debug auth redirect next
    if (isServerDebugIngestEnabled()) {
      await sendDebugIngest({
        sessionId: "f7ebea",
        runId: "pre-fix",
        hypothesisId: "H1-layout-redirect-next",
        location: "apps/web/app/(app)/layout.tsx",
        message: "Unauthenticated redirect from (app) layout",
        data: { productHome: PRODUCT_HOME },
        timestamp: Date.now(),
      });
    }
    // #endregion

    redirect(`/login?next=${encodeURIComponent(PRODUCT_HOME)}`);
  }

  const [{ data: profile }, { data: listRows }, { data: todoListIds }, { data: subRow }] =
    await Promise.all([
      supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle(),
      supabase
        .from("lists")
        .select("id, title, slug, position")
        .eq("user_id", user.id)
        .order("position", { ascending: true }),
      supabase.from("todos").select("list_id, is_completed").eq("user_id", user.id),
      supabase
        .from("user_subscriptions")
        .select("plan_type, subscription_status, current_period_end, cancel_at_period_end")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

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
        <WeatherClockWidget />
      </SubscriptionProvider>
    </div>
  );
}
