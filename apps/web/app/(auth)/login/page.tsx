import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in — Flowdo",
  description: "Sign in to your Flowdo account.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;

  // #region debug login page searchParams
  await fetch("http://127.0.0.1:7553/ingest/d34f2416-bf5f-42a3-84ba-50ccb0574dd2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "f7ebea",
    },
    body: JSON.stringify({
      sessionId: "f7ebea",
      runId: "login-searchparams-debug",
      hypothesisId: "H7-login-page-next-param",
      location: "apps/web/app/(auth)/login/page.tsx",
      message: "Login page received searchParams",
      data: { error: params.error, next: params.next },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return <LoginForm searchParamsError={params.error} nextPath={params.next} />;
}
