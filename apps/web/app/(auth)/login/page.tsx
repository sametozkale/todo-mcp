import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { isServerDebugIngestEnabled, sendDebugIngest } from "@/lib/debug-ingest";
import { withSocialImage } from "@/lib/seo-metadata";

const title = "Log in to Yalp";
const description =
  "Sign in to manage your tasks, lists, and MCP connections. Secure access to your Yalp workspace.";

export const metadata: Metadata = withSocialImage({
  title: "Log in",
  description,
  alternates: { canonical: "/login" },
  openGraph: {
    title,
    description,
    url: "/login",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
});

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;

  // #region debug login page searchParams
  if (isServerDebugIngestEnabled()) {
    await sendDebugIngest({
      sessionId: "f7ebea",
      runId: "login-searchparams-debug",
      hypothesisId: "H7-login-page-next-param",
      location: "apps/web/app/(auth)/login/page.tsx",
      message: "Login page received searchParams",
      data: { error: params.error, next: params.next },
      timestamp: Date.now(),
    });
  }
  // #endregion

  return <LoginForm searchParamsError={params.error} nextPath={params.next} />;
}
