"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_HOME } from "@/lib/routes";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isServerDebugIngestEnabled, sendDebugIngest } from "@/lib/debug-ingest";
import { getSiteUrl } from "@/lib/site-url";
import { sanitizeInternalNextPath } from "@/lib/auth/redirect";
import { getPostHogClient } from "@/lib/posthog";

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createSupabaseClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "http";
  // Prefer configured canonical origin in production so auth cookies/callbacks
  // do not bounce between apex/www hosts.
  const configured = getSiteUrl();
  if (configured.startsWith("https://")) {
    return configured;
  }
  if (host) {
    return `${protocol}://${host}`;
  }
  return configured;
}

export type AuthActionState = {
  error?: string;
  success?: string;
  fields?: Partial<Record<"email" | "password" | "confirmPassword" | "name", string>>;
  fieldErrors?: Partial<
    Record<"email" | "password" | "confirmPassword" | "name", string>
  >;
} | null;

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Please enter your email and password.", fields: { email } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("invalid login credentials")) {
      return {
        error:
          "Email or password is incorrect. If you just signed up, your confirmation email may be delayed — try Google for instant access.",
        fields: { email },
      };
    }
    return { error: error.message, fields: { email } };
  }

  const { data: { user: loggedInUser } } = await supabase.auth.getUser();
  if (loggedInUser) {
    const posthog = getPostHogClient();
    posthog.identify({
      distinctId: loggedInUser.id,
      properties: {
        $set: { email: loggedInUser.email },
      },
    });
    posthog.capture({
      distinctId: loggedInUser.id,
      event: "user_logged_in",
      properties: { method: "email" },
    });
  }

  const nextRaw = String(formData.get("next") ?? "").trim();
  const next = sanitizeInternalNextPath(nextRaw, PRODUCT_HOME);
  // #region debug login action next
  if (isServerDebugIngestEnabled()) {
    await sendDebugIngest({
      sessionId: "f7ebea",
      runId: "pre-fix",
      hypothesisId: "H3-loginAction-next",
      location: "apps/web/app/(auth)/actions.ts",
      message: "Login action selecting next redirect",
      data: { nextRaw, next },
      timestamp: Date.now(),
    });
  }
  // #endregion
  redirect(next);
}

export async function signInWithGoogleAction(formData: FormData) {
  const supabase = await createClient();
  const origin = await getRequestOrigin();
  const next = sanitizeInternalNextPath(String(formData.get("next") ?? ""), PRODUCT_HOME);
  const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl,
    },
  });

  if (error || !data?.url) {
    redirect(`/login?error=auth&next=${encodeURIComponent(next)}`);
  }

  redirect(data.url);
}

export async function signupAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!name || !email || !password || !confirmPassword) {
    return {
      error: "Please fill in all fields.",
      fields: { name, email },
    };
  }

  if (password !== confirmPassword) {
    return {
      fieldErrors: { confirmPassword: "Passwords do not match." },
      fields: { name, email },
    };
  }

  if (password.length < 6) {
    return {
      fieldErrors: { password: "Password must be at least 6 characters." },
      fields: { name, email },
    };
  }

  const supabase = await createClient();
  const origin = await getRequestOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    const message = error.message || "Could not create your account. Please try again.";
    const lower = message.toLowerCase();
    if (lower.includes("rate limit") || lower.includes("over_email_send_rate_limit")) {
      // Fallback: when inbuilt SMTP is throttled, provision user with service role
      // and sign in immediately so users are not blocked by email throughput limits.
      const admin = getServiceRoleClient();
      if (admin) {
        const { data: existingUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const existing = existingUsers?.users?.find(
          (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
        );

        if (!existing) {
          const { error: createErr } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: name },
          });
          if (createErr) {
            return {
              error:
                "Email signup is temporarily limited. Please retry in a few minutes or use Continue with Google.",
              fields: { name, email },
            };
          }
        }

        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (!signInErr) {
          redirect(PRODUCT_HOME);
        }
      }

      return {
        error:
          "Email signup is temporarily limited. Please retry in a few minutes or use Continue with Google.",
        fields: { name, email },
      };
    }
    const emailFieldError =
      lower.includes("email") && (lower.includes("invalid") || lower.includes("invalid format"))
        ? message
        : undefined;

    return emailFieldError
      ? { fieldErrors: { email: emailFieldError }, fields: { name, email } }
      : { error: message, fields: { name, email } };
  }

  if (data.session) {
    if (data.user) {
      const posthog = getPostHogClient();
      posthog.identify({
        distinctId: data.user.id,
        properties: {
          $set: { email: data.user.email, name },
          $set_once: { first_seen_at: new Date().toISOString() },
        },
      });
      posthog.capture({
        distinctId: data.user.id,
        event: "user_signed_up",
        properties: { method: "email" },
      });
    }
    redirect(PRODUCT_HOME);
  }

  if (data.user) {
    const posthog = getPostHogClient();
    posthog.identify({
      distinctId: data.user.id,
      properties: {
        $set: { email: data.user.email, name },
        $set_once: { first_seen_at: new Date().toISOString() },
      },
    });
    posthog.capture({
      distinctId: data.user.id,
      event: "user_signed_up",
      properties: { method: "email", email_confirmation_required: true },
    });
  }

  return {
    success:
      "Check your email to confirm your account, then sign in.",
  };
}
