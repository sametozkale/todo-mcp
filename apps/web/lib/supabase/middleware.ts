import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isServerDebugIngestEnabled, sendDebugIngest } from "@/lib/debug-ingest";

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublicRoute =
    path === "/" ||
    path.startsWith("/why-i-built") ||
    path.startsWith("/roadmap") ||
    path.startsWith("/changelog") ||
    path.startsWith("/students") ||
    path.startsWith("/privacy") ||
    path.startsWith("/terms") ||
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/auth/callback") ||
    path.startsWith("/oauth") ||
    path.startsWith("/.well-known") ||
    path.startsWith("/api/oauth") ||
    path.startsWith("/api/downloads") ||
    // Debug endpoints should be reachable without auth.
    path.startsWith("/api/debug") ||
    // MCP endpoint uses API key auth (not Supabase session cookies).
    path.startsWith("/api/mcp") ||
    // Stripe webhooks: verified with stripe-signature + STRIPE_WEBHOOK_SECRET (no user session).
    path.startsWith("/api/stripe/webhook");

  // Public routes should never be blocked by middleware/auth provider issues.
  // If Supabase is temporarily unavailable/misconfigured, we still want the login page to render.
  if (isPublicRoute) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  let user = null as { id: string } | null;

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch (err) {
    // #region debug middleware getUser error
    if (isServerDebugIngestEnabled()) {
      await sendDebugIngest({
        sessionId: "f7ebea",
        runId: "login-error",
        hypothesisId: "H5-middleware-getUser-error",
        location: "apps/web/lib/supabase/middleware.ts",
        message: "supabase.auth.getUser failed in middleware",
        data: {
          errorName: err instanceof Error ? err.name : typeof err,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
        timestamp: Date.now(),
      });
    }

    user = null;
    // #endregion
  }

  // #region debug middleware user state
  if (path === "/today" || path === "/login") {
    if (isServerDebugIngestEnabled()) {
      await sendDebugIngest({
        sessionId: "f7ebea",
        runId: "login-debug-user-state",
        hypothesisId: "H6-middleware-user-state",
        location: "apps/web/lib/supabase/middleware.ts",
        message: "Middleware resolved user state",
        data: { path, isPublicRoute, userPresent: Boolean(user) },
        timestamp: Date.now(),
      });
    }
  }
  // #endregion

  if (!user && !isPublicRoute) {
    // #region debug middleware redirect next
    if (isServerDebugIngestEnabled()) {
      await sendDebugIngest({
        sessionId: "f7ebea",
        runId: "pre-fix",
        hypothesisId: "H2-middleware-redirect-next",
        location: "apps/web/lib/supabase/middleware.ts",
        message: "Unauthenticated redirect from middleware (protected route)",
        data: { path, isProtectedRoute: true, loginNext: path },
        timestamp: Date.now(),
      });
    }
    // #endregion

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
