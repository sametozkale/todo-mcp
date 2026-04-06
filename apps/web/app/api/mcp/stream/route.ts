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
import { authUserIdFromOAuthAccessToken } from "@/lib/server/oauth-token-service";
import { getMcpResourceUrl, getOAuthIssuerBase, OAUTH_ACCESS_TOKEN_PREFIX } from "@/lib/server/oauth-internal";

const SERVER_NAME = "yalp";
const SERVER_VERSION = "0.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  /** HEAD: some MCP / health probes use HEAD before POST. */
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
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

type McpAuthContext =
  | { kind: "api_key"; userId: string; keyRowId: string }
  | { kind: "oauth"; userId: string; tokenRowId: string };

async function resolveMcpAuth(
  req: Request,
  supabase: ReturnType<typeof getServiceSupabase>,
): Promise<McpAuthContext | null> {
  const auth = normalizeApiKey(req.headers.get("authorization"));
  const xApi = normalizeApiKey(req.headers.get("x-api-key"));
  const apiHdr = normalizeApiKey(req.headers.get("api-key"));

  if (auth?.startsWith(OAUTH_ACCESS_TOKEN_PREFIX)) {
    const { userId, tokenRowId } = await authUserIdFromOAuthAccessToken(supabase, auth);
    if (userId && tokenRowId) return { kind: "oauth", userId, tokenRowId };
    return null;
  }

  const oauthFromAux =
    xApi?.startsWith(OAUTH_ACCESS_TOKEN_PREFIX) ? xApi : apiHdr?.startsWith(OAUTH_ACCESS_TOKEN_PREFIX) ? apiHdr : null;
  if (oauthFromAux) {
    const { userId, tokenRowId } = await authUserIdFromOAuthAccessToken(supabase, oauthFromAux);
    if (userId && tokenRowId) return { kind: "oauth", userId, tokenRowId };
  }

  const apiKeyCandidate = auth ?? xApi ?? apiHdr;
  if (!apiKeyCandidate) return null;

  const { userId, keyRowId } = await authUserIdFromApiKey(supabase, apiKeyCandidate);
  if (userId && keyRowId) return { kind: "api_key", userId, keyRowId };
  return null;
}

/** When true, tools/call auth errors return HTTP 200 + JSON-RPC (legacy). Default: HTTP 401. */
function mcpAuthHttpFailureStatus(): number {
  return process.env.YALP_MCP_LEGACY_AUTH_HTTP200 === "true" ? 200 : 401;
}

function mcpResourceMetadataWwwAuthenticateValue(): string {
  const issuer = getOAuthIssuerBase();
  const resource = getMcpResourceUrl();
  const rm = `${issuer}/.well-known/oauth-protected-resource?resource=${encodeURIComponent(resource)}`;
  return `Bearer realm="yalp", error="invalid_token", resource_metadata="${rm}"`;
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

/** Lightweight reachability check (no body). */
export function HEAD() {
  return mergeCors(new NextResponse(null, { status: 200 }));
}

/**
 * MCP Streamable HTTP (2025-03-26): GET with `Accept: text/event-stream` must get SSE or 405.
 * Our server does not expose a server-push GET stream; return 405 so clients use POST.
 * For browsers / curl without event-stream, keep JSON discovery.
 */
export function GET(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/event-stream")) {
    const res = new NextResponse(null, { status: 405 });
    res.headers.set("Allow", "GET, HEAD, POST, OPTIONS");
    return mergeCors(res);
  }

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
            "Authorization: Bearer <oauth_access_token> (Claude Web / custom connector OAuth)",
            "Authorization: Bearer <yalp_api_key> or X-Api-Key (stdio bridge / API keys)",
          ],
          oauth: {
            protectedResourceMetadata: `${getOAuthIssuerBase()}/.well-known/oauth-protected-resource?resource=${encodeURIComponent(getMcpResourceUrl())}`,
            authorizationServer: `${getOAuthIssuerBase()}/.well-known/oauth-authorization-server`,
          },
        },
        compatibilityChecklist: [
          "Use POST with JSON-RPC 2.0 payload",
          "Use URL ending with /api/mcp/stream",
          "tools/call: OAuth Bearer (yalp_at_…) after connector login, or Yalp API key (yalp_…)",
        ],
        hint: "POST JSON-RPC 2.0 messages. tools/list is public metadata; tools/call requires OAuth access token or API key.",
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

  const authCtx = await resolveMcpAuth(req, supabase);
  if (!authCtx) {
    return {
      status: mcpAuthHttpFailureStatus(),
      body: jsonRpcError(
        id,
        -32000,
        "Unauthorized: use OAuth access token (Authorization: Bearer yalp_at_…) or Yalp API key (yalp_…) via Bearer or X-Api-Key.",
      ),
      isNotification: false,
      addBearerAuthHint: true,
    };
  }

  if (authCtx.kind === "api_key") {
    touchApiKeyLastUsed(supabase, authCtx.keyRowId);
  }

  const userId = authCtx.userId;

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
    /** Streamable HTTP: notification-only POST → 202 Accepted, no body. */
    const empty = mergeCors(new NextResponse(null, { status: 202 }));
    const sessionId = req.headers.get("mcp-session-id") ?? crypto.randomUUID();
    empty.headers.set("Mcp-Session-Id", sessionId);
    return empty;
  }

  const response = mergeCors(NextResponse.json(out.body, { status: out.status }));
  const sessionId = req.headers.get("mcp-session-id") ?? crypto.randomUUID();
  response.headers.set("Mcp-Session-Id", sessionId);
  if (out.addBearerAuthHint) {
    response.headers.set("WWW-Authenticate", mcpResourceMetadataWwwAuthenticateValue());
  }
  return response;
}
