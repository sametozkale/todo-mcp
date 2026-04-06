import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

const headersMock = vi.fn(async () => ({
  get: (key: string) => {
    if (key === "x-forwarded-host") return "www.yalp.work";
    if (key === "x-forwarded-proto") return "https";
    return null;
  },
}));

const createClientMock = vi.fn();
const createSupabaseClientMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createSupabaseClientMock(...args),
}));

vi.mock("@/lib/site-url", async () => {
  const actual = await vi.importActual<object>("@/lib/site-url");
  return {
    ...actual,
    getSiteUrl: () => "https://yalp.work",
  };
});

describe("auth server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    headersMock.mockImplementation(async () => ({
      get: (key: string) => {
        if (key === "x-forwarded-host") return "www.yalp.work";
        if (key === "x-forwarded-proto") return "https";
        return null;
      },
    }));
  });

  it("maps invalid credentials to a user-friendly login message", async () => {
    createClientMock.mockResolvedValueOnce({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValueOnce({
          error: { message: "Invalid login credentials" },
        }),
      },
    });

    const { loginAction } = await import("@/app/(auth)/actions");
    const form = new FormData();
    form.set("email", "person@example.com");
    form.set("password", "wrong-password");

    const state = await loginAction(null, form);
    expect(state?.error).toContain("Email or password is incorrect");
  });

  it("maps signup email rate-limit errors to retry guidance", async () => {
    createClientMock.mockResolvedValueOnce({
      auth: {
        signUp: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { message: "over_email_send_rate_limit: too many emails" },
        }),
      },
    });

    const { signupAction } = await import("@/app/(auth)/actions");
    const form = new FormData();
    form.set("name", "Test User");
    form.set("email", "test@example.com");
    form.set("password", "password123");
    form.set("confirmPassword", "password123");

    const state = await signupAction(null, form);
    expect(state?.error).toContain("Email signup is temporarily limited");
  });

  it("falls back to service-role provisioning on email rate-limit and logs user in", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    const signInWithPassword = vi.fn().mockResolvedValueOnce({ error: null });
    createClientMock.mockResolvedValueOnce({
      auth: {
        signUp: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { message: "over_email_send_rate_limit" },
        }),
        signInWithPassword,
      },
    });

    const listUsers = vi.fn().mockResolvedValueOnce({ data: { users: [] } });
    const createUser = vi.fn().mockResolvedValueOnce({ error: null });
    createSupabaseClientMock.mockReturnValueOnce({
      auth: { admin: { listUsers, createUser } },
    });

    const { signupAction } = await import("@/app/(auth)/actions");
    const form = new FormData();
    form.set("name", "Test User");
    form.set("email", "test@example.com");
    form.set("password", "password123");
    form.set("confirmPassword", "password123");

    await expect(signupAction(null, form)).rejects.toThrow("REDIRECT:/all");
    expect(createUser).toHaveBeenCalledTimes(1);
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
  });

  it("uses canonical callback origin for Google OAuth redirectTo", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValueOnce({
      data: { url: "https://accounts.google.com/some-flow" },
      error: null,
    });
    createClientMock.mockResolvedValueOnce({
      auth: {
        signInWithOAuth,
      },
    });

    const { signInWithGoogleAction } = await import("@/app/(auth)/actions");
    const form = new FormData();
    form.set("next", "/all");

    await expect(signInWithGoogleAction(form)).rejects.toThrow(
      "REDIRECT:https://accounts.google.com/some-flow",
    );

    expect(signInWithOAuth).toHaveBeenCalledTimes(1);
    const arg = signInWithOAuth.mock.calls[0][0];
    expect(arg.options.redirectTo).toBe("https://yalp.work/auth/callback?next=%2Fall");
  });
});
