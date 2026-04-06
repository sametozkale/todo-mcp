import { beforeEach, describe, expect, it, vi } from "vitest";

const authUserIdFromApiKeyMock = vi.fn();
const executeMcpToolMock = vi.fn();
const touchApiKeyLastUsedMock = vi.fn();

vi.mock("@/lib/server/mcp-tools", () => ({
  getServiceSupabase: () => ({}) as object,
  authUserIdFromApiKey: (...args: unknown[]) => authUserIdFromApiKeyMock(...args),
  executeMcpTool: (...args: unknown[]) => executeMcpToolMock(...args),
  touchApiKeyLastUsed: (...args: unknown[]) => touchApiKeyLastUsedMock(...args),
  isToolName: (value: string) => value === "create_todo" || value === "list_todos",
  MCP_PROTOCOL_VERSION: "2024-11-05",
  MCP_REMOTE_TOOL_LIST: [
    {
      name: "create_todo",
      description: "Create a new todo for the authenticated user",
      inputSchema: { type: "object" },
    },
    {
      name: "list_todos",
      description: "List todos for the authenticated user",
      inputSchema: { type: "object" },
    },
  ],
}));

describe("mcp stream route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUserIdFromApiKeyMock.mockResolvedValue({ userId: "u1", keyRowId: "k1" });
    executeMcpToolMock.mockResolvedValue({ status: 200, body: { ok: true } });
  });

  it("returns initialize capabilities", async () => {
    const mod = await import("@/app/api/mcp/stream/route");
    const req = new Request("https://yalp.work/api/mcp/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05" },
      }),
    });

    const res = await mod.POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result?.capabilities?.tools).toEqual({});
    expect(body.result?.serverInfo?.name).toBe("yalp");
  });

  it("allows tools/list without auth", async () => {
    const mod = await import("@/app/api/mcp/stream/route");
    const req = new Request("https://yalp.work/api/mcp/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });

    const res = await mod.POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result?.tools?.map((t: { name: string }) => t.name)).toEqual(["create_todo", "list_todos"]);
    expect(authUserIdFromApiKeyMock).not.toHaveBeenCalled();
  });

  it("returns auth guidance when tools/call has no auth", async () => {
    const mod = await import("@/app/api/mcp/stream/route");
    const req = new Request("https://yalp.work/api/mcp/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "create_todo", arguments: { title: "Buy milk" } },
      }),
    });

    const res = await mod.POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(String(body.error?.message ?? "")).toContain("Unauthorized");
    expect(res.headers.get("WWW-Authenticate")).toContain("Bearer");
  });

  it("returns invalid key error for bad auth", async () => {
    authUserIdFromApiKeyMock.mockResolvedValueOnce({ userId: null, keyRowId: null });
    const mod = await import("@/app/api/mcp/stream/route");
    const req = new Request("https://yalp.work/api/mcp/stream", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer yalp_invalid_key_1234567890",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "create_todo", arguments: { title: "Buy milk" } },
      }),
    });

    const res = await mod.POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(String(body.error?.message ?? "")).toContain("Invalid API key");
    expect(res.headers.get("WWW-Authenticate")).toContain("Bearer");
  });
});
