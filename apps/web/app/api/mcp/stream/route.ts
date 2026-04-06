import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  authUserIdFromApiKey,
  executeMcpTool,
  getServiceSupabase,
  isToolName,
  MCP_PROTOCOL_VERSION,
  MCP_REMOTE_TOOL_LIST,
  touchApiKeyLastUsed,
  type ToolName,
} from "@/lib/server/mcp-tools";

const SERVER_NAME = "yalp";
const SERVER_VERSION = "0.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, X-Api-Key, Api-Key, Mcp-Session-Id, Accept",
  "Access-Control-Max-Age": "86400",
};

function jsonRpcSuccess(id: string | number | null, result: unknown) {
  return { jsonrpc: "2.0" as const, id, result };
}

function jsonRpcError(id: string | number | null, code: number, message: string, data?: unknown) {
  return {
    jsonrpc: "2.0" as const,
    id,
    error: data !== undefined ? { code, message, data } : { code, message },
  };
}

function normalizeApiKey(raw: string | null): string | null {
  if (!raw) return null;
  let v = raw.trim();
  if (!v) return null;
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  if (!v) return null;
  if (v.toLowerCase().startsWith("bearer ")) {
    const token = v.slice(7).trim();
    return token || null;
  }
  return v;
}

function parseBearerApiKey(req: Request): string | null {
  const auth = req.headers.get("authorization");
  const authToken = normalizeApiKey(auth);
  if (authToken) return authToken;

  for (const name of ["x-api-key", "api-key"]) {
    const xToken = normalizeApiKey(req.headers.get(name));
    if (xToken) return xToken;
  }

  return null;
}

function mergeCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(corsHeaders)) {
    res.headers.set(k, v);
  }
  return res;
}

export function OPTIONS() {
  return mergeCors(new NextResponse(null, { status: 204 }));
}

export function GET() {
  return mergeCors(
    NextResponse.json(
      {
        ok: true,
        service: SERVER_NAME,
        transport: "mcp-stream-http",
        protocolVersion: MCP_PROTOCOL_VERSION,
        methods: ["initialize", "notifications/initialized", "ping", "tools/list", "tools/call"],
        auth: {
          requiredFor: ["tools/call"],
          optionalFor: ["initialize", "notifications/initialized", "ping", "tools/list"],
          accepted: [
            "Authorization: Bearer <yalp_api_key>",
            "X-Api-Key: <yalp_api_key>",
            "Api-Key: <yalp_api_key>",
          ],
        },
        compatibilityChecklist: [
          "Use POST with JSON-RPC 2.0 payload",
          "Use URL ending with /api/mcp/stream",
          "Send Bearer or X-Api-Key for tools/call",
        ],
        hint: "POST JSON-RPC 2.0 messages. tools/list is public metadata; tools/call requires auth.",
      },
      { status: 200 },
    ),
  );
}

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
};

