import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSessionMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      exchangeCodeForSession: exchangeCodeForSessionMock,
    },
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: () => undefined,
  }),
}));

vi.mock("@/lib/site-url", async () => {
  const actual = await vi.importActual<object>("@/lib/site-url");
  return {
    ...actual,
    getSiteUrl: () => "https://yalp.work",
  };
});

describe("auth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects successful code exchange to canonical host and sanitized next path", async () => {
    exchangeCodeForSessionMock.mockResolvedValueOnce({ error: null });
    const { GET } = await import("@/app/auth/callback/route");

    const res = await GET(new Request("https://www.yalp.work/auth/callback?code=abc&next=%2Fall"));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("location")).toBe("https://yalp.work/all");
  });

  it("redirects failures to canonical login error route", async () => {
    exchangeCodeForSessionMock.mockResolvedValueOnce({ error: { message: "invalid code" } });
    const { GET } = await import("@/app/auth/callback/route");

    const res = await GET(new Request("https://www.yalp.work/auth/callback?code=bad"));
    expect(res.headers.get("location")).toBe("https://yalp.work/login?error=auth");
  });
});
