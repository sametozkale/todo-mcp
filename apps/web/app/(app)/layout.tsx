import { createClient } from "@/lib/supabase/server";
import { PRODUCT_HOME } from "@/lib/routes";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppHeader } from "./app-header";
import { ListsProvider } from "./lists-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // #region debug auth redirect next
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
    .select("list_id")
    .eq("user_id", user.id);

  const allCount = todoListIds?.length ?? 0;
  const byListId: Record<string, number> = {};
  for (const row of todoListIds ?? []) {
    if (row.list_id) {
      byListId[row.list_id] = (byListId[row.list_id] ?? 0) + 1;
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#fafafa]">
      <AppHeader
        initialProfile={{
          fullName: profile?.full_name ?? "",
          avatarUrl: profile?.avatar_url ?? null,
        }}
        userEmail={user.email ?? null}
      />
      <ListsProvider
        lists={listRows ?? []}
        counts={{ all: allCount, byListId }}
      >
        <div className="flex flex-1 flex-col px-4 pb-8 pt-2 sm:px-6">{children}</div>
      </ListsProvider>
    </div>
  );
}
