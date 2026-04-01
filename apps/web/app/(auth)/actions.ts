"use server";

import { createClient } from "@/lib/supabase/server";
import { PRODUCT_HOME } from "@/lib/routes";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isServerDebugIngestEnabled, sendDebugIngest } from "@/lib/debug-ingest";
import { getSiteUrl } from "@/lib/site-url";
import { sanitizeInternalNextPath } from "@/lib/auth/redirect";

async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "http";
  if (host) {
    return `${protocol}://${host}`;
  }
  return getSiteUrl();
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
    return { error: error.message, fields: { email } };
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
    const emailFieldError =
      lower.includes("email") && (lower.includes("invalid") || lower.includes("invalid format"))
        ? message
        : undefined;

    return emailFieldError
      ? { fieldErrors: { email: emailFieldError }, fields: { name, email } }
      : { error: message, fields: { name, email } };
  }

  if (data.session) {
    redirect(PRODUCT_HOME);
  }

  return {
    success:
      "Check your email to confirm your account, then sign in.",
  };
}