async function handleJsonRpc(
  req: Request,
  supabase: ReturnType<typeof getServiceSupabase>,
  rpc: JsonRpcRequest,
): Promise<{
  status: number;
  body: unknown;
  isNotification: boolean;
  addBearerAuthHint?: boolean;
}> {
  const isNotification = !("id" in rpc);

  if (rpc.jsonrpc !== "2.0") {
    if (isNotification) return { status: 204, body: null, isNotification: true };
    return {
      status: 400,
      body: jsonRpcError(rpc.id ?? null, -32600, "Invalid Request"),
      isNotification: false,
    };
  }

  const method = rpc.method ?? "";
  const id = rpc.id ?? null;

  if (method.startsWith("notifications/")) {
    if (isNotification) return { status: 204, body: null, isNotification: true };
    return {
      status: 200,
      body: jsonRpcSuccess(id, null),
      isNotification: false,
    };
  }

  if (method === "ping") {
    return {
      status: 200,
      body: jsonRpcSuccess(id, {}),
      isNotification: false,
    };
  }

  if (method === "initialize") {
    const params = (typeof rpc.params === "object" && rpc.params !== null ? rpc.params : {}) as Record<
      string,
      unknown
    >;
    const clientProtocol = typeof params.protocolVersion === "string" ? params.protocolVersion : undefined;
    return {
      status: 200,
      body: jsonRpcSuccess(id, {
        protocolVersion: clientProtocol ?? MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION,
        },
      }),
      isNotification: false,
    };
  }

  if (method === "tools/list") {
    return {
      status: 200,
      body: jsonRpcSuccess(id, {
        tools: MCP_REMOTE_TOOL_LIST.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      }),
      isNotification: false,
    };
  }

  const apiKey = parseBearerApiKey(req);
  if (!apiKey) {
    return {
      status: 200,
      body: jsonRpcError(
        id,
        -32000,
        "Unauthorized: send Authorization: Bearer <yalp_api_key>, X-Api-Key, or Api-Key.",
      ),
      isNotification: false,
      addBearerAuthHint: true,
    };
  }

  const { userId, keyRowId } = await authUserIdFromApiKey(supabase, apiKey);
  if (!userId || !keyRowId) {
    return {
      status: 200,
      body: jsonRpcError(id, -32000, "Invalid API key."),
      isNotification: false,
      addBearerAuthHint: true,
    };
  }

  touchApiKeyLastUsed(supabase, keyRowId);

  if (method === "tools/call") {
    const params = (typeof rpc.params === "object" && rpc.params !== null ? rpc.params : null) as Record<
      string,
      unknown
    > | null;
    if (!params) {
      return {
        status: 200,
        body: jsonRpcError(id, -32602, "Invalid params: expected object with name and arguments."),
        isNotification: false,
      };
    }
    const nameRaw = typeof params.name === "string" ? params.name : "";
    const rawArgs = params.arguments;
    if (rawArgs !== undefined && (typeof rawArgs !== "object" || rawArgs === null || Array.isArray(rawArgs))) {
      return {
        status: 200,
        body: jsonRpcError(id, -32602, "Invalid params.arguments: expected an object."),
        isNotification: false,
      };
    }
    const args = (rawArgs as Record<string, unknown> | undefined) ?? {};

    if (!isToolName(nameRaw)) {
      return {
        status: 200,
        body: jsonRpcError(id, -32602, `Unknown tool: ${nameRaw || "(empty)"}.`),
        isNotification: false,
      };
    }

    const tool = nameRaw as ToolName;
    const cleanArgs = { ...args };
    delete cleanArgs.apiKey;
    delete cleanArgs.tool;
    const exec = await executeMcpTool(supabase, userId, tool, cleanArgs);

    if (exec.status >= 200 && exec.status < 300) {
      const text =
        typeof exec.body === "string" ? exec.body : JSON.stringify(exec.body, null, 2);
      return {
        status: 200,
        body: jsonRpcSuccess(id, {
          content: [{ type: "text", text }],
          isError: false,
        }),
        isNotification: false,
      };
    }

    const errBody = exec.body as { error?: string } | null;
    const msg =
      typeof errBody === "object" && errBody !== null && typeof errBody.error === "string"
        ? errBody.error
        : `Request failed (${exec.status})`;
    const text = JSON.stringify({ status: exec.status, error: msg }, null, 2);
    return {
      status: 200,
      body: jsonRpcSuccess(id, {
        content: [{ type: "text", text }],
        isError: true,
      }),
      isNotification: false,
    };
  }

  return {
    status: 200,
    body: jsonRpcError(id, -32601, `Method not found: ${method || "(empty)"}.`),
    isNotification: false,
  };
}

export async function POST(req: Request) {
  let supabase: ReturnType<typeof getServiceSupabase>;
  try {
    supabase = getServiceSupabase();
  } catch (err: unknown) {
    return mergeCors(
      NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32603,
            message: err instanceof Error ? err.message : "Server configuration error (MCP unavailable).",
          },
        },
        { status: 503 },
      ),
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return mergeCors(
      NextResponse.json(jsonRpcError(null, -32700, "Parse error"), { status: 400 }),
    );
  }

  if (Array.isArray(raw)) {
    return mergeCors(
      NextResponse.json(jsonRpcError(null, -32600, "Batch requests are not supported."), { status: 400 }),
    );
  }

  if (typeof raw !== "object" || raw === null) {
    return mergeCors(NextResponse.json(jsonRpcError(null, -32600, "Invalid Request"), { status: 400 }));
  }

  const out = await handleJsonRpc(req, supabase, raw as JsonRpcRequest);
  if (out.isNotification) {
    const empty = mergeCors(new NextResponse(null, { status: 204 }));
    const sessionId = req.headers.get("mcp-session-id") ?? crypto.randomUUID();
    empty.headers.set("Mcp-Session-Id", sessionId);
    return empty;
  }

  const response = mergeCors(NextResponse.json(out.body, { status: out.status }));
  const sessionId = req.headers.get("mcp-session-id") ?? crypto.randomUUID();
  response.headers.set("Mcp-Session-Id", sessionId);
  if (out.addBearerAuthHint) {
    response.headers.set("WWW-Authenticate", 'Bearer realm="yalp", error="invalid_token"');
  }
  return response;
}
