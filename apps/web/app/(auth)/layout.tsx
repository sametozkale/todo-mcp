import { createClient } from "@/lib/supabase/server";
import { PRODUCT_HOME } from "@/lib/routes";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  let user: { id: string } | null = null;
  try {
    const supabase = await createClient();
    try {
      const res = await supabase.auth.getUser();
      user = res.data.user as { id: string } | null;
    } catch (err) {
      // #region debug auth layout getUser error
      await fetch("http://127.0.0.1:7553/ingest/d34f2416-bf5f-42a3-84ba-50ccb0574dd2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "f7ebea",
        },
        body: JSON.stringify({
          sessionId: "f7ebea",
          runId: "login-error",
          hypothesisId: "H8-auth-layout-getUser-error",
          location: "apps/web/app/(auth)/layout.tsx",
          message: "supabase.auth.getUser failed in auth layout",
          data: {
            errorName: err instanceof Error ? err.name : typeof err,
            errorMessage: err instanceof Error ? err.message : String(err),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      user = null;
      // #endregion
    }
  } catch (err) {
    // #region debug auth layout createClient error
    await fetch("http://127.0.0.1:7553/ingest/d34f2416-bf5f-42a3-84ba-50ccb0574dd2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "f7ebea",
      },
      body: JSON.stringify({
        sessionId: "f7ebea",
        runId: "login-error",
        hypothesisId: "H9-auth-layout-createClient-error",
        location: "apps/web/app/(auth)/layout.tsx",
        message: "createClient() failed in auth layout",
        data: {
          errorName: err instanceof Error ? err.name : typeof err,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    user = null;
    // #endregion
  }

  if (user) {
    redirect(PRODUCT_HOME);
  }

  return (
    <div className="min-h-dvh overflow-y-auto bg-[#fafafa]">
      <div className="flex min-h-dvh flex-col bg-white p-4 pt-10">{children}</div>
    </div>
  );
}
