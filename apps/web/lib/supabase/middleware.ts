import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublicRoute =
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/auth/callback") ||
    // MCP endpoint uses API key auth (not Supabase session cookies).
    path.startsWith("/api/mcp");

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
    await fetch("http://127.0.0.1:7553/ingest/d34f2416-bf5f-42a3-84ba-50ccb0574dd2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "f7ebea",
      },
      body: JSON.stringify({
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
      }),
    }).catch(() => {});

    user = null;
    // #endregion
  }

  // #region debug middleware user state
  if (path === "/today" || path === "/login") {
    await fetch("http://127.0.0.1:7553/ingest/d34f2416-bf5f-42a3-84ba-50ccb0574dd2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "f7ebea",
      },
      body: JSON.stringify({
        sessionId: "f7ebea",
        runId: "login-debug-user-state",
        hypothesisId: "H6-middleware-user-state",
        location: "apps/web/lib/supabase/middleware.ts",
        message: "Middleware resolved user state",
        data: { path, isPublicRoute, userPresent: Boolean(user) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion

  if (!user && !isPublicRoute) {
    // #region debug middleware redirect next
    await fetch("http://127.0.0.1:7553/ingest/d34f2416-bf5f-42a3-84ba-50ccb0574dd2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "f7ebea",
      },
      body: JSON.stringify({
        sessionId: "f7ebea",
        runId: "pre-fix",
        hypothesisId: "H2-middleware-redirect-next",
        location: "apps/web/lib/supabase/middleware.ts",
        message: "Unauthenticated redirect from middleware (protected route)",
        data: { path, isProtectedRoute: true, loginNext: path },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
